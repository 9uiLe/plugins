# Execution preflight contract

Run this gate after panel selection, after the transport gate (`transport-gate.md`) has approved the transport and topology, and before sending evidence to any advisor. Host adapters collect observations; the host-neutral guard evaluates policy. Never treat a config file as proof of effective runtime identity when runtime metadata is available.

For each participant record requested and effective provider/model/effort separately; role; alias/snapshot status; host/adapter and config source; callability/authentication; context, reasoning, and output limits; evidence-size estimate; timeout; fallback policy; and field-level verification state, source type (`RUNTIME` or `PROBE` for a verified claim), source, and timestamp. Configuration intent alone remains `UNVERIFIED`.

Record stakes with owner/date provenance, finite round/retry/fallback ceilings, a mandatory finite token ceiling, optional cost ceiling with versioned pricing provenance, and explicit authorization with owner/date evidence. Defaults are two rounds, zero retries, and zero fallbacks. Compute a conservative maximum over every participant and attempt with overflow-safe arithmetic.

Emit this table before dispatch:

| Role / participant | Requested model / effort | Effective model / effort | Host / adapter | Verification | Limits / evidence | Rounds / retries / fallbacks | Callability | Fallback | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Statuses are `PASS`, `DEGRADED`, `AUTHORIZATION_REQUIRED`, or `BLOCKED`. Consequential work blocks on identity/effort uncertainty or mismatch. Low-stakes work may degrade only for explicitly unverified metadata while enforceable limits remain safe; known mismatch never degrades. Budget or tier excess requires explicit authorization. A fallback is a new identity requiring a new preflight and capability/confidence evaluation.

After completion, record actual identity and usage where exposed. Compare actual tokens/cost with both the expected estimate and conservative maximum/declared ceilings. Report unavailable usage as `UNVERIFIED` and excess as a material variance; never infer missing usage.

When Node.js is available, validate the record with `scripts/execution-preflight-guard.mjs`. Without Node.js, apply the same rules textually and disclose that automated validation was unavailable. The script is a policy backstop, not a host probe or dispatcher.
