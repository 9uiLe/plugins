import assert from "node:assert/strict";
import test from "node:test";

import { evaluateExecutionGate, evaluateTransportGate } from "../scripts/transport-gate.mjs";

const approval = { owner: "decision-owner", approvedAt: "2026-07-20" };

function probe(transport, overrides = {}) {
  return {
    transport,
    status: "UNAVAILABLE",
    evidence: `${transport} probe: command not found`,
    sourceType: "PROBE",
    probedAt: "2026-07-20",
    ...overrides
  };
}

function participant(overrides = {}) {
  return {
    id: "advisor-fable",
    transport: "DIRECT_CLI",
    family: "FABLE",
    model: "claude-fable-5",
    effort: "high",
    identityVerified: true,
    effortVerified: true,
    accessVerified: true,
    ...overrides
  };
}

function genericSubagent(id) {
  return {
    id,
    transport: "GENERIC_SUBAGENT",
    family: "UNKNOWN",
    model: "unknown",
    effort: "unknown",
    identityVerified: false,
    effortVerified: false,
    accessVerified: false
  };
}

function record(overrides = {}) {
  return {
    decision: {
      stakes: "CONSEQUENTIAL",
      categories: ["PRODUCT_ROADMAP", "AUTONOMOUS_EXECUTION_PLAN"],
      requestedFamilies: ["FABLE", "CODEX"]
    },
    selectedTransport: "DIRECT_CLI",
    probes: [probe("HOST_NATIVE"), probe("BUNDLED_ADAPTER")],
    participants: [participant(), participant({ id: "advisor-codex", family: "CODEX", model: "gpt-5.6-sol" })],
    waivers: [],
    ...overrides
  };
}

test("compliant heterogeneous council passes and may execute", () => {
  const gate = evaluateTransportGate(record());
  assert.equal(gate.status, "PASS");
  assert.equal(gate.dispatchAllowed, true);
  assert.equal(gate.provisionalRequired, false);

  const execution = evaluateExecutionGate(record());
  assert.equal(execution.executionAllowed, true);
  assert.equal(execution.provisionalRequired, false);
  assert.equal(execution.provisionalMarker, null);
});

test("issue #62 incident reproduction blocks before generic advisor dispatch", () => {
  // Consequential roadmap decision, generic same-host subagents, no probes of
  // higher-priority transports, unverified identity/effort/access.
  const incident = record({
    selectedTransport: "GENERIC_SUBAGENT",
    probes: [],
    participants: [genericSubagent("subagent-a"), genericSubagent("subagent-b")]
  });
  const gate = evaluateTransportGate(incident);
  assert.equal(gate.status, "BLOCKED");
  assert.equal(gate.dispatchAllowed, false);
  assert.ok(gate.findings.some((f) => f.code === "UNPROBED_TRANSPORT"));
  assert.ok(gate.findings.some((f) => f.code === "UNVERIFIED_PARTICIPANT"));
  assert.ok(gate.findings.some((f) => f.code === "TOPOLOGY_UNSATISFIED"));

  const execution = evaluateExecutionGate({ ...incident, phase: "EXECUTION" });
  assert.equal(execution.executionAllowed, false);
  assert.equal(execution.provisionalRequired, true);
});

test("skipping a higher-priority transport requires recorded probe failure", () => {
  const gate = evaluateTransportGate(record({ probes: [probe("HOST_NATIVE")] }));
  assert.equal(gate.status, "BLOCKED");
  assert.ok(gate.findings.some((f) => f.code === "UNPROBED_TRANSPORT" && f.ref === "BUNDLED_ADAPTER"));
});

test("an explicit owner waiver substitutes for a probe", () => {
  const gate = evaluateTransportGate(
    record({
      probes: [probe("HOST_NATIVE")],
      waivers: [{ transport: "BUNDLED_ADAPTER", ...approval }]
    })
  );
  assert.equal(gate.status, "PASS");
});

