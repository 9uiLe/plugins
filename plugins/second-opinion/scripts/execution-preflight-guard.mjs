#!/usr/bin/env node

const VERIFIED = "VERIFIED";

const finding = (code, participantId, message) => ({ code, participantId: participantId || null, message });
const finiteInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const presentString = (value) => typeof value === "string" && value.trim() !== "";
const validDate = (value) => presentString(value) && !Number.isNaN(Date.parse(value));
const finiteNonNegativeNumber = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
// Pricing provenance older than this is stale and must be re-verified
// (references/model-routing.md: recheck records older than 30 days).
const PRICING_STALE_DAYS = 30;

// Cost estimates need versioned pricing provenance (#78 B-P28): a bare number
// with no source, date, currency, or per-model price mapping is a fabricated
// value, not an estimate. Returns a list of problems (empty = valid).
function costProvenanceProblems(policy, participants, asOfMs) {
  const provenance = policy.costProvenance;
  const problems = [];
  if (!provenance || typeof provenance !== "object") return ["costProvenance record is missing"];
  if (!presentString(provenance.source)) problems.push("pricing source missing");
  if (!presentString(provenance.currency)) problems.push("currency missing");
  const versionDate = provenance.retrievedAt ?? provenance.pricingVersion;
  if (!validDate(versionDate)) problems.push("versioned pricing date (retrievedAt/pricingVersion) missing or invalid");
  else if (Date.parse(versionDate) < asOfMs - PRICING_STALE_DAYS * 24 * 60 * 60 * 1000) {
    problems.push(`pricing provenance is stale (older than ${PRICING_STALE_DAYS} days)`);
  } else if (Date.parse(versionDate) > asOfMs) {
    problems.push("pricing provenance date is in the future");
  }
  const mappedModels = Array.isArray(provenance.models) ? provenance.models : [];
  const unmapped = participants
    .map((participant) => participant?.effective?.model)
    .filter((model, index, all) => presentString(model) && all.indexOf(model) === index)
    .filter((model) => !mappedModels.includes(model));
  if (unmapped.length) problems.push(`no price mapping for model(s): ${unmapped.join(", ")}`);
  return problems;
}

function checkedMultiply(values) {
  let result = 1;
  for (const value of values) {
    if (!finiteInteger(value) || (value !== 0 && result > Number.MAX_SAFE_INTEGER / value)) return null;
    result *= value;
  }
  return result;
}

