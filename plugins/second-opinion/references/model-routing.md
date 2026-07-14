# Role and model routing

Model availability and behavior change. Verify current official documentation and the actual host configuration at decision time. Store volatile facts here or in another dated reference, never as timeless claims in the core protocol. Label routing facts `VERIFIED(provider,date,source)`, `OBSERVED_LOCAL(date,probe)`, `CALIBRATED(case-set,date)`, `HEURISTIC`, or `UNKNOWN`.

## Choose roles before models

| Role | Required capability | Default effort floor |
| --- | --- | --- |
| Chair / synthesizer | strongest cross-domain reasoning, long-context coherence, evidence weighting, explicit dissent handling | medium for low/reversible; high for medium stakes; highest supported for high/hard-to-reverse |
| Researcher | primary-source retrieval, citation fidelity, artifact access | medium; high when sources conflict or omission risk is material |
| Critic / red team | adversarial reasoning, falsifiers, independence from leading option | medium for low stakes; high for medium/high stakes |
| Domain verifier | relevant code/data/tool access and precise validation | medium for low stakes; high for medium/high stakes plus a human expert gate where required |
| Implementer | instruction following, repository tools, tests; no new policy authority | medium after the decision is fixed |

These are starting floors, not provider-independent guarantees. Normalize `none/minimal`, `low`, `medium`, `high`, and `xhigh/max` conceptually, then pass only values the selected provider/model supports. If a provider defines effort differently, map by documented behavior and validate on a representative task. Never use no/minimal effort for a material chair, critic, or verifier.

## Select the chair explicitly

Do not let the initiating model become chair by inertia. Score candidates against the decision's needs:

- reasoning and synthesis difficulty;
- context length and ability to inspect all decisive artifacts;
- tool/source access and citation fidelity;
- demonstrated performance on a representative local task;
- independence from implementation ownership and sunk-cost bias;
- latency, quota, and cost constraints;
- whether the requested effort level is supported and actually configured.

Use a more capable chair than advisors when synthesis is harder than the individual analyses. A domain-specialist chair may beat a nominally stronger general model when the decisive constraint is domain verification. If no candidate meets a must-have requirement, stop rather than manufacture a council.

## Build the panel

- Prefer heterogeneous model families for distinct failure modes, not merely more samples.
- Use same-model replicas only when variance estimation or parallel evidence collection is the goal; label the correlation.
- Separate researcher and advocate when retrieval bias could anchor the recommendation.
- Keep the implementer out of the final approval role for high-stakes changes when practical.
- Give every first-round advisor the same evidence and comparable effort. A low-effort dissenting model versus a high-effort favored model is not a fair comparison.

## Verify volatile facts

For each participant record:

```text
model_id, provider, host, effort, effort semantics, context limit,
tool/artifact access, knowledge/source cutoff if documented,
official source URL, verified_at, confidence_in_metadata
```

Prefer provider model pages, pricing/configuration docs, and actual CLI capability output. Tool access is a property of model + host + adapter + permissions, not the model name. Mark marketing comparisons and cross-provider equivalence as heuristics. Never infer that a newer or more expensive model is universally better. Recheck before high-stakes use, after fallback/adapter/model changes, or when the record is older than 30 days (7 days for previews).

## Calibrate for repeated workflows

Before fixing a routing policy, run a small blinded evaluation on representative past decisions:

1. Freeze the same evidence packet and rubric.
2. Use 3–7 cases including a seeded false premise, a missing-information case where the right answer is to stop, and a tool/citation case when relevant.
3. Compare candidate chairs and effort levels without revealing identities to the evaluator; hold evidence, permissions, prompts, and budgets constant.
4. Score factual accuracy, missing-unknown detection, counterargument strength, citation fidelity, decision calibration, critical failures, and cost/latency.
5. Reject configurations that fabricate citations, miss a destructive-action stop, expand scope, or falsely report verification.
6. Re-test after model/version/host changes and date the routing policy. If the small sample has no clear winner, record that uncertainty rather than inventing a rank.

Do not optimize solely for agreement with historical decisions. Reward detection of flawed premises and correct abstention.