test("an available higher-priority transport cannot be silently skipped", () => {
  const gate = evaluateTransportGate(
    record({ probes: [probe("HOST_NATIVE", { status: "AVAILABLE" }), probe("BUNDLED_ADAPTER")] })
  );
  assert.equal(gate.status, "BLOCKED");
  assert.ok(gate.findings.some((f) => f.code === "SKIPPED_AVAILABLE_TRANSPORT"));
});

test("probe evidence needs substance, a timestamp, and a PROBE/RUNTIME source", () => {
  for (const bad of [
    { evidence: "" },
    { probedAt: "not-a-date" },
    { sourceType: "CONFIG" },
    { status: "GUESSED" }
  ]) {
    const gate = evaluateTransportGate(record({ probes: [probe("HOST_NATIVE", bad), probe("BUNDLED_ADAPTER")] }));
    assert.equal(gate.status, "BLOCKED", JSON.stringify(bad));
    assert.ok(gate.findings.some((f) => f.code === "INVALID_PROBE_EVIDENCE"));
  }
});

test("consequential categories cannot be downgraded by reversibility", () => {
  const gate = evaluateTransportGate(
    record({
      decision: {
        stakes: "LOW",
        stakesBasis: "REVERSIBILITY",
        categories: ["PRODUCT_ROADMAP"],
        requestedFamilies: ["FABLE", "CODEX"]
      },
      participants: [genericSubagent("subagent-a")]
    })
  );
  assert.equal(gate.stakes, "CONSEQUENTIAL");
  assert.equal(gate.status, "BLOCKED");
  assert.ok(gate.findings.some((f) => f.code === "REVERSIBILITY_DOWNGRADE"));
  assert.ok(gate.findings.some((f) => f.code === "CONSEQUENTIAL_CATEGORY"));
});

test("unverified identity, effort, or access blocks consequential councils", () => {
  for (const field of ["identityVerified", "effortVerified", "accessVerified"]) {
    const gate = evaluateTransportGate(record({ participants: [participant({ [field]: false }), participant({ id: "advisor-codex", family: "CODEX" })] }));
    assert.equal(gate.status, "BLOCKED", field);
    assert.ok(gate.findings.some((f) => f.code === "UNVERIFIED_PARTICIPANT"));
  }
});

test("generic subagents cannot satisfy a requested heterogeneous council", () => {
  const topologyGap = record({
    participants: [
      participant(),
      genericSubagent("subagent-b")
    ]
  });
  const gate = evaluateTransportGate(topologyGap);
  assert.equal(gate.topologySatisfied, false);
  assert.ok(gate.findings.some((f) => f.code === "TOPOLOGY_UNSATISFIED" && f.ref.includes("CODEX")));
  // Unverified generic participant on a consequential decision: fail closed.
  assert.equal(gate.status, "BLOCKED");
});

test("verified but incomplete topology requires exact-configuration authorization", () => {
  const partial = record({ participants: [participant()] });
  assert.equal(evaluateTransportGate(partial).status, "AUTHORIZATION_REQUIRED");

  // Authorization that does not enumerate the exact participant configuration is rejected.
  const wrongConfig = {
    ...partial,
    degradedAuthorization: {
      approved: true,
      ...approval,
      participants: [{ transport: "DIRECT_CLI", family: "CODEX", model: "gpt-5.6-sol", effort: "high" }]
    }
  };
  const rejected = evaluateTransportGate(wrongConfig);
  assert.equal(rejected.status, "AUTHORIZATION_REQUIRED");
  assert.ok(rejected.findings.some((f) => f.code === "AUTHORIZATION_CONFIG_MISMATCH"));

  const exact = {
    ...partial,
    degradedAuthorization: {
      approved: true,
      ...approval,
      participants: [{ transport: "DIRECT_CLI", family: "FABLE", model: "claude-fable-5", effort: "high" }]
    }
  };
  const authorized = evaluateTransportGate(exact);
  assert.equal(authorized.status, "DEGRADED");
  assert.equal(authorized.provisionalRequired, true);

  const execution = evaluateExecutionGate({ ...exact, phase: "EXECUTION" });
  assert.equal(execution.executionAllowed, true);
  assert.equal(execution.provisionalRequired, true);
  assert.match(execution.provisionalMarker, /PROVISIONAL/);
});

