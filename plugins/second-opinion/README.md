# second-opinion

Summon an external **second-opinion reviewer** (an "advisor") over your *current* Claude Code
session — the same idea as Claude Code's built-in `advisor`, but with the reviewer backend
swappable to **Codex** (OpenAI gpt-5 series) and/or **Fable** (`claude-fable-5`).

The core value of an advisor is that **the agent with the blind spot does not get to curate
what the reviewer sees.** So second-opinion extracts your session *mechanically* — it never asks
the working agent to summarise — and sends that unedited context to the backend(s), which answer
in a fixed five-section contract.

## What it does

1. **Locates the current transcript** without an mtime guess: a `SessionStart` hook records this
   session's transcript path into an env var that the engine reads later.
2. **Extracts a fixed-format context** (`scripts/second-opinion.mjs`): task definition, every
   genuine human message, the assistant's reasoning chain, a tool-activity digest, and **every
   tool error verbatim**. Genuine human turns are identified by the transcript's `origin.kind`
   marker, so task-notifications, slash-command machinery, and compaction summaries are never
   mistaken for the human. A compaction summary, if present, is kept only in a clearly-labelled
   "synthetic" section.
3. **Dispatches to the chosen backend(s)** and prints a five-section verdict per backend:
   - **Fable** via `claude -p --model claude-fable-5` (headless, tools disabled).
   - **Codex** via the openai-codex plugin's `codex-companion.mjs task` (read-only).
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

- **Model & effort are chosen at call time.** If they are not given, the skill asks via
  `AskUserQuestion`. Valid effort: `none | minimal | low | medium | high | xhigh`. For Codex,
  leaving the model unset (the default) lets the Codex CLI config decide; `spark` maps to
  `gpt-5.3-codex-spark` (not available on every account). Fable is always `claude-fable-5`.
- **Stakes-tied depth:** the default extraction always carries the task, every human message, and
  every tool error, trimming only the middle of a very long reasoning chain. Pass `--full` for
  high-stakes calls (ship decisions, when stuck) to send everything verbatim.

## Setup

Run `/second-opinion:setup` (or `node scripts/second-opinion.mjs setup`). It reports whether each
backend is ready and how the transcript resolves, and offers to install the Codex CLI if missing.

The `SessionStart` hook only records the transcript path for sessions started **after** this
plugin is installed. In the session where you install it, `review` falls back to the newest
transcript by mtime (pass `--source` if several sessions are open at once).

## Requirements

- **Fable backend:** the `claude` CLI on `PATH`.
- **Codex backend:** the `codex` CLI plus the openai-codex Claude Code plugin (for
  `codex-companion.mjs`), or `SECOND_OPINION_CODEX_COMPANION` pointing at a `codex-companion.mjs`.
- `node`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `SECOND_OPINION_TRANSCRIPT_PATH` | Set by the SessionStart hook; the current transcript. |
| `SECOND_OPINION_CODEX_COMPANION` | Explicit path to `codex-companion.mjs`. |
| `SECOND_OPINION_TIMEOUT_MS` | Per-backend timeout (default 600000). |

This plugin is Claude Code–facing. On the Codex host, use the openai-codex plugin's own review
commands instead.
