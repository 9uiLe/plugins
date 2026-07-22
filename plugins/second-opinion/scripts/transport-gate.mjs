#!/usr/bin/env node

// Deterministic pre-dispatch and execution gate for the capability fallback
// order (Issue #62). Complements execution-preflight-guard.mjs (#54): that
// guard verifies per-participant identity/effort/limits; this gate verifies
// that higher-priority transports were actually probed, that consequential
// decision categories fail closed, that a requested heterogeneous council is
// not silently satisfied by generic subagents, and that non-compliant outputs
// are marked provisional.

export const FALLBACK_ORDER = ["HOST_NATIVE", "BUNDLED_ADAPTER", "DIRECT_CLI", "GENERIC_SUBAGENT", "OPPOSING_BRIEF", "SELF_CRITIQUE"];
export const CONSEQUENTIAL_CATEGORIES = new Set(["ARCHITECTURE", "SECURITY_POLICY", "PRODUCT_ROADMAP", "AUTONOMOUS_EXECUTION_PLAN"]);
const PROBE_FAILURES = new Set(["FAILED", "UNAVAILABLE"]);
const HARD_BLOCKS = ["UNKNOWN_TRANSPORT", "UNPROBED_TRANSPORT", "INVALID_PROBE_EVIDENCE", "SKIPPED_AVAILABLE_TRANSPORT", "NO_PARTICIPANTS", "UNVERIFIED_STAKES"];

const present = (value) => value !== undefined && value !== null && (typeof value !== "string" || value.trim() !== "");
const validDate = (value) => present(value) && !Number.isNaN(Date.parse(value));
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
export function authorizationState(authorization, participants) {
  if (authorization == null) return "NONE";
  if (authorization.approved !== true || !ownerProvenance(authorization)) return "MISMATCH";
  const authorized = (Array.isArray(authorization.participants) ? authorization.participants : []).map(participantKey).sort();
  const actual = participants.map(participantKey).sort();
  if (authorized.length !== actual.length || authorized.some((key, i) => key !== actual[i])) return "MISMATCH";
  return "MATCH";
}

// unmetFamilies — requested advisor families not verifiably represented.
// A generic subagent (or an unverified identity claim) never counts.
function unmetFamilies(decision, participants) {
  const requested = Array.isArray(decision?.requestedFamilies) ? decision.requestedFamilies : [];
  return requested.filter((family) => !participants.some((p) => p?.family === family && p?.identityVerified === true));
}

export function evaluateTransportGate(record) {
  const decision = record?.decision || {};
  const participants = Array.isArray(record?.participants) ? record.participants : [];
  const probes = Array.isArray(record?.probes) ? record.probes : [];
  const waivers = Array.isArray(record?.waivers) ? record.waivers : [];
  const { stakes, findings: stakesFindings } = assessStakes(decision);
  const findings = [...stakesFindings];

  if (!participants.length) findings.push(finding("NO_PARTICIPANTS", null, "At least one participant is required"));

  // Every fallback path above the selected transport needs recorded probe
  // failure evidence or an explicit owner waiver. Unknown transports fail closed.
  const tier = FALLBACK_ORDER.indexOf(record?.selectedTransport);
  if (tier < 0) findings.push(finding("UNKNOWN_TRANSPORT", record?.selectedTransport ?? null, "Unknown or missing transport fails closed"));
  for (const higher of tier > 0 ? FALLBACK_ORDER.slice(0, tier) : []) {
    if (waivers.some((w) => w?.transport === higher && ownerProvenance(w))) continue;
    const probe = probes.filter((p) => p?.transport === higher).at(-1);
    if (!probe) { findings.push(finding("UNPROBED_TRANSPORT", higher, "Higher-priority transport requires a recorded probe failure or owner waiver")); continue; }
    if (!present(probe.evidence) || !validDate(probe.probedAt) || !["PROBE", "RUNTIME"].includes(probe.sourceType)) { findings.push(finding("INVALID_PROBE_EVIDENCE", higher, "Probe requires evidence, a timestamp, and PROBE/RUNTIME source")); continue; }
    if (probe.status === "AVAILABLE") findings.push(finding("SKIPPED_AVAILABLE_TRANSPORT", higher, "An available higher-priority transport cannot be skipped without an owner waiver"));
    else if (!PROBE_FAILURES.has(probe.status)) findings.push(finding("INVALID_PROBE_EVIDENCE", higher, "Probe status must be FAILED, UNAVAILABLE, or AVAILABLE"));
  }

  for (const p of participants) {
    const unverified = ["identityVerified", "effortVerified", "accessVerified"].filter((field) => p?.[field] !== true);
    if (unverified.length) findings.push(finding("UNVERIFIED_PARTICIPANT", p?.id ?? null, `Unverified: ${unverified.join(", ")}`));
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
  const executionAllowed =
    compliant ||
    (gate.dispatchAllowed && gate.stakes === "LOW") ||
    (gate.status !== "BLOCKED" && authMatch);
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
