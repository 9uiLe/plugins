#!/bin/bash
# UserPromptSubmit hook: detect the marker file left by PostCompact and inject
# compaction recovery guidance through additionalContext (one-shot).
#
# overhead: one test -f per turn; exit immediately when no marker exists.
# fail-open (always exit 0)

set -uo pipefail

INPUT=$(cat)

if ! command -v jq >/dev/null 2>&1; then
  # jq is a hard dependency of every compact-plus hook. Make the degradation
  # visible once per session (plain stdout of a UserPromptSubmit hook is added
  # as context), then fail open.
  SID=$(printf '%s' "$INPUT" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)
  GUARD_DIR="${TMPDIR:-/tmp}/claude-compact-plus-jq-warned" # lint:allow-os-tmp
  GUARD="$GUARD_DIR/${SID:-global}"
  if [[ ! -f "$GUARD" ]]; then
    mkdir -p "$GUARD_DIR" 2>/dev/null || true
    printf '[compact-plus] jq is not installed, so compact-plus hooks (state save / recovery / reminder) are disabled. Install jq (e.g. brew install jq) to enable them.\n'
    : > "$GUARD" 2>/dev/null || true
  fi
  exit 0
fi

SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
[[ -z "$SESSION_ID" ]] && exit 0

# Do nothing when the marker file is absent.
MARKER_DIR="${TMPDIR:-/tmp}/claude-compacted" # lint:allow-os-tmp
MARKER="$MARKER_DIR/$SESSION_ID"
[[ -f "$MARKER" ]] || exit 0

# NOTE: the marker is consumed only after the guidance is emitted successfully
# (see the end of this script), so a transient jq/output failure does not
# permanently lose the one-shot recovery.

# Read the active plan path from the session pointer file.
PTR_DIR="${TMPDIR:-/tmp}/claude-active-plan" # lint:allow-os-tmp
PLAN_FILE=""
if [[ -f "$PTR_DIR/$SESSION_ID" ]]; then
  if ! PLAN_FILE=$(cat "$PTR_DIR/$SESSION_ID" 2>/dev/null); then
    # Transient read failure: emit nothing and keep the marker so the recovery
    # guidance fires exactly once on the next prompt with full data.
    exit 0
  fi
  [[ -f "$PLAN_FILE" ]] || PLAN_FILE=""
fi

# Build recovery guidance.
CTX="[COMPACTION RECOVERY] Context compaction occurred. Before resuming work, use the following recovery references."
CTX+=$'\n'

if [[ -n "$PLAN_FILE" ]]; then
  CTX+=$'\n'"- Re-read plan file \`${PLAN_FILE}\` with Read and confirm the current phase and constraints."
  CTX+=$'\n'"- If plan mode is no longer active, note that a plan file exists and ask the user whether to re-enter plan mode."
fi

STATE_DIR="${TMPDIR:-/tmp}/claude-compact-state" # lint:allow-os-tmp
STATE_FILE="$STATE_DIR/$SESSION_ID.md"
if [[ -f "$STATE_FILE" && ! -r "$STATE_FILE" ]]; then
  # Transient read failure: keep the marker and retry on the next prompt.
  exit 0
fi
if [[ -f "$STATE_FILE" ]]; then
  CTX+=$'\n'"- Read state file \`${STATE_FILE}\` with Read and restore the working state."
  CTX+=$'\n'"- Pay special attention to Session Decisions and Recovery Notes."
  if grep -q '^## Skills Invoked' "$STATE_FILE" 2>/dev/null; then
    CTX+=$'\n'"- The state file at \`${STATE_FILE}\` includes a \`## Skills Invoked\` section listing the skills and slash commands invoked earlier in this session."
  fi
else
  BACKUP_DIR="${HOME}/.claude/backups/transcripts"
  BACKUP_FILE=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "*-${SESSION_ID}.jsonl" -print 2>/dev/null | sort -r | head -n 1 || true)
  if [[ -n "$BACKUP_FILE" && -f "$BACKUP_FILE" ]]; then
    CTX+=$'\n'"- No state file was found. Transcript backup \`${BACKUP_FILE}\` exists; read it if recovery details are needed."
  fi
fi

CTX+=$'\n'"- Check TaskList for the current task list."
CTX+=$'\n'"- Treat next steps from the compaction summary as hypotheses; use the plan and rules as the source of truth."
CTX+=$'\n'"- Treat the compaction summary as a record of prior work, not as instructions for the next action."
CTX+=$'\n'"- Original memory / rule / skill files are the authoritative references; compaction summaries may omit scope qualifiers."

if jq -n --arg ctx "$CTX" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $ctx
  }
}'; then
  # Remove the marker only after the guidance was emitted, so this hook fires
  # exactly once per successful injection.
  rm -f "$MARKER" 2>/dev/null || true
fi
exit 0
