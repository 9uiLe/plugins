function ref(outcome) {
  return `${outcome.id}@${outcome.version}`;
}

function sameEvidence(a = [], b = []) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

export function validateDecisionRecord(record) {
  const findings = [];
  const active = new Set();
  const versions = new Set();

  for (const outcome of record.outcomes ?? []) {
    const versionRef = ref(outcome);
    if (versions.has(versionRef)) {
      findings.push({ code: "UNAUTHORIZED_OUTCOME_CHANGE", ref: versionRef, blocking: true });
    }
    versions.add(versionRef);

    if (outcome.status === "ACTIVE") {
      active.add(versionRef);
      if (!outcome.ownerApproval) {
        findings.push({ code: "UNAUTHORIZED_OUTCOME_CHANGE", ref: versionRef, blocking: true });
      }
    }
    if (outcome.version > 1 && (!outcome.priorVersion || !outcome.ownerApproval)) {
      findings.push({ code: "UNAUTHORIZED_OUTCOME_CHANGE", ref: versionRef, blocking: true });
    }
  }

  const activeByLogicalId = new Map();
  for (const versionRef of active) {
    const id = versionRef.split("@")[0];
    activeByLogicalId.set(id, (activeByLogicalId.get(id) ?? 0) + 1);
  }
  for (const [id, count] of activeByLogicalId) {
    if (count !== 1) {
      findings.push({ code: "UNAUTHORIZED_OUTCOME_CHANGE", ref: id, blocking: true });
    }
  }

  const proposalIds = new Set();
  for (const proposal of record.proposals ?? []) {
    if (proposalIds.has(proposal.id) || !/^[A-Z][A-Z0-9_-]*-P\d+$/.test(proposal.id)) {
      findings.push({ code: "UNTRACED_PROPOSAL", ref: proposal.id, blocking: true });
    }
    proposalIds.add(proposal.id);

    const activeLinks = (proposal.outcomeIds ?? []).filter((id) => active.has(id));
    if (activeLinks.length === 0) {
      const safelyDisposed = proposal.disposition === "REJECT" || proposal.disposition === "DEFER";
      findings.push({ code: "UNTRACED_PROPOSAL", ref: proposal.id, blocking: !safelyDisposed });
    }

    if (proposal.meansAsGoal) {
      findings.push({ code: "MEANS_AS_GOAL", ref: proposal.id, blocking: true });
    }

    const history = proposal.confidenceHistory ?? [];
    for (let index = 1; index < history.length; index += 1) {
      const before = history[index - 1];
      const after = history[index];
      if (after.value > before.value && sameEvidence(before.evidenceIds, after.evidenceIds)) {
        findings.push({ code: "MEANS_AS_GOAL", ref: proposal.id, blocking: true });
      }
    }

    for (const effect of proposal.negativeEffects ?? []) {
      if (!effect.authorization) {
        findings.push({ code: "HIDDEN_TRADEOFF", ref: proposal.id, blocking: true });
      }
    }

    if (proposal.type === "OUTCOME_CHANGE" && !proposal.ownerApproved) {
      findings.push({ code: "UNAUTHORIZED_OUTCOME_CHANGE", ref: proposal.id, blocking: true });
    }

    if (
      (proposal.disposition === "ACCEPT" || proposal.disposition === "CONDITIONAL") &&
      (!proposal.dispositionReason || !proposal.verification)
    ) {
      findings.push({ code: "UNTRACED_PROPOSAL", ref: proposal.id, blocking: true });
    }
  }

  return {
    valid: !findings.some((finding) => finding.blocking),
    findings
  };
}
