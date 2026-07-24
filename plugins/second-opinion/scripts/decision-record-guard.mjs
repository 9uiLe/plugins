const OUTCOME_STATUSES = new Set(["ACTIVE", "REVISED", "RETIRED"]);
const PROPOSAL_TYPES = new Set(["MEANS", "CONSTRAINT", "TEST", "OUTCOME_CHANGE"]);
const DISPOSITIONS = new Set(["ACCEPT", "REJECT", "DEFER", "CONDITIONAL"]);
// Record-contract confidence scale (references/decision-record.md), ordered.
const CONFIDENCE_LEVELS = ["LOW", "MEDIUM", "MEDIUM-HIGH", "HIGH"];

// confidenceRank — normalized ordering for a confidence value: either the
// qualitative record-contract scale (LOW < MEDIUM < MEDIUM-HIGH < HIGH) or a
// numeric 0-100 judgment. Lexicographic string comparison is exactly wrong
// for the qualitative labels ("HIGH" < "LOW"), which made the drift check
// fire on decreases and miss increases (#78 B-P29). Returns null for values
// outside both schemes (fail closed).
function confidenceRank(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) {
    return { scheme: "numeric", rank: value };
  }
  if (typeof value === "string") {
    const index = CONFIDENCE_LEVELS.indexOf(value.trim().toUpperCase());
    if (index >= 0) return { scheme: "qualitative", rank: index };
  }
  return null;
}

function outcomeVersionRef(outcome) {
  return `${outcome.id}@${outcome.version}`;
}

function sameValues(a = [], b = []) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

function present(value) {
  return value !== undefined && value !== null && value !== "";
}

function array(value) {
  return Array.isArray(value);
}

function validApproval(approval) {
  return present(approval?.owner) && present(approval?.approvedAt);
}

