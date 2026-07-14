import assert from "node:assert/strict";
import test from "node:test";

import { validateDecisionRecord } from "../scripts/decision-record-guard.mjs";

const approval = { owner: "decision-owner", approvedAt: "2026-07-15" };

function outcome(overrides = {}) {
  return {
    id: "O1",
    version: 1,
    beneficiary: "application users",
    baseline: "p95 latency 800ms",
    target: "p95 latency below 200ms",
    failureCondition: "p95 remains above 200ms",
    acceptedTradeoffs: ["10% infrastructure cost increase"],
    horizon: "30 days",
    observationMethod: "production latency dashboard",
    authority: "decision-owner",
    status: "ACTIVE",
    proposer: "decision-owner",
    ownerApproval: approval,
    ...overrides
  };
}

function proposal(overrides = {}) {
  return {
    id: "A-P1",
    source: "Advisor A",
    type: "MEANS",
    relatedProposalIds: [],
    initialOutcomeIds: ["O1@1"],
    outcomeIds: ["O1@1"],
    linkRevision: 0,
    expectedContribution: "Reduce p95 latency",
    evidenceIds: ["E1"],
    negativeEffects: [],
    successRelation: "OUTCOME_CONTRIBUTION",
    confidenceHistory: [{ value: 60, evidenceIds: ["E1"] }],
    disposition: "ACCEPT",
    dispositionReason: "Measured contribution",
    owner: "implementation-owner",
    trigger: "rollback if target is missed",
    verification: "Observe p95 latency",
    ...overrides
  };
}

function acceptedTrace(overrides = {}) {
  return {
    proposalId: "A-P1",
    evidenceIds: ["E1"],
    outcomeIds: ["O1@1"],
    expectedContribution: "Reduce p95 latency",
    observation: "production latency dashboard",
    owner: "implementation-owner",
    ...overrides
  };
}

function record(overrides = {}) {
  return {
    mode: "FULL",
    outcomes: [outcome()],
    proposals: [proposal()],
    linkChanges: [],
    acceptedTraces: [acceptedTrace()],
    ...overrides
  };
}

test("tool adoption becoming the goal is blocked", () => {
  const result = validateDecisionRecord(
    record({ proposals: [proposal({ successRelation: "MEANS_COMPLETION" })] })
  );

  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "MEANS_AS_GOAL"));
});

test("architecture migration completion cannot redefine success", () => {
  const result = validateDecisionRecord(
    record({
      proposals: [
        proposal({
          expectedContribution: "Complete database migration",
          successRelation: "MEANS_COMPLETION",
          confidenceHistory: [
            { value: 60, evidenceIds: ["E1"] },
            { value: 80, evidenceIds: ["E1"] }
          ]
        })
      ],
      acceptedTraces: [acceptedTrace({ expectedContribution: "Complete database migration" })]
    })
  );

  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "MEANS_AS_GOAL"));
});

test("hidden cross-outcome tradeoff is blocked without owner authorization", () => {
  const costOutcome = outcome({
    id: "O2",
    beneficiary: "business owner",
    baseline: "$10k monthly cost",
    target: "no more than $11k monthly cost",
    failureCondition: "cost exceeds $11k",
    observationMethod: "billing dashboard"
  });
  const result = validateDecisionRecord(
    record({
      outcomes: [outcome(), costOutcome],
      proposals: [
        proposal({
          negativeEffects: [{ outcomeId: "O2@1", effect: "Raises cost above target" }]
        })
      ]
    })
  );

  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "HIDDEN_TRADEOFF"));
});

test("owner-approved outcome revision preserves immutable history", () => {
  const result = validateDecisionRecord(
    record({
      outcomes: [
        outcome({ status: "REVISED" }),
        outcome({
          version: 2,
          priorVersion: "O1@1",
          target: "p95 latency below 250ms",
          ownerApproval: { owner: "decision-owner", approvedAt: "2026-07-16" }
        })
      ],
      proposals: [proposal({ initialOutcomeIds: ["O1@2"], outcomeIds: ["O1@2"] })],
      acceptedTraces: [acceptedTrace({ outcomeIds: ["O1@2"] })]
    })
  );

  assert.equal(result.valid, true);
  assert.deepEqual(result.findings, []);
});

test("orphaned outcome revision is rejected", () => {
  const result = validateDecisionRecord(
    record({
      outcomes: [outcome({ version: 2, priorVersion: "O1@1" })],
      proposals: [proposal({ initialOutcomeIds: ["O1@2"], outcomeIds: ["O1@2"] })],
      acceptedTraces: [acceptedTrace({ outcomeIds: ["O1@2"] })]
    })
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.findings.some((finding) => finding.code === "UNAUTHORIZED_OUTCOME_CHANGE")
  );
});

test("harmless compact low-stakes proposal proceeds with all guard-critical fields", () => {
  const result = validateDecisionRecord(record({ mode: "COMPACT" }));

  assert.equal(result.valid, true);
  assert.deepEqual(result.findings, []);
});

test("compact low-stakes proposal fails when guard-critical fields are omitted", () => {
  const incomplete = proposal();
  delete incomplete.negativeEffects;
  const result = validateDecisionRecord(
    record({ mode: "COMPACT", proposals: [incomplete] })
  );

  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "UNTRACED_PROPOSAL"));
});

test("accepted proposal requires a complete evidence to outcome trace", () => {
  const result = validateDecisionRecord(record({ acceptedTraces: [] }));

  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "UNTRACED_PROPOSAL"));
});

test("challenge outcome-link changes require an append-only audit event", () => {
  const secondOutcome = outcome({ id: "O2" });
  const result = validateDecisionRecord(
    record({
      outcomes: [outcome(), secondOutcome],
      proposals: [proposal({ outcomeIds: ["O2@1"], linkRevision: 1 })],
      acceptedTraces: [acceptedTrace({ outcomeIds: ["O2@1"] })]
    })
  );

  assert.equal(result.valid, false);
  assert.ok(
    result.findings.some((finding) => finding.code === "UNAUTHORIZED_OUTCOME_CHANGE")
  );
});

test("challenge outcome-link history must be complete and sequential", () => {
  const secondOutcome = outcome({ id: "O2" });
  const result = validateDecisionRecord(
    record({
      outcomes: [outcome(), secondOutcome],
      proposals: [proposal({ outcomeIds: ["O2@1"], linkRevision: 1 })],
      linkChanges: [
        {
          proposalId: "A-P1",
          revision: 1,
          round: "challenge",
          priorOutcomeIds: ["O1@1"],
          newOutcomeIds: ["O2@1"],
          basis: "OVERLOOKED_EVIDENCE",
          evidenceIds: ["E2"],
          author: "Advisor A"
        }
      ],
      acceptedTraces: [acceptedTrace({ outcomeIds: ["O2@1"] })]
    })
  );

  assert.equal(result.valid, true);
  assert.deepEqual(result.findings, []);
});

test("accepted trace must preserve the proposal contribution", () => {
  const result = validateDecisionRecord(
    record({ acceptedTraces: [acceptedTrace({ expectedContribution: "Adopt Redis" })] })
  );

  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "UNTRACED_PROPOSAL"));
});

test("empty and structurally incomplete records fail closed", () => {
  assert.equal(validateDecisionRecord({}).valid, false);
  assert.equal(
    validateDecisionRecord(
      record({ proposals: [proposal({ expectedContribution: "", evidenceIds: [] })] })
    ).valid,
    false
  );
});
