# second-opinion

Two related skills are included:

| Skill | Use it for | Result |
| --- | --- | --- |
| `second-opinion` | A lightweight independent review of the current session | Raw five-section verdicts |
| `decision-council` | A consequential choice that needs evidence checks, debate, and a durable rationale | Decision record with dissent, concerns, unknowns, and model-role rationale |

`decision-council` is host-neutral. Orca/orchestration can carry messages when available, but the skill can use direct CLIs, host subagents, one-advisor opposition, or disclosed self-critique fallbacks.

It also includes outcome alignment before evidence collection, proposal-to-outcome traceability with a deterministic means-goal guard, and a sanitized incident-reporting path for reproducible safeguard failures. GitHub issues are filed only with explicit authorization; otherwise the skill returns a ready-to-file draft.

Summon an external **second-opinion reviewer** over your current **Claude Code or Codex**
session. The reviewer backend is selectable between **Codex** (OpenAI gpt-5 series),
**Fable** (`claude-fable-5`), or both.

The core value of an advisor is that **the agent with the blind spot does not get to curate
what the reviewer sees.** So second-opinion extracts your session *mechanically* — it never asks
the working agent to summarise — and sends that unedited context to the backend(s), which answer
in a fixed five-section contract.

## What it does

1. **Locates the current transcript mechanically** with a `SessionStart` hook. Claude Code writes
   the exact path to its environment file. Codex adds the exact `transcript_path` to developer
   context so the skill can pass it to the extractor with `--source`.
2. **Extracts a fixed-format context** (`scripts/second-opinion.mjs`) from Claude Code JSONL or
   Codex rollout JSONL: task definition, every genuine human message, transcript-visible assistant
   output/reasoning summaries, a tool-activity digest, and **every detectable tool error verbatim**.
   Codex genuine-human turns come from `event_msg/user_message`, so injected environment context is
   not attributed to the user. Codex encrypted reasoning is never decrypted or guessed.
3. **Dispatches to the chosen backend(s)** and prints a five-section verdict per backend:
   - **Fable** via `claude -p --model claude-fable-5` (headless, tools disabled).
   - **Codex** via an isolated `codex exec` session (read-only and ephemeral).
   - `--backend both` runs them sequentially; points **both** raise are highest-priority, points
     only one raises are blind-spot candidates.

## The five-section contract

1. **Blind spots** — unsurfaced assumptions and risks
2. **Convergence** — is the approach converging or diverging, with evidence
3. **Ship / No-ship** — one verdict and the single deciding reason
4. **Decisive constraint** — the one constraint that most determines success
5. **Strongest counterargument** — the best good-faith case against the current direction

## Usage

Invoke the skill (Japanese triggers include 「セカンドオピニオンが欲しい」「Codex に見てもらって」
「この方針でいいか外部レビューして」), or run the engine directly:

```bash
node scripts/second-opinion.mjs review --backend both --effort high
node scripts/second-opinion.mjs review --backend fable --effort medium --full
node scripts/second-opinion.mjs review --backend codex --source /path/to/session.jsonl
```

- **Model & effort are chosen at call time.** If they are not given, the skill asks through the
  host's available question UI or normal conversation. Valid effort depends on the backend and,
  for Codex, on the resolved model (validated before dispatch; unsupported values fail without
  starting anything): Fable accepts `low | medium | high | xhigh | max` (CLI-enforced). For Codex
  the server enforces effort per model; the only probe-verified entry is `gpt-5.6-sol`, which
  accepts `low | medium | high | xhigh | max | ultra` and rejects `minimal` (HTTP 400, verified
  2026-07-23). Any other Codex model is dispatched with a warning and the server's own per-model
  validation. Codex defaults to the explicitly pinned `gpt-5.6-sol` model
  (`SECOND_OPINION_CODEX_MODEL` overrides it) and retries once with the Codex CLI default **only
  when the failure matches the exact model-not-found error forms** (renamed / retired / ungated
  id); auth, timeout, org-policy, and parser failures surface as failures. `--no-fallback` or
  `SECOND_OPINION_NO_FALLBACK=1` disables the retry entirely (required in decision-council
  context). `spark` maps to `gpt-5.3-codex-spark` and is not available on every account. Fable is
  always `claude-fable-5`.
- **Both backends must be authenticated, not just installed.** `setup` probes
  `claude auth status --json` and `codex login status` and reports `ready`,
  `installed (not authenticated)`, `installed (auth probe failed)`, or `missing` per backend.
- **Stakes-tied depth:** the default extraction always carries the task, every human message, and
  every tool error, trimming only the middle of a very long assistant chain. Pass `--full` for
  high-stakes calls (ship decisions, when stuck) to send everything verbatim.

## Setup

Run `node scripts/second-opinion.mjs setup`. Claude Code also provides `/second-opinion:setup`.
The command reports whether each backend is ready and how the transcript resolves.

The `SessionStart` hook only records the transcript path for sessions started **after** this
plugin is installed. In Codex, review and trust the plugin hook with `/hooks`, then start a new
thread. In the Claude Code session where you install it, `review` falls back to the newest
transcript by mtime (pass `--source` if several sessions are open at once).

## Requirements

- **Fable backend:** the authenticated `claude` CLI on `PATH` (`claude auth login`).
- **Codex backend:** the authenticated `codex` CLI (`codex login`).
- `node`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `SECOND_OPINION_TRANSCRIPT_PATH` | Set by the SessionStart hook; the current transcript. |
| `SECOND_OPINION_CODEX_MODEL` | Override the pinned Codex reviewer model. |
| `SECOND_OPINION_NO_FALLBACK` | `1` disables the model-not-found fallback (same as `--no-fallback`; required in decision-council context). |
| `SECOND_OPINION_TIMEOUT_MS` | Per-backend timeout (default 600000). |

## Codex installation

```bash
codex plugin marketplace add 9uiLe/plugins
codex plugin add second-opinion@9uile-plugins
```

After installation, trust the bundled `SessionStart` hook with `/hooks` and start a new thread.
