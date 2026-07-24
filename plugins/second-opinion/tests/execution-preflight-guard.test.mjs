import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePreflight, reconcileUsage } from "../scripts/execution-preflight-guard.mjs";

function participant(overrides = {}) {
  return {
    id: "advisor-a",
    requested: { model: "model-a", effort: "high" },
    effective: { model: "model-a", effort: "high", effortSupported: true },
    verification: {
      model: { state: "VERIFIED", sourceType: "RUNTIME", source: "runtime", verifiedAt: "2026-07-15" },
      effort: { state: "VERIFIED", sourceType: "RUNTIME", source: "runtime", verifiedAt: "2026-07-15" },
      callability: { state: "VERIFIED", sourceType: "PROBE", source: "probe", verifiedAt: "2026-07-15" }
    },
    callable: true,
    authenticated: true,
    estimatedInputTokens: 100,
    reasoningTokenLimit: 200,
    outputTokenLimit: 300,
    contextLimit: 1000,
    ...overrides
  };
}

function record(participants = [participant()], policy = {}) {
  return { participants, policy: { stakes: "CONSEQUENTIAL", tokenCeiling: 2000, ...policy } };
}

test("successful preflight exposes bounded calls and tokens", () => {
  const result = evaluatePreflight(record());
  assert.equal(result.status, "PASS");
  assert.equal(result.maximumCalls, 2);
  assert.equal(result.maximumTokens, 1200);
});

test("model mismatch and silent fallback block dispatch", () => {
  for (const effective of [
    { model: "model-b", effort: "high", effortSupported: true },
    { model: "model-a", effort: "high", effortSupported: true, fallbackFrom: "model-z" }
  ]) {
    const result = evaluatePreflight(record([participant({ effective })]));
    assert.equal(result.status, "BLOCKED");
    assert.equal(result.dispatchAllowed, false);
  }
});

test("unsupported or mismatched effort blocks dispatch", () => {
  const result = evaluatePreflight(record([participant({ effective: { model: "model-a", effort: "medium", effortSupported: false } })]));
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.findings.some((item) => item.code === "UNSUPPORTED_EFFORT"));
});

test("unverified metadata blocks consequential but degrades low stakes", () => {
  const p = participant({ verification: {} });
  assert.equal(evaluatePreflight(record([p])).status, "BLOCKED");
  assert.equal(evaluatePreflight(record([p], { stakes: "LOW", stakesApproval: { owner: "owner", approvedAt: "2026-07-15" } })).status, "DEGRADED");
});

test("config-sourced VERIFIED claims remain unverified", () => {
  const verification = participant().verification;
  verification.model = { state: "VERIFIED", sourceType: "CONFIG", source: "config" };
  assert.equal(evaluatePreflight(record([participant({ verification })])).status, "BLOCKED");
});

test("budget excess requires explicit authorization", () => {
  assert.equal(evaluatePreflight(record(undefined, { tokenCeiling: 100 })).status, "AUTHORIZATION_REQUIRED");
  assert.equal(evaluatePreflight(record(undefined, { tokenCeiling: 100, authorization: { approved: true } })).status, "AUTHORIZATION_REQUIRED");
  assert.equal(evaluatePreflight(record(undefined, { tokenCeiling: 100, authorization: { approved: true, owner: "owner", approvedAt: "2026-07-15" } })).status, "PASS");
});

test("missing token ceiling blocks instead of silently passing", () => {
  assert.equal(evaluatePreflight(record(undefined, { tokenCeiling: undefined })).status, "BLOCKED");
});

test("retry and round limits are bounded and overflow-safe", () => {
  assert.equal(evaluatePreflight(record(undefined, { maxRounds: -1 })).status, "BLOCKED");
  assert.equal(evaluatePreflight(record(undefined, { maxRounds: Number.MAX_SAFE_INTEGER, maxRetries: 2 })).status, "BLOCKED");
});

test("post-run usage records missing and material variance", () => {
  const preflight = evaluatePreflight(record());
  assert.equal(reconcileUsage(preflight, {}).status, "UNVERIFIED");
  assert.equal(reconcileUsage(preflight, { actualTokens: 1300 }).status, "BUDGET_BREACH");
  assert.equal(reconcileUsage(preflight, { actualTokens: 700, expectedTokens: 400 }).status, "MATERIAL_VARIANCE");
});

// --- #78 B-P28: cost estimates need versioned pricing provenance ------------

const validProvenance = {
  source: "https://provider.example/pricing",
  currency: "USD",
  retrievedAt: "2026-07-20",
  models: ["model-a"]
};

function costRecord(provenanceOverrides, policyOverrides = {}) {
  return {
    ...record(undefined, {
      costCeiling: 10,
      estimatedMaximumCost: 5,
      costProvenance: provenanceOverrides === null ? undefined : { ...validProvenance, ...provenanceOverrides },
      ...policyOverrides
    }),
    evaluatedAt: "2026-07-23"
  };
}

test("valid current pricing provenance passes", () => {
  const result = evaluatePreflight(costRecord({}));
  assert.equal(result.status, "PASS");
  assert.ok(!result.findings.some((f) => f.code === "UNVERIFIED_COST"));
});

test("a cost estimate without provenance blocks consequential stakes and degrades LOW", () => {
  const missing = evaluatePreflight(costRecord(null));
  assert.equal(missing.status, "BLOCKED");
  assert.ok(missing.findings.some((f) => f.code === "UNVERIFIED_COST"));

  const low = evaluatePreflight(
    costRecord(null, { stakes: "LOW", stakesApproval: { owner: "owner", approvedAt: "2026-07-15" } })
  );
  assert.equal(low.status, "DEGRADED");
});

test("incomplete, stale, or future-dated provenance is unverified cost", () => {
  for (const bad of [
    { source: "" },
    { currency: undefined },
    { retrievedAt: "not-a-date" },
    { retrievedAt: "2026-05-01" }, // > 30 days before evaluatedAt 2026-07-23
    { retrievedAt: "2026-08-01" }, // in the future relative to evaluatedAt
    { models: [] } // no price mapping for the effective model
  ]) {
    const result = evaluatePreflight(costRecord(bad));
    assert.equal(result.status, "BLOCKED", JSON.stringify(bad));
    assert.ok(result.findings.some((f) => f.code === "UNVERIFIED_COST"), JSON.stringify(bad));
  }
});

test("a cost estimate must be a finite non-negative number", () => {
  for (const badEstimate of ["5", -5, Number.NaN, Infinity]) {
    const result = evaluatePreflight(costRecord({}, { estimatedMaximumCost: badEstimate }));
    assert.equal(result.status, "BLOCKED", String(badEstimate));
    assert.ok(result.findings.some((f) => f.code === "UNVERIFIED_COST"), String(badEstimate));
  }
});

test("cost ceiling excess with valid provenance still requires authorization", () => {
  const result = evaluatePreflight(costRecord({}, { estimatedMaximumCost: 50 }));
  assert.equal(result.status, "AUTHORIZATION_REQUIRED");
  assert.ok(result.findings.some((f) => f.code === "COST_CEILING_EXCEEDED"));
});