test("execution is blocked until topology compliance or explicit authorization", () => {
  const partial = record({ participants: [participant()] });
  const execution = evaluateExecutionGate({ ...partial, phase: "EXECUTION" });
  assert.equal(execution.executionAllowed, false);
  assert.equal(execution.provisionalRequired, true);
});

test("protocol failures mark outputs provisional even when otherwise compliant", () => {
  const execution = evaluateExecutionGate({
    ...record(),
    phase: "EXECUTION",
    protocolFailures: ["challenge round skipped"]
  });
  assert.equal(execution.compliant, false);
  assert.equal(execution.provisionalRequired, true);
  assert.ok(execution.findings.some((f) => f.code === "PROTOCOL_FAILURE"));
});

test("empty or unknown records fail closed", () => {
  const empty = evaluateTransportGate({});
  assert.equal(empty.status, "BLOCKED");
  assert.ok(empty.findings.some((f) => f.code === "UNKNOWN_TRANSPORT"));
  assert.ok(empty.findings.some((f) => f.code === "NO_PARTICIPANTS"));

  const unknownTransport = evaluateTransportGate(record({ selectedTransport: "MYSTERY" }));
  assert.equal(unknownTransport.status, "BLOCKED");
});

test("participant transport must match the selected transport (#77 B-P25)", () => {
  // Chair reproduction: HOST_NATIVE is the top tier (no probes required), so a
  // caller could previously smuggle GENERIC_SUBAGENT participants past every
  // probe obligation just by labelling selectedTransport HOST_NATIVE.
  const smuggled = record({
    selectedTransport: "HOST_NATIVE",
    probes: [],
    participants: [
      participant({ transport: "GENERIC_SUBAGENT" }),
      participant({ id: "advisor-codex", family: "CODEX", model: "gpt-5.6-sol", transport: "GENERIC_SUBAGENT" })
    ]
  });
  const gate = evaluateTransportGate(smuggled);
  assert.equal(gate.status, "BLOCKED");
  assert.equal(gate.dispatchAllowed, false);
  assert.ok(gate.findings.some((f) => f.code === "TRANSPORT_MISMATCH"));

  // A single participant on a LOWER-priority transport than declared also
  // blocks, even when the rest match.
  const oneOff = record({
    participants: [participant(), participant({ id: "advisor-codex", family: "CODEX", transport: "GENERIC_SUBAGENT" })]
  });
  const gate2 = evaluateTransportGate(oneOff);
  assert.equal(gate2.status, "BLOCKED");
  assert.ok(gate2.findings.some((f) => f.code === "TRANSPORT_MISMATCH" && f.ref === "advisor-codex"));

  // A declared tier that no participant actually uses is dishonest labelling
  // in the other direction and blocks too.
  const unusedTier = record({
    selectedTransport: "GENERIC_SUBAGENT",
    probes: [probe("HOST_NATIVE"), probe("BUNDLED_ADAPTER"), probe("DIRECT_CLI")],
    participants: [participant({ transport: "HOST_NATIVE" })]
  });
  const gate3 = evaluateTransportGate(unusedTier);
  assert.ok(gate3.findings.some((f) => f.code === "TRANSPORT_MISMATCH" && f.ref === "GENERIC_SUBAGENT"));
  assert.equal(gate3.status, "BLOCKED");

  // An unknown participant transport fails closed.
  const unknown = record({
    participants: [participant(), participant({ id: "advisor-codex", family: "CODEX", transport: "MYSTERY_BOX" })]
  });
  assert.ok(evaluateTransportGate(unknown).findings.some((f) => f.code === "TRANSPORT_MISMATCH" && f.ref === "advisor-codex"));
});

