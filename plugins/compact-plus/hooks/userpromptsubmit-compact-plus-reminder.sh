#!/bin/bash
# UserPromptSubmit hook: detect the compact-warn marker written by the statusline
# and prompt compact-plus use through additionalContext (one-shot).
#
# Flow:
#   statusline.sh writes the warn marker when ctx >= threshold.
#   This hook detects it, creates a warned marker, removes the warn marker,
#   and injects additionalContext.
#   The PostCompact hook (compaction-recovery.sh) removes the warned marker
#   to reset the cooldown.
#
# overhead: one test -f per turn; exit immediately when no marker exists.
# fail-open (always exit 0)

set -uo pipefail

INPUT=$(cat)

# jq missing: fail open silently here; userpromptsubmit-compaction-recovery.sh
# already emits a visible once-per-session notice for the missing dependency.
command -v jq >/dev/null 2>&1 || exit 0

SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
[[ -z "$SESSION_ID" ]] && exit 0

# Do nothing when the warn marker is absent.
WARN_DIR="${TMPDIR:-/tmp}/claude-compact-warn" # lint:allow-os-tmp
WARN_MARKER="$WARN_DIR/$SESSION_ID"
[[ -f "$WARN_MARKER" ]] || exit 0

# Read usage percentage from the marker.
if ! CTX_PCT=$(cat "$WARN_MARKER" 2>/dev/null); then
  # Transient read failure: emit nothing and keep the warn marker so the
  # reminder fires exactly once on the next prompt.
  exit 0
fi
CTX_PCT=${CTX_PCT:-"?"}

WARNED_DIR="${TMPDIR:-/tmp}/claude-compact-warned" # lint:allow-os-tmp
mkdir -p "$WARNED_DIR" 2>/dev/null || true

# NOTE: markers are consumed only after the reminder is emitted successfully
# (see the end of this script), so a transient jq/output failure does not
# permanently lose the one-shot warning.

STATE_FILE="${TMPDIR:-/tmp}/claude-compact-state/$SESSION_ID.md" # lint:allow-os-tmp
if [[ -f "$STATE_FILE" && ! -r "$STATE_FILE" ]]; then
  # Transient read failure: keep the warn marker and retry on the next prompt.
  exit 0
fi

section_first_line() {
  local heading="$1"
  local file="$2"
  awk -v heading="$heading" '
    $0 == heading { in_section = 1; next }
    in_section && /^## / { exit }
    in_section {
      line = $0
      sub(/^[[:space:]-]+/, "", line)
      if (line != "") {
        print line
        exit
      }
    }
  ' "$file" 2>/dev/null
}

section_last_line() {
  local heading="$1"
  local file="$2"
  awk -v heading="$heading" '
    $0 == heading { in_section = 1; next }
    in_section && /^## / { exit }
    in_section {
      line = $0
      sub(/^[[:space:]-]+/, "", line)
      if (line != "") {
        last = line
      }
    }
    END {
      if (last != "") print last
    }
  ' "$file" 2>/dev/null
}

CTX="[COMPACT REMINDER] context usage reached ${CTX_PCT}%."
if [[ -f "$STATE_FILE" ]]; then
  ACTIVE_PLAN=$(section_first_line "## Active Plan" "$STATE_FILE")
  CURRENT_PHASE=$(section_first_line "## Current Phase" "$STATE_FILE")
  SESSION_DECISION=$(section_last_line "## Session Decisions" "$STATE_FILE")
  CTX+=$'\n'"State recitation:"
  CTX+=$'\n'"- Active Plan: ${ACTIVE_PLAN:-Not verified}"
  CTX+=$'\n'"- Current Phase: ${CURRENT_PHASE:-Not verified}"
  CTX+=$'\n'"- Recent Session Decision: ${SESSION_DECISION:-Not verified}"
else
  CTX+=$'\n'"State recitation: no pre-compaction state file is available for this session."
fi
CTX+=$'\n'"- At a work boundary, tell the user they can run \`/compact\` as-is. The PreCompact hook automatically saves pre-compaction state."
CTX+=$'\n'"- Address the situation by saving pre-compaction state, not by shrinking scope or moving to another session."

if jq -n --arg ctx "$CTX" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $ctx
  }
}'; then
  # Consume markers only after the reminder was emitted.
  # Create the cooldown marker first so statusline does not write another warn
  # marker in the window between removing the warn marker and creating the
  # cooldown marker. If the cooldown write fails, keep the warn marker so the
  # markers stay consistent (the reminder may fire again next turn).
  if printf '%s\n' "$(date +%s)" > "$WARNED_DIR/$SESSION_ID" 2>/dev/null; then
    rm -f "$WARN_MARKER" 2>/dev/null || true
  fi
fi
exit 0
