---
description: Check that the second-opinion backends (Codex CLI, Claude CLI) and transcript access are ready, and offer to install what is missing.
argument-hint: ''
allowed-tools: Bash(node:*), Bash(npm:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/second-opinion.mjs" setup --json
```

Read the JSON and act on it. Branch on the structured `fable_backend.status` / `codex_backend.status`
fields (`ready` / `installed (not authenticated)` / `installed (auth probe failed)` / `missing`) —
the legacy `*_backend_ready` booleans mean "installed AND authenticated" and cannot distinguish a
missing CLI from a logged-out one:

- **`fable_backend.status: "missing"`** (the `claude` CLI is not on PATH):
  - Tell the user the Fable backend needs the `claude` CLI on PATH. Do not try to install it automatically.
- **`fable_backend.status: "installed (not authenticated)"`**: tell the user to run `claude auth login` (or `/login` in a session), then re-run setup.
- **`fable_backend.status: "installed (auth probe failed)"`**: the CLI did not answer `claude auth status --json` as expected (wrapper script, very old version, or a fake binary). Ask the user to verify the installation manually; report `fable_backend.detail`.

- **`codex_backend.status: "missing"`** (the `codex` CLI was not found):
  - If `npm` is available, use `AskUserQuestion` exactly once to ask whether to install the Codex CLI now.
    - Put the install option first, suffixed with `(Recommended)`.
    - Options: `Install Codex (Recommended)` / `Skip for now`.
    - If the user chooses install, run `npm install -g @openai/codex`, then re-run the setup command above.
- **`codex_backend.status: "installed (not authenticated)"`**: preserve the guidance to run `!codex login`, then re-run setup.
- **`codex_backend.status: "installed (auth probe failed)"`**: the CLI did not answer `codex login status` as expected. Ask the user to verify the installation manually; report `codex_backend.detail`.

- **`transcript_warning` is non-null** (transcript resolved only by newest-mtime):
  - Explain that the SessionStart hook records the transcript path only for sessions started *after* this plugin was installed. The current session predates it, so `review` falls back to the newest transcript by mtime, which can pick the wrong session when several run at once.
  - Tell the user this resolves itself in the next session, or they can pass `--source <path-to-jsonl>` explicitly.

Output rules:
- Present the final readiness summary to the user (which backends are ready, how the transcript resolves).
- At least one backend ready (`ok: true`) means second-opinion is usable.
