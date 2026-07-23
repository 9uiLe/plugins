#!/usr/bin/env node

// Deterministic pre-dispatch and execution gate for the capability fallback
// order (Issue #62). Complements execution-preflight-guard.mjs (#54): that
// guard verifies per-participant identity/effort/limits; this gate verifies
// that higher-priority transports were actually probed, that every participant
// is bound to the gated transport (no bypass via selectedTransport labelling,
// #77), that consequential decision categories fail closed, that a requested
// heterogeneous council is not silently satisfied by generic subagents
// (whatever family they claim), that degraded execution always carries an
// exact-configuration owner authorization, and that non-compliant outputs are
// marked provisional.

export const FALLBACK_ORDER = ["HOST_NATIVE", "BUNDLED_ADAPTER", "DIRECT_CLI", "GENERIC_SUBAGENT", "OPPOSING_BRIEF", "SELF_CRITIQUE"];
export const CONSEQUENTIAL_CATEGORIES = new Set(["ARCHITECTURE", "SECURITY_POLICY", "PRODUCT_ROADMAP", "AUTONOMOUS_EXECUTION_PLAN"]);
// Transports whose identity-verified participants can represent a requested
// advisor family. A GENERIC_SUBAGENT (or opposing-brief/self-critique stand-in)
// can never represent a family, whatever it claims about itself (#77 B-P26).
export const FAMILY_CAPABLE_TRANSPORTS = new Set(["HOST_NATIVE", "BUNDLED_ADAPTER", "DIRECT_CLI"]);
const PROBE_FAILURES = new Set(["FAILED", "UNAVAILABLE"]);
const HARD_BLOCKS = ["UNKNOWN_TRANSPORT", "UNPROBED_TRANSPORT", "INVALID_PROBE_EVIDENCE", "SKIPPED_AVAILABLE_TRANSPORT", "NO_PARTICIPANTS", "UNVERIFIED_STAKES", "TRANSPORT_MISMATCH"];

const present = (value) => value !== undefined && value !== null && (typeof value !== "string" || value.trim() !== "");
const validDate = (value) => present(value) && !Number.isNaN(Date.parse(value));

// latestProbe — resolve the authoritative probe for a transport by probedAt,
// NOT by array position: relying on input order lets an older AVAILABLE entry
// mask a newer failure (or an old failure block a newer success). Fully
// order-independent: probes tied on the maximum probedAt with disagreeing
// statuses are a conflict (fail closed — no last-wins tiebreak), and undated
// entries resolve to the first one, which then fails evidence validation.
const validProbeEvidence = (probe) =>
  present(probe?.evidence) && validDate(probe?.probedAt) && ["PROBE", "RUNTIME"].includes(probe?.sourceType);

function latestProbe(probes, transport) {
  const matching = probes.filter((p) => p?.transport === transport);
  if (!matching.length) return { probe: null, conflict: false, invalidEvidence: false };
  const dated = matching.filter((p) => validDate(p?.probedAt));
  // Only undated entries: nothing can be ordered, and none carries valid
  // evidence — fail closed regardless of array order.
  if (!dated.length) return { probe: matching[0], conflict: false, invalidEvidence: true };
  const maxTs = Math.max(...dated.map((p) => Date.parse(p.probedAt)));
  const newest = dated.filter((p) => Date.parse(p.probedAt) === maxTs);
  return {
    probe: newest[0],
    // Entries tied on the newest probedAt must agree on status; a
    // disagreement has no order-independent resolution.
    conflict: new Set(newest.map((p) => p.status)).size > 1,
    // EVERY entry tied on the newest probedAt must carry valid evidence —
    // validating only one of them would reintroduce array-order dependence.
    invalidEvidence: newest.some((p) => !validProbeEvidence(p))
  };
}
const finding = (code, ref, message) => ({ code, ref: ref ?? null, message });
const ownerProvenance = (entry) => present(entry?.owner) && validDate(entry?.approvedAt);
const participantKey = (p) => [p?.transport, p?.family, p?.model, p?.effort].map((v) => v ?? "").join("|");

// assessStakes — decision categories map to fail-closed consequential
// handling; reversibility alone never downgrades stakes.
export function assessStakes(decision) {
  const findings = [];
  const categories = Array.isArray(decision?.categories) ? decision.categories : [];
  const forcing = categories.filter((c) => CONSEQUENTIAL_CATEGORIES.has(c));
  if (decision?.stakes === "LOW") {
    if (forcing.length) findings.push(finding("CONSEQUENTIAL_CATEGORY", forcing.join(","), "Decision category forces fail-closed consequential handling"));
    if (decision?.stakesBasis === "REVERSIBILITY") findings.push(finding("REVERSIBILITY_DOWNGRADE", null, "Reversibility alone cannot downgrade council stakes"));
    if (!ownerProvenance(decision?.stakesApproval)) findings.push(finding("UNVERIFIED_STAKES", null, "Low-stakes claim requires owner provenance"));
  }
  return { stakes: decision?.stakes === "LOW" && !findings.length ? "LOW" : "CONSEQUENTIAL", findings };
}

