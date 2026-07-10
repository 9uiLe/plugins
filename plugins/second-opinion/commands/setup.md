---
description: Check that the second-opinion backends (Codex CLI, Claude CLI) and transcript access are ready, and offer to install what is missing.
argument-hint: ''
allowed-tools: Bash(node:*), Bash(npm:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/second-opinion.mjs" setup --json
```

Read the JSON and act on it:

- **`fable_backend_ready: false`** (the `claude` CLI is not on PATH):
  - Tell the user the Fable backend needs the `claude` CLI on PATH. Do not try to install it automatically.

- **`codex_backend_ready: false`** (the openai-codex plugin / `codex-companion.mjs` was not found):
  - If `npm` is available, use `AskUserQuestion` exactly once to ask whether to install the Codex CLI now.
    - Put the install option first, suffixed with `(Recommended)`.
    - Options: `Install Codex (Recommended)` / `Skip for now`.
    - If the user chooses install, run `npm install -g @openai/codex`, then re-run the setup command above.
  - The Codex backend also relies on the openai-codex Claude Code plugin (for `codex-companion.mjs`). If only the CLI is present but the plugin is missing, tell the user to install the openai-codex plugin, or to set `SECOND_OPINION_CODEX_COMPANION` to the path of a `codex-companion.mjs`.
  - If the Codex CLI is installed but not authenticated, preserve the guidance to run `!codex login`.

- **`transcript_warning` is non-null** (transcript resolved only by newest-mtime):
  - Explain that the SessionStart hook records the transcript path only for sessions started *after* this plugin was installed. The current session predates it, so `review` falls back to the newest transcript by mtime, which can pick the wrong session when several run at once.
  - Tell the user this resolves itself in the next session, or they can pass `--source <path-to-jsonl>` explicitly.

Output rules:
- Present the final readiness summary to the user (which backends are ready, how the transcript resolves).
- At least one backend ready (`ok: true`) means second-opinion is usable.
