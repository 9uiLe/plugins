import assert from "node:assert/strict";
import test from "node:test";

import { validateDecisionRecord } from "../scripts/decision-record-guard.mjs";

const outcome = {
  id: "O1",
  version: 1,
  status: "ACTIVE",
  ownerApproval: { owner: "decision-owner", approvedAt: "2026-07-15" }
};

function proposal(overrides = {}) {
  return {
    id: "A-P1",
    source: "Advisor A",
    type: "MEANS",
    outcomeIds: ["O1@1"],
    evidenceIds: ["E1"],
    negativeEffects: [],
    disposition: "ACCEPT",
    dispositionReason: "Measured contribution",
    verification: "Observe target metric",
    ...overrides
  };
}

test("tool adoption becoming the goal is blocked", () => {
  const result = validateDecisionRecord({
    outcomes: [outcome],
    proposals: [proposal({ meansAsGoal: true })]
  });

  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "MEANS_AS_GOAL"));
});

test("migration confidence cannot rise without new outcome evidence", () => {
  const result = validateDecisionRecord({
    outcomes: [outcome],
    proposals: [
      proposal({
        confidenceHistory: [
          { value: 60, evidenceIds: ["E1"] },
          { value: 80, evidenceIds: ["E1"] }
        ]
      })
    ]
  });

  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "MEANS_AS_GOAL"));
});

test("hidden cross-outcome tradeoff is blocked without authorization", () => {
  const result = validateDecisionRecord({
    outcomes: [outcome],
    proposals: [proposal({ negativeEffects: [{ outcomeId: "O1@1", effect: "Raises cost" }] })]
  });

  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "HIDDEN_TRADEOFF"));
});

test("owner-approved outcome revision preserves history and becomes effective", () => {
  const result = validateDecisionRecord({
    outcomes: [
      { ...outcome, status: "REVISED" },
      {
        ...outcome,
        version: 2,
        priorVersion: "O1@1",
        ownerApproval: { owner: "decision-owner", approvedAt: "2026-07-16" }
      }
    ],
    proposals: [proposal({ outcomeIds: ["O1@2"] })]
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.findings, []);
});

test("harmless compact low-stakes proposal proceeds", () => {
  const result = validateDecisionRecord({ outcomes: [outcome], proposals: [proposal()] });

  assert.equal(result.valid, true);
  assert.deepEqual(result.findings, []);
});

test("untraced proposal may be safely rejected without blocking", () => {
  const result = validateDecisionRecord({
    outcomes: [outcome],
    proposals: [proposal({ outcomeIds: [], disposition: "REJECT" })]
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.findings, [
    { code: "UNTRACED_PROPOSAL", ref: "A-P1", blocking: false }
  ]);
});

test("independent advisor proposal IDs must be namespaced and unique", () => {
  const result = validateDecisionRecord({
    outcomes: [outcome],
    proposals: [proposal({ id: "P1" }), proposal({ id: "P1" })]
  });

  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "UNTRACED_PROPOSAL"));
});