// authorizationState — a degraded run is authorizable only by an approval that
// enumerates the exact participant configuration (transport/family/model/effort).
// "Enumerates" means every one of those four fields is present on BOTH sides:
// an authorization (or participant) with missing fields cannot be exact, so
// blank-for-blank key equality never yields MATCH (#77 follow-up).
const CONFIG_FIELDS = ["transport", "family", "model", "effort"];
const completeConfig = (p) => CONFIG_FIELDS.every((field) => present(p?.[field]));
export function authorizationState(authorization, participants) {
  if (authorization == null) return "NONE";
  if (authorization.approved !== true || !ownerProvenance(authorization)) return "MISMATCH";
  const authorizedEntries = Array.isArray(authorization.participants) ? authorization.participants : [];
  if (!authorizedEntries.length || !participants.length) return "MISMATCH";
  if (!authorizedEntries.every(completeConfig) || !participants.every(completeConfig)) return "MISMATCH";
  const authorized = authorizedEntries.map(participantKey).sort();
  const actual = participants.map(participantKey).sort();
  if (authorized.length !== actual.length || authorized.some((key, i) => key !== actual[i])) return "MISMATCH";
  return "MATCH";
}

// unmetFamilies — requested advisor families not verifiably represented.
// A generic subagent (or an unverified identity claim) never counts: the
// participant must be identity-verified AND run on a family-capable transport
// (host-native / bundled adapter / direct CLI). A GENERIC_SUBAGENT claiming
// `family: "CODEX", identityVerified: true` does not satisfy CODEX (#77 B-P26).
function unmetFamilies(decision, participants) {
  const requested = Array.isArray(decision?.requestedFamilies) ? decision.requestedFamilies : [];
  return requested.filter(
    (family) =>
      !participants.some(
        (p) =>
          p?.family === family &&
          p?.identityVerified === true &&
          FAMILY_CAPABLE_TRANSPORTS.has(p?.transport)
      )
  );
}

