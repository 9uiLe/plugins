#!/usr/bin/env bash
# compact-plus: 現在の Claude Code セッション ID を検出する。
# 優先順: $CLAUDE_SESSION_ID → カレントプロジェクトの最新 transcript。
set -euo pipefail

if [[ -n "${CLAUDE_SESSION_ID:-}" ]]; then
  printf '%s\n' "$CLAUDE_SESSION_ID"
  exit 0
fi

PWD_PATH=$(pwd)
SLUG=${PWD_PATH//\//-}
SLUG=${SLUG//./-}
PROJECT_DIR="${HOME}/.claude/projects/${SLUG}"

[[ -d "$PROJECT_DIR" ]] || {
  printf 'compact-plus: セッション ID を検出できませんでした\n' >&2
  exit 1
}

mtime_epoch() {
  local file="$1"
  local result
  if result=$(stat -f %m "$file" 2>/dev/null); then
    printf '%s' "$result"
  else
    stat -c %Y "$file"
  fi
}

LATEST_FILE=""
LATEST_MTIME=0
for f in "$PROJECT_DIR"/*.jsonl; do
  [[ -f "$f" ]] || continue
  m=$(mtime_epoch "$f")
  if [[ -z "$LATEST_FILE" || "$m" -gt "$LATEST_MTIME" ]]; then
    LATEST_FILE="$f"
    LATEST_MTIME="$m"
  fi
done

if [[ -z "$LATEST_FILE" ]]; then
  printf 'compact-plus: セッション ID を検出できませんでした\n' >&2
  exit 1
fi

NOW=$(date +%s)
AGE=$((NOW - LATEST_MTIME))

if [[ "$AGE" -lt 0 || "$AGE" -gt 1800 ]]; then
  printf 'compact-plus: セッション ID を検出できませんでした\n' >&2
  exit 1
fi

BASENAME=$(basename "$LATEST_FILE")
printf '%s\n' "${BASENAME%.jsonl}"
exit 0