test("a genuinely mixed-transport council validates in one record (#77 follow-up)", () => {
  // FABLE over DIRECT_CLI (the declared worst tier) + CODEX over
  // BUNDLED_ADAPTER (higher priority, in active use → no skip evidence
  // needed for it; only HOST_NATIVE above needs a probe).
  const mixed = record({
    probes: [probe("HOST_NATIVE")],
    participants: [
      participant(),
      participant({ id: "advisor-codex", family: "CODEX", model: "gpt-5.6-sol", transport: "BUNDLED_ADAPTER" })
    ]
  });
  const gate = evaluateTransportGate(mixed);
  assert.equal(gate.status, "PASS");
  assert.equal(gate.topologySatisfied, true);

  // A transport recorded as UNAVAILABLE cannot simultaneously be in active
  // use — the contradiction voids the probe evidence and blocks.
  const contradiction = record({
    probes: [probe("HOST_NATIVE"), probe("BUNDLED_ADAPTER")],
    participants: [
      participant(),
      participant({ id: "advisor-codex", family: "CODEX", model: "gpt-5.6-sol", transport: "BUNDLED_ADAPTER" })
    ]
  });
  const blocked = evaluateTransportGate(contradiction);
  assert.equal(blocked.status, "BLOCKED");
  assert.ok(blocked.findings.some((f) => f.code === "INVALID_PROBE_EVIDENCE" && f.ref === "BUNDLED_ADAPTER"));

  // The contradiction check covers the SELECTED tier itself too: a
  // DIRECT_CLI council whose own DIRECT_CLI probe says UNAVAILABLE blocks.
  const selectedTierContradiction = record({
    probes: [probe("HOST_NATIVE"), probe("BUNDLED_ADAPTER"), probe("DIRECT_CLI")]
  });
  const blocked2 = evaluateTransportGate(selectedTierContradiction);
  assert.equal(blocked2.status, "BLOCKED");
  assert.ok(blocked2.findings.some((f) => f.code === "INVALID_PROBE_EVIDENCE" && f.ref === "DIRECT_CLI"));
});

test("exact-config authorization requires all four fields on both sides (#77 follow-up)", () => {
  const partial = record({ participants: [participant()] });
  // Authorization entries enumerating only the transport never match — even
  // though blank-for-blank key equality would have said otherwise.
  const transportOnly = evaluateTransportGate({
    ...partial,
    degradedAuthorization: { approved: true, ...approval, participants: [{ transport: "DIRECT_CLI" }] }
  });
  assert.equal(transportOnly.status, "AUTHORIZATION_REQUIRED");
  assert.ok(transportOnly.findings.some((f) => f.code === "AUTHORIZATION_CONFIG_MISMATCH"));

  // Blank-for-blank: the actual participant misses `effort` and the
  // authorization mirrors the same gap — still MISMATCH.
  const blankForBlank = record({ participants: [participant({ effort: undefined })] });
  const mirrored = evaluateTransportGate({
    ...blankForBlank,
    degradedAuthorization: {
      approved: true,
      ...approval,
      participants: [{ transport: "DIRECT_CLI", family: "FABLE", model: "claude-fable-5" }]
    }
  });
  assert.ok(mirrored.findings.some((f) => f.code === "AUTHORIZATION_CONFIG_MISMATCH"));

  const execution = evaluateExecutionGate({
    ...partial,
    phase: "EXECUTION",
    degradedAuthorization: { approved: true, ...approval, participants: [{ transport: "DIRECT_CLI" }] }
  });
  assert.equal(execution.executionAllowed, false);
});