export function evaluatePreflight(record) {
  const participants = Array.isArray(record?.participants) ? record.participants : [];
  const policy = record?.policy || {};
  const findings = [];
  const rounds = policy.maxRounds ?? 2;
  const retries = policy.maxRetries ?? 0;
  const fallbacks = policy.maxFallbacks ?? 0;
  if (!participants.length) findings.push(finding("NO_PARTICIPANTS", null, "At least one participant is required"));
  for (const [name, value] of Object.entries({ rounds, retries, fallbacks })) {
    if (!finiteInteger(value) || (name === "rounds" && value < 1)) findings.push(finding("INVALID_LIMIT", null, `${name} must be bounded`));
  }
  const attempts = checkedMultiply([rounds, 1 + retries + fallbacks]);
  if (attempts === null) findings.push(finding("USAGE_OVERFLOW", null, "Call bound exceeds safe arithmetic"));
  let maximumTokens = 0;
  for (const participant of participants) {
    const id = participant.id;
    const requested = participant.requested || {};
    const effective = participant.effective || {};
    const verification = participant.verification || {};
    if (participant.callable !== true || participant.authenticated === false) findings.push(finding("NOT_CALLABLE", id, "Not callable/authenticated"));
    if (effective.fallbackFrom) findings.push(finding("SILENT_FALLBACK", id, "Fallback needs a new identity and preflight"));
    if (requested.model !== effective.model) findings.push(finding("MODEL_MISMATCH", id, "Requested and effective model differ"));
    if (requested.effort !== effective.effort) findings.push(finding("EFFORT_MISMATCH", id, "Requested and effective effort differ"));
    if (effective.effortSupported === false) findings.push(finding("UNSUPPORTED_EFFORT", id, "Effort unsupported or ignored"));
    const unverified = ["model", "effort", "callability"].filter((field) => {
      const item = verification[field];
      return item?.state !== VERIFIED || !["RUNTIME", "PROBE"].includes(item?.sourceType);
    });
    if (unverified.length) findings.push(finding("UNVERIFIED_METADATA", id, unverified.join(", ")));
    const values = [participant.estimatedInputTokens, participant.reasoningTokenLimit ?? 0, participant.outputTokenLimit];
    if (!values.every(finiteInteger)) {
      findings.push(finding("UNBOUNDED_TOKENS", id, "Finite token limits are required"));
      continue;
    }
    const perCall = values.reduce((sum, value) => sum + value, 0);
    if (!Number.isSafeInteger(perCall) || attempts === null || perCall > Number.MAX_SAFE_INTEGER / attempts) {
      findings.push(finding("USAGE_OVERFLOW", id, "Token bound exceeds safe arithmetic"));
      continue;
    }
    maximumTokens += perCall * attempts;
    if (!Number.isSafeInteger(maximumTokens)) findings.push(finding("USAGE_OVERFLOW", id, "Council token bound overflowed"));
    if (finiteInteger(participant.contextLimit) && perCall > participant.contextLimit) findings.push(finding("CONTEXT_EXCEEDED", id, "Evidence plus reserves exceed context"));
  }
  if (!finiteInteger(policy.tokenCeiling)) findings.push(finding("MISSING_TOKEN_CEILING", null, "A finite token ceiling is required"));
  else if (maximumTokens > policy.tokenCeiling) findings.push(finding("TOKEN_CEILING_EXCEEDED", null, "Token ceiling exceeded"));
  if (policy.stakes === "LOW" && (!policy.stakesApproval?.owner || !policy.stakesApproval?.approvedAt)) findings.push(finding("UNVERIFIED_STAKES", null, "Low-stakes degradation requires owner provenance"));
  if (policy.costCeiling != null) {
    if (policy.estimatedMaximumCost == null) findings.push(finding("UNVERIFIED_COST", null, "Cost estimate and provenance required"));
    else if (!finiteNonNegativeNumber(policy.estimatedMaximumCost)) findings.push(finding("UNVERIFIED_COST", null, "Cost estimate must be a finite non-negative number"));
    else {
      const asOfMs = validDate(record?.evaluatedAt) ? Date.parse(record.evaluatedAt) : Date.now();
      const problems = costProvenanceProblems(policy, participants, asOfMs);
      if (problems.length) findings.push(finding("UNVERIFIED_COST", null, `Pricing provenance invalid: ${problems.join("; ")}`));
      else if (policy.estimatedMaximumCost > policy.costCeiling) findings.push(finding("COST_CEILING_EXCEEDED", null, "Cost ceiling exceeded"));
    }
  }
  const has = (...codes) => findings.some((item) => codes.includes(item.code));
  const mismatch = has("MODEL_MISMATCH", "EFFORT_MISMATCH", "UNSUPPORTED_EFFORT", "SILENT_FALLBACK", "NOT_CALLABLE", "CONTEXT_EXCEEDED", "INVALID_LIMIT", "USAGE_OVERFLOW", "UNBOUNDED_TOKENS", "NO_PARTICIPANTS", "MISSING_TOKEN_CEILING", "UNVERIFIED_STAKES");
  const excess = has("TOKEN_CEILING_EXCEEDED", "COST_CEILING_EXCEEDED");
  const unverified = has("UNVERIFIED_METADATA", "UNVERIFIED_COST");
  let status = "PASS";
  if (mismatch || (policy.stakes !== "LOW" && unverified)) status = "BLOCKED";
  else if (excess) status = policy.authorization?.approved === true && policy.authorization?.owner && policy.authorization?.approvedAt ? "PASS" : "AUTHORIZATION_REQUIRED";
  else if (unverified) status = "DEGRADED";
  return { status, dispatchAllowed: status === "PASS" || status === "DEGRADED", maximumTokens, maximumCalls: attempts === null ? null : participants.length * attempts, findings };
}

export function reconcileUsage(preflight, usage) {
  if (usage?.actualTokens == null) return { status: "UNVERIFIED", variance: null };
  if (!finiteInteger(usage.actualTokens)) return { status: "INVALID_USAGE", variance: null };
  const expected = usage.expectedTokens ?? preflight.expectedTokens ?? preflight.maximumTokens;
  const variance = usage.actualTokens - expected;
  const ratio = expected === 0 ? (usage.actualTokens === 0 ? 1 : Infinity) : usage.actualTokens / expected;
  const status = usage.actualTokens > preflight.maximumTokens ? "BUDGET_BREACH" : ratio > (usage.materialVarianceRatio ?? 1.25) ? "MATERIAL_VARIANCE" : "OK";
  return { status, variance, ratio };
}

async function main() {
  if (process.argv[1] !== new URL(import.meta.url).pathname) return;
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const result = evaluatePreflight(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.dispatchAllowed ? 0 : 1;
}
main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 2; });
