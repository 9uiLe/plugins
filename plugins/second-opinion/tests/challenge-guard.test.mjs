import assert from "node:assert/strict";
import test from "node:test";

import { evaluateChallengeAudit } from "../scripts/challenge-guard.mjs";

function advisor(id, roundOneRecommendation, challenge = {}) {
  return { id, roundOneRecommendation, challenge: { recommendationChanged: false, changeBasis: "NONE", evidenceIds: [], acceptedConcerns: [], confidence: 60, ...challenge } };
}

test("persuasion-only change is invalid and retains round-one recommendation", () => {
  const result = evaluateChallengeAudit({ advisors: [advisor("A", "OPTION_A", { recommendationChanged: true, recommendation: "OPTION_B", changeBasis: "PERSUASION_ONLY" })] });
  assert.equal(result.valid, true);
  assert.equal(result.safeToSynthesize, true);
  assert.equal(result.protocolClean, false);
  assert.equal(result.effectivePositions[0].effectiveRecommendation, "OPTION_A");
  assert.ok(result.findings.some((finding) => finding.code === "INVALID_RECOMMENDATION_CHANGE"));
});

test("unsupported change evidence is distinguished from persuasion", () => {
  const result = evaluateChallengeAudit({ advisors: [advisor("A", "OPTION_A", { recommendationChanged: true, recommendation: "OPTION_B", changeBasis: "NEW_EVIDENCE" })] });
  assert.ok(result.findings.some((finding) => finding.code === "INVALID_CHANGE_SUPPORT"));
  assert.equal(result.effectivePositions[0].effectiveRecommendation, "OPTION_A");
});

test("synthesis cannot use a persuasion-only switch as effective", () => {
  const result = evaluateChallengeAudit({ advisors: [advisor("A", "OPTION_A", { recommendationChanged: true, recommendation: "OPTION_B", effectiveRecommendation: "OPTION_B", changeBasis: "PERSUASION_ONLY" })] });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "INVALID_EFFECTIVE_RECOMMENDATION"));
});

for (const changeBasis of ["NEW_EVIDENCE", "OVERLOOKED_EVIDENCE"]) {
  test(`${changeBasis} permits a change with evidence`, () => {
    const result = evaluateChallengeAudit({ advisors: [advisor("A", "OPTION_A", { recommendationChanged: true, recommendation: "OPTION_B", changeBasis, evidenceIds: ["E2"] })] });
    assert.equal(result.valid, true);
    assert.equal(result.effectivePositions[0].effectiveRecommendation, "OPTION_B");
  });
}

for (const changeBasis of ["LOGICAL_ERROR", "OPTION_CORRECTION"]) {
  test(`${changeBasis} permits a change with concrete reasoning`, () => {
    const result = evaluateChallengeAudit({ advisors: [advisor("A", "OPTION_A", { recommendationChanged: true, recommendation: "OPTION_B", changeBasis, reasoning: "The original inference reverses the stated constraint" })] });
    assert.equal(result.valid, true);
  });
}

test("confidence and accepted concerns may change without position change", () => {
  const result = evaluateChallengeAudit({ advisors: [advisor("A", "OPTION_A", { confidence: 35, acceptedConcerns: ["B-C1"] })] });
  assert.equal(result.valid, true);
  assert.equal(result.effectivePositions[0].effectiveRecommendation, "OPTION_A");
});

test("changed flag must agree with the stated challenge recommendation", () => {
  const result = evaluateChallengeAudit({ advisors: [advisor("A", "OPTION_A", { recommendation: "OPTION_B" })] });
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "INCONSISTENT_CHANGE_FLAG"));
});

test("cross-switch is recorded but cannot be claimed as convergence", () => {
  const result = evaluateChallengeAudit({
    claimedConvergence: true,
    advisors: [
      advisor("A", "OPTION_A", { recommendationChanged: true, recommendation: "OPTION_B", changeBasis: "NEW_EVIDENCE", evidenceIds: ["E2"] }),
      advisor("B", "OPTION_B", { recommendationChanged: true, recommendation: "OPTION_A", changeBasis: "LOGICAL_ERROR", reasoning: "Constraint ordering was reversed" })
    ]
  });
  assert.equal(result.crossSwitch, true);
  assert.equal(result.convergence, false);
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.code === "CROSS_SWITCH_NOT_CONVERGENCE"));
});

test("multi-advisor recommendation rotation is also cross-switch, not convergence", () => {
  const result = evaluateChallengeAudit({
    claimedConvergence: true,
    advisors: [
      advisor("A", "A", { recommendationChanged: true, recommendation: "B", changeBasis: "LOGICAL_ERROR", reasoning: "r" }),
      advisor("B", "B", { recommendationChanged: true, recommendation: "C", changeBasis: "LOGICAL_ERROR", reasoning: "r" }),
      advisor("C", "C", { recommendationChanged: true, recommendation: "A", changeBasis: "LOGICAL_ERROR", reasoning: "r" })
    ]
  });
  assert.equal(result.crossSwitch, true);
  assert.equal(result.safeToSynthesize, false);
});
