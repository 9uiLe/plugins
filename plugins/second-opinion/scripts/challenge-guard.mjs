#!/usr/bin/env node

const CHANGE_BASES = new Set(["NEW_EVIDENCE", "OVERLOOKED_EVIDENCE", "LOGICAL_ERROR", "OPTION_CORRECTION"]);
const EVIDENCE_BASES = new Set(["NEW_EVIDENCE", "OVERLOOKED_EVIDENCE"]);

function present(value) {
  return value !== undefined && value !== null && value !== "";
}

export function evaluateChallengeAudit(record) {
  const findings = [];
  const advisors = Array.isArray(record?.advisors) ? record.advisors : [];
  if (!advisors.length) findings.push({ code: "MISSING_CHALLENGE_AUDIT", ref: "record", blocking: true });

  const effectivePositions = advisors.map((advisor) => {
    const challenge = advisor.challenge || {};
    let effectiveRecommendation = advisor.roundOneRecommendation;
    if (!present(advisor.id) || !present(advisor.roundOneRecommendation) || typeof challenge.recommendationChanged !== "boolean" || !Array.isArray(challenge.evidenceIds) || !Array.isArray(challenge.acceptedConcerns) || !present(challenge.confidence) || !present(challenge.changeBasis)) {
      findings.push({ code: "MISSING_CHALLENGE_AUDIT", ref: advisor.id || "advisor", blocking: true });
    } else if (!challenge.recommendationChanged && present(challenge.recommendation) && challenge.recommendation !== advisor.roundOneRecommendation) {
      findings.push({ code: "INCONSISTENT_CHANGE_FLAG", ref: advisor.id, blocking: true });
    } else if (challenge.recommendationChanged) {
      const validBasis = CHANGE_BASES.has(challenge.changeBasis);
      const validSupport = EVIDENCE_BASES.has(challenge.changeBasis)
        ? Array.isArray(challenge.evidenceIds) && challenge.evidenceIds.length > 0
        : present(challenge.reasoning);
      if (!validBasis || !present(challenge.recommendation) || challenge.recommendation === advisor.roundOneRecommendation) {
        findings.push({ code: "INVALID_RECOMMENDATION_CHANGE", ref: advisor.id, blocking: false });
      } else if (!validSupport) {
        findings.push({ code: "INVALID_CHANGE_SUPPORT", ref: advisor.id, blocking: false });
      } else {
        effectiveRecommendation = challenge.recommendation;
      }
    }
    if (present(challenge.effectiveRecommendation) && challenge.effectiveRecommendation !== effectiveRecommendation) {
      findings.push({ code: "INVALID_EFFECTIVE_RECOMMENDATION", ref: advisor.id, blocking: true });
    }
    return { id: advisor.id, roundOneRecommendation: advisor.roundOneRecommendation, effectiveRecommendation };
  });

  const roundOneLabels = advisors.map((advisor) => advisor.roundOneRecommendation).sort();
  const challengeLabels = advisors.map((advisor) => advisor.challenge?.recommendation).sort();
  const crossSwitch = advisors.length >= 2 &&
    advisors.every((advisor) => advisor.challenge?.recommendationChanged === true) &&
    advisors.every((advisor) => advisor.challenge?.recommendation !== advisor.roundOneRecommendation) &&
    JSON.stringify(roundOneLabels) === JSON.stringify(challengeLabels);
  if (crossSwitch) findings.push({ code: "CROSS_SWITCH", ref: "panel", blocking: false });
  if (crossSwitch && record.claimedConvergence === true) {
    findings.push({ code: "CROSS_SWITCH_NOT_CONVERGENCE", ref: "synthesis", blocking: true });
  }

  const safeToSynthesize = !findings.some((finding) => finding.blocking);
  const protocolClean = findings.length === 0;
  return {
    valid: safeToSynthesize,
    safeToSynthesize,
    protocolClean,
    convergence: crossSwitch ? false : record.claimedConvergence === true,
    crossSwitch,
    effectivePositions,
    findings
  };
}

async function main() {
  if (process.argv[1] !== new URL(import.meta.url).pathname) return;
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const result = evaluateChallengeAudit(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.valid ? 0 : 1;
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
});
