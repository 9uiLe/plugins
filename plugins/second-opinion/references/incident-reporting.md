# Decision Council incident reporting

Report failures that reveal a reusable defect in the skill, prompt contract, adapter, model-routing policy, or degradation behavior. Do not file ordinary disagreement with a council recommendation unless a protocol invariant was violated or the case exposes a reproducible design weakness.

## Reportable cases

- Outcome or evidence readiness was `FAIL`, but deliberation or execution continued.
- The council optimized the requested means while misunderstanding the desired outcome.
- A material advisor concern disappeared without a disposition.
- First-round independence was contaminated or overstated.
- A failed/fallback model was presented under the requested identity.
- Advice triggered edits or external actions without authority.
- The chair decided by vote, prestige, or confidence rather than evidence.
- Low-stakes use became repeatedly blocked by redundant questions or ceremony.
- The same input produces a reproducible schema, routing, or stop-condition failure.

## Capture safely

Record:

```markdown
Title: [Decision Council] <short observable failure>

Plugin/skill version or commit:
Host and OS:
Models, exact IDs, effort, and adapters:
Council state where failure occurred:
Evidence readiness / independence mode:

Sanitized decision and evidence packet:
Minimal reproduction steps:
Expected behavior:
Actual behavior:
Invariant violated:
Decision or safety impact:
Workaround, if any:
Relevant sanitized output:
```

Remove secrets, credentials, personal data, private transcript content, proprietary code, and internal URLs. Prefer a minimal synthetic reproducer over a raw session dump.

## File or draft

1. Search open and closed issues for the same invariant and symptom. Add new evidence to an existing issue when it is the same root problem.
2. When the user has authorized GitHub issue creation and a repository connector or authenticated `gh` is available, file against `9uiLe/plugins` using the **Decision Council failure** issue template or equivalent structured body.
3. Otherwise, return the completed issue body and this URL: `https://github.com/9uiLe/plugins/issues/new?template=decision_council_failure.yml`.
4. Link the resulting issue in the decision record or handoff. Issue creation records the defect; it does not authorize a fix or expose additional data.