export function validateDecisionRecord(record) {
  const findings = [];
  const outcomes = record.outcomes ?? [];
  const proposals = record.proposals ?? [];
  const linkChanges = record.linkChanges ?? [];
  const acceptedTraces = record.acceptedTraces ?? [];
  const outcomeByRef = new Map();
  const active = new Set();

  if (!new Set(["FULL", "COMPACT"]).has(record.mode) || outcomes.length === 0 || proposals.length === 0) {
    findings.push({ code: "UNTRACED_PROPOSAL", ref: "record", blocking: true });
  }

  for (const outcome of outcomes) {
    const versionRef = outcomeVersionRef(outcome);
    const required = [
      outcome.id,
      outcome.version,
      outcome.beneficiary,
      outcome.baseline,
      outcome.target,
      outcome.failureCondition,
      outcome.acceptedTradeoffs,
      outcome.horizon,
      outcome.observationMethod,
      outcome.authority,
      outcome.status,
      outcome.proposer
    ];
    if (required.some((value) => !present(value)) || !OUTCOME_STATUSES.has(outcome.status)) {
      findings.push({ code: "UNAUTHORIZED_OUTCOME_CHANGE", ref: versionRef, blocking: true });
    }
    if (outcomeByRef.has(versionRef) || !validApproval(outcome.ownerApproval)) {
      findings.push({ code: "UNAUTHORIZED_OUTCOME_CHANGE", ref: versionRef, blocking: true });
    }
    outcomeByRef.set(versionRef, outcome);
    if (outcome.status === "ACTIVE") active.add(versionRef);
  }

  for (const outcome of outcomes) {
    if (outcome.version <= 1) continue;
    const expectedPrior = `${outcome.id}@${outcome.version - 1}`;
    const prior = outcomeByRef.get(outcome.priorVersion);
    if (outcome.priorVersion !== expectedPrior || !prior || prior.status !== "REVISED") {
      findings.push({
        code: "UNAUTHORIZED_OUTCOME_CHANGE",
        ref: outcomeVersionRef(outcome),
        blocking: true
      });
    }
  }

  const logicalIds = new Set(outcomes.map((outcome) => outcome.id));
  for (const id of logicalIds) {
    const activeCount = outcomes.filter(
      (outcome) => outcome.id === id && outcome.status === "ACTIVE"
    ).length;
    const retired = outcomes.some(
      (outcome) => outcome.id === id && outcome.status === "RETIRED"
    );
    if ((!retired && activeCount !== 1) || (retired && activeCount > 0)) {
      findings.push({ code: "UNAUTHORIZED_OUTCOME_CHANGE", ref: id, blocking: true });
    }
  }

  const proposalIds = new Set();
  for (const proposal of proposals) {
    const required = [
      proposal.id,
      proposal.source,
      proposal.type,
      proposal.expectedContribution,
      proposal.disposition,
      proposal.dispositionReason,
      proposal.owner,
      proposal.trigger,
      proposal.verification
    ];
    if (
      required.some((value) => !present(value)) ||
      !array(proposal.relatedProposalIds) ||
      !array(proposal.initialOutcomeIds) ||
      !array(proposal.outcomeIds) ||
      !array(proposal.evidenceIds) ||
      proposal.evidenceIds.length === 0 ||
      !array(proposal.negativeEffects) ||
      !PROPOSAL_TYPES.has(proposal.type) ||
      !DISPOSITIONS.has(proposal.disposition)
    ) {
      findings.push({ code: "UNTRACED_PROPOSAL", ref: proposal.id ?? "unknown", blocking: true });
    }
    if (proposalIds.has(proposal.id) || !/^[A-Z][A-Z0-9_-]*-P\d+$/.test(proposal.id ?? "")) {
      findings.push({ code: "UNTRACED_PROPOSAL", ref: proposal.id, blocking: true });
    }
    proposalIds.add(proposal.id);

    const activeLinks = (proposal.outcomeIds ?? []).filter((id) => active.has(id));
    if (activeLinks.length === 0) {
      const safelyDisposed = proposal.disposition === "REJECT" || proposal.disposition === "DEFER";
      findings.push({ code: "UNTRACED_PROPOSAL", ref: proposal.id, blocking: !safelyDisposed });
    }

    if (proposal.successRelation === "MEANS_COMPLETION") {
      findings.push({ code: "MEANS_AS_GOAL", ref: proposal.id, blocking: true });
    }

    // Confidence drift (#78 B-P29). The history is REQUIRED — omitting it must
    // not silently skip the check. Values are compared on the normalized scale
    // (one scheme per history: qualitative labels or numeric 0-100); unknown
    // values or mixed schemes fail closed. Every history evidence id must be a
    // non-empty string traceable to the proposal's authoritative evidence set
    // (an increase "justified" by E999 or null is fabricated, not evidenced).
    // An increase demands NEW causal evidence (at least one evidence id absent
    // from the previous entry); a decrease is always legitimate.
    const history = proposal.confidenceHistory;
    const authoritativeEvidence = new Set(array(proposal.evidenceIds) ? proposal.evidenceIds : []);
    const traceableId = (id) => present(id) && typeof id === "string" && authoritativeEvidence.has(id);
    if (!array(history) || history.length === 0) {
      findings.push({ code: "INVALID_CONFIDENCE", ref: proposal.id, blocking: true });
    } else {
      const ranks = history.map((entry) => confidenceRank(entry?.value));
      const schemes = new Set(ranks.map((rank) => rank?.scheme));
      if (
        ranks.some((rank) => rank === null) ||
        schemes.size > 1 ||
        history.some((entry) => !array(entry?.evidenceIds) || !entry.evidenceIds.every(traceableId))
      ) {
        findings.push({ code: "INVALID_CONFIDENCE", ref: proposal.id, blocking: true });
      } else {
        for (let index = 1; index < history.length; index += 1) {
          const increased = ranks[index].rank > ranks[index - 1].rank;
          const previousEvidence = history[index - 1].evidenceIds;
          const newEvidence = history[index].evidenceIds.some((id) => !previousEvidence.includes(id));
          if (increased && !newEvidence) {
            findings.push({ code: "MEANS_AS_GOAL", ref: proposal.id, blocking: true });
          }
        }
      }
    }

    for (const effect of proposal.negativeEffects ?? []) {
      if (!active.has(effect.outcomeId) || !validApproval(effect.authorization)) {
        findings.push({ code: "HIDDEN_TRADEOFF", ref: proposal.id, blocking: true });
      }
    }

    if (proposal.type === "OUTCOME_CHANGE" && !validApproval(proposal.ownerApproval)) {
      findings.push({ code: "UNAUTHORIZED_OUTCOME_CHANGE", ref: proposal.id, blocking: true });
    }

    const proposalLinkChanges = linkChanges
      .filter((change) => change.proposalId === proposal.id)
      .sort((a, b) => a.revision - b.revision);
    let currentLinks = proposal.initialOutcomeIds ?? [];
    let audited = proposalLinkChanges.length === (proposal.linkRevision ?? 0);
    proposalLinkChanges.forEach((change, index) => {
      const validChange =
        change.revision === index + 1 &&
        present(change.round) &&
        present(change.author) &&
        present(change.basis) &&
        array(change.evidenceIds) &&
        change.evidenceIds.length > 0 &&
        sameValues(change.priorOutcomeIds, currentLinks);
      audited &&= validChange;
      currentLinks = change.newOutcomeIds ?? [];
    });
    audited &&= sameValues(currentLinks, proposal.outcomeIds);
    if (!audited) {
        findings.push({ code: "UNAUTHORIZED_OUTCOME_CHANGE", ref: proposal.id, blocking: true });
    }

    if (proposal.disposition === "ACCEPT" || proposal.disposition === "CONDITIONAL") {
      const trace = acceptedTraces.find((candidate) => candidate.proposalId === proposal.id);
      if (
        !trace ||
        !sameValues(trace.evidenceIds, proposal.evidenceIds) ||
        !sameValues(trace.outcomeIds, proposal.outcomeIds) ||
        trace.expectedContribution !== proposal.expectedContribution ||
        !present(trace.observation) ||
        !present(trace.owner)
      ) {
        findings.push({ code: "UNTRACED_PROPOSAL", ref: proposal.id, blocking: true });
      }
    }
  }

  return {
    valid: !findings.some((finding) => finding.blocking),
    findings
  };
}