export function evaluateTransportGate(record) {
  const decision = record?.decision || {};
  const participants = Array.isArray(record?.participants) ? record.participants : [];
  const probes = Array.isArray(record?.probes) ? record.probes : [];
  const waivers = Array.isArray(record?.waivers) ? record.waivers : [];
  const { stakes, findings: stakesFindings } = assessStakes(decision);
  const findings = [...stakesFindings];

  if (!participants.length) findings.push(finding("NO_PARTICIPANTS", null, "At least one participant is required"));

  // Transport binding (#77 B-P25): selectedTransport declares the WORST
  // (lowest-priority) tier the council operates at, and every participant is
  // bound to it. A participant on a lower-priority transport than declared is
  // smuggling (bypasses the probe obligations and topology policy of the
  // higher tiers via labelling); a declared tier that no participant actually
  // uses is dishonest labelling in the other direction. Mixed-transport
  // councils are supported in one record: participants may run on
  // higher-priority transports than the declared tier, and a transport in
  // active use needs no skip evidence (it is not being skipped).
  const tier = FALLBACK_ORDER.indexOf(record?.selectedTransport);
  if (tier < 0) findings.push(finding("UNKNOWN_TRANSPORT", record?.selectedTransport ?? null, "Unknown or missing transport fails closed"));
  const usedTransports = new Set(participants.map((p) => p?.transport));
  if (tier >= 0 && participants.length && !usedTransports.has(record.selectedTransport)) {
    findings.push(finding("TRANSPORT_MISMATCH", record.selectedTransport, "selectedTransport must be the lowest-priority transport actually used by a participant"));
  }

  // A transport probed FAILED/UNAVAILABLE cannot simultaneously be in active
  // use by a participant — that contradiction voids the probe evidence. This
  // covers EVERY used transport, including the selected tier itself.
  for (const used of usedTransports) {
    if (FALLBACK_ORDER.indexOf(used) < 0) continue; // unknown transports are flagged per participant below
    const { probe, conflict, invalidEvidence } = latestProbe(probes, used);
    if (!probe) continue; // a used transport needs no probe record at all
    if (conflict) findings.push(finding("INVALID_PROBE_EVIDENCE", used, "Conflicting probes share the newest probedAt; ambiguous evidence fails closed"));
    else if (invalidEvidence) findings.push(finding("INVALID_PROBE_EVIDENCE", used, "Probe requires evidence, a timestamp, and PROBE/RUNTIME source"));
    else if (PROBE_FAILURES.has(probe.status)) findings.push(finding("INVALID_PROBE_EVIDENCE", used, "A transport recorded as failed/unavailable cannot also be in active use by a participant"));
  }

  // Every fallback path above the selected tier needs recorded probe failure
  // evidence, an explicit owner waiver, or active use by a participant.
  for (const higher of tier > 0 ? FALLBACK_ORDER.slice(0, tier) : []) {
    if (usedTransports.has(higher)) continue; // in active use — not skipped (contradictions handled above)
    if (waivers.some((w) => w?.transport === higher && ownerProvenance(w))) continue;
    const { probe, conflict, invalidEvidence } = latestProbe(probes, higher);
    if (!probe) { findings.push(finding("UNPROBED_TRANSPORT", higher, "Higher-priority transport requires a recorded probe failure, owner waiver, or active use")); continue; }
    if (conflict) { findings.push(finding("INVALID_PROBE_EVIDENCE", higher, "Conflicting probes share the newest probedAt; ambiguous evidence fails closed")); continue; }
    if (invalidEvidence) { findings.push(finding("INVALID_PROBE_EVIDENCE", higher, "Probe requires evidence, a timestamp, and PROBE/RUNTIME source")); continue; }
    if (probe.status === "AVAILABLE") findings.push(finding("SKIPPED_AVAILABLE_TRANSPORT", higher, "An available higher-priority transport cannot be skipped without an owner waiver"));
    else if (!PROBE_FAILURES.has(probe.status)) findings.push(finding("INVALID_PROBE_EVIDENCE", higher, "Probe status must be FAILED, UNAVAILABLE, or AVAILABLE"));
  }

  for (const p of participants) {
    const unverified = ["identityVerified", "effortVerified", "accessVerified"].filter((field) => p?.[field] !== true);
    if (unverified.length) findings.push(finding("UNVERIFIED_PARTICIPANT", p?.id ?? null, `Unverified: ${unverified.join(", ")}`));
    const pTier = FALLBACK_ORDER.indexOf(p?.transport);
    if (pTier < 0) {
      findings.push(finding("TRANSPORT_MISMATCH", p?.id ?? null, `Unknown participant transport ${p?.transport ?? "(missing)"} fails closed`));
    } else if (tier >= 0 && pTier > tier) {
      findings.push(finding("TRANSPORT_MISMATCH", p?.id ?? null, `Participant transport ${p.transport} is lower-priority than the declared transport ${record.selectedTransport}`));
    }
  }

  const unmet = unmetFamilies(decision, participants);
  if (unmet.length) findings.push(finding("TOPOLOGY_UNSATISFIED", unmet.join(","), "Requested advisor families are not verifiably represented; generic subagents cannot satisfy a heterogeneous council"));

  const authState = authorizationState(record?.degradedAuthorization, participants);
  if (authState === "MISMATCH") findings.push(finding("AUTHORIZATION_CONFIG_MISMATCH", null, "Owner authorization must enumerate the exact degraded participant configuration"));

  const has = (...codes) => findings.some((f) => codes.includes(f.code));
  let status = "PASS";
  if (has(...HARD_BLOCKS) || (stakes === "CONSEQUENTIAL" && has("UNVERIFIED_PARTICIPANT"))) status = "BLOCKED";
  else if (has("TOPOLOGY_UNSATISFIED", "UNVERIFIED_PARTICIPANT")) {
    if (stakes === "LOW") status = "DEGRADED";
    else status = authState === "MATCH" ? "DEGRADED" : "AUTHORIZATION_REQUIRED";
  }
  return {
    status,
    stakes,
    dispatchAllowed: status === "PASS" || status === "DEGRADED",
    topologySatisfied: !unmet.length,
    provisionalRequired: status === "DEGRADED",
    findings
  };
}

export function evaluateExecutionGate(record) {
  const gate = evaluateTransportGate(record);
  const participants = Array.isArray(record?.participants) ? record.participants : [];
  const findings = [...gate.findings];
  const protocolFailures = Array.isArray(record?.protocolFailures) ? record.protocolFailures : [];
  for (const failure of protocolFailures) findings.push(finding("PROTOCOL_FAILURE", null, String(failure)));

  const compliant = gate.status === "PASS" && gate.topologySatisfied && !protocolFailures.length;
  const authMatch = authorizationState(record?.degradedAuthorization, participants) === "MATCH";
  // A non-compliant run may execute ONLY with an owner authorization that
  // enumerates the exact degraded participant configuration. This applies to
  // LOW-stakes degraded runs too: LOW stakes permit degraded DISPATCH, but
  // executing/publishing on an incomplete topology without exact-config
  // authorization is never allowed (#77 B-P27).
  const executionAllowed = compliant || (gate.status !== "BLOCKED" && authMatch);
  const provisionalRequired = !compliant;
  return {
    executionAllowed,
    compliant,
    gateStatus: gate.status,
    topologySatisfied: gate.topologySatisfied,
    provisionalRequired,
    provisionalMarker: provisionalRequired ? "PROVISIONAL: produced without a compliant decision council; see transport-gate findings" : null,
    findings
  };
}

async function main() {
  if (process.argv[1] !== new URL(import.meta.url).pathname) return;
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const record = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const result = record?.phase === "EXECUTION" ? evaluateExecutionGate(record) : evaluateTransportGate(record);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = (record?.phase === "EXECUTION" ? result.executionAllowed : result.dispatchAllowed) ? 0 : 1;
}
main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2; });