test("a generic subagent claiming a family never satisfies the topology (#77 B-P26)", () => {
  // Chair reproduction: GENERIC_SUBAGENT participants self-reporting
  // family CODEX/FABLE with identityVerified: true previously satisfied a
  // requested heterogeneous council even at CONSEQUENTIAL stakes.
  const impostor = record({
    selectedTransport: "GENERIC_SUBAGENT",
    probes: [probe("HOST_NATIVE"), probe("BUNDLED_ADAPTER"), probe("DIRECT_CLI")],
    participants: [
      { id: "generic-fable", transport: "GENERIC_SUBAGENT", family: "FABLE", model: "claude-fable-5", effort: "high", identityVerified: true, effortVerified: true, accessVerified: true },
      { id: "generic-codex", transport: "GENERIC_SUBAGENT", family: "CODEX", model: "gpt-5.6-sol", effort: "high", identityVerified: true, effortVerified: true, accessVerified: true }
    ]
  });
  const gate = evaluateTransportGate(impostor);
  assert.equal(gate.topologySatisfied, false);
  assert.ok(gate.findings.some((f) => f.code === "TOPOLOGY_UNSATISFIED" && f.ref.includes("FABLE") && f.ref.includes("CODEX")));
  assert.notEqual(gate.status, "PASS");
  // Verified direct-CLI participants of the same families DO satisfy it.
  assert.equal(evaluateTransportGate(record()).topologySatisfied, true);
});

test("LOW-stakes incomplete-topology execution requires exact-config authorization (#77 B-P27)", () => {
  // Chair reproduction record from the issue: LOW stakes with owner
  // provenance, FABLE+CODEX requested, only FABLE present, probes recorded,
  // no degradedAuthorization.
  const chairRecord = {
    phase: "EXECUTION",
    decision: {
      stakes: "LOW",
      stakesBasis: "OWNER_DIRECTIVE",
      stakesApproval: { owner: "owner", approvedAt: "2026-07-20" },
      categories: [],
      requestedFamilies: ["FABLE", "CODEX"]
    },
    selectedTransport: "DIRECT_CLI",
    probes: [
      probe("HOST_NATIVE", { evidence: "probe failed" }),
      probe("BUNDLED_ADAPTER", { evidence: "probe failed" })
    ],
    waivers: [],
    participants: [participant({ id: "only-fable" })],
    protocolFailures: []
  };
  const execution = evaluateExecutionGate(chairRecord);
  assert.equal(execution.executionAllowed, false);
  assert.equal(execution.provisionalRequired, true);

  // Dispatch may still degrade at LOW stakes...
  const dispatch = evaluateTransportGate(chairRecord);
  assert.equal(dispatch.status, "DEGRADED");
  assert.equal(dispatch.dispatchAllowed, true);

  // ...and execution becomes eligible only with the exact-config authorization.
  const authorized = evaluateExecutionGate({
    ...chairRecord,
    degradedAuthorization: {
      approved: true,
      ...approval,
      participants: [{ transport: "DIRECT_CLI", family: "FABLE", model: "claude-fable-5", effort: "high" }]
    }
  });
  assert.equal(authorized.executionAllowed, true);
  assert.equal(authorized.provisionalRequired, true);
  assert.match(authorized.provisionalMarker, /PROVISIONAL/);
});

test("low-stakes reversible-with-provenance decisions may degrade, not bypass probes", () => {
  const lowStakes = {
    decision: { stakes: "LOW", stakesBasis: "OWNER_JUDGMENT", categories: [], requestedFamilies: [], stakesApproval: approval },
    selectedTransport: "GENERIC_SUBAGENT",
    probes: [probe("HOST_NATIVE"), probe("BUNDLED_ADAPTER"), probe("DIRECT_CLI")],
    participants: [genericSubagent("subagent-a")],
    waivers: []
  };
  const gate = evaluateTransportGate(lowStakes);
  assert.equal(gate.stakes, "LOW");
  assert.equal(gate.status, "DEGRADED");
  assert.equal(gate.dispatchAllowed, true);
  assert.equal(gate.provisionalRequired, true);

  // Even low stakes cannot skip probes of higher-priority transports.
  const unprobed = evaluateTransportGate({ ...lowStakes, probes: [] });
  assert.equal(unprobed.status, "BLOCKED");
});
