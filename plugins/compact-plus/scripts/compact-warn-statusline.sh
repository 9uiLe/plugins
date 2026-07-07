#!/usr/bin/env bash
#
# compact-plus: /compact 推奨の warn マーカーを書く statusline スクリプト。
#
# upstream (u-ichi/compact-plus) では、hooks/userpromptsubmit-compact-plus-reminder.sh が
# 読む warn マーカー (${TMPDIR}/claude-compact-warn/<session_id>) を作者 dotfiles の
# statusline.sh が書く前提だった。プラグイン単体で reminder 機能が動くよう、このスクリプトを
# 同梱する。cooldown マーカー (${TMPDIR}/claude-compact-warned/<session_id>) の消費・生成は
# hooks/userpromptsubmit-compact-plus-reminder.sh 側が行うロジックと対応させてある。
#
# 配線 (ユーザー/プロジェクトの settings.json)。statusLine はプラグイン外の設定のため
# ${CLAUDE_PLUGIN_ROOT} は展開されない。このスクリプトの絶対パスを指定すること:
#   {
#     "statusLine": {
#       "type": "command",
#       "command": "/absolute/path/to/plugins/compact-plus/scripts/compact-warn-statusline.sh"
#     }
#   }
#
# 警告閾値は環境変数 COMPACT_WARN_THRESHOLD (既定 60 = 使用率%) で変更可。
# 表示自体を他コマンドに委譲したい場合は COMPACT_PLUS_STATUSLINE_DELEGATE にコマンドを設定する
# (例: model-strategy プラグインの context-statusline.sh と併用)。
#
set -uo pipefail

WARN_THRESHOLD="${COMPACT_WARN_THRESHOLD:-60}"
WARN_DIR="${TMPDIR:-/tmp}/claude-compact-warn" # lint:allow-os-tmp
WARNED_DIR="${TMPDIR:-/tmp}/claude-compact-warned" # lint:allow-os-tmp

INPUT=$(cat)

if ! command -v jq >/dev/null 2>&1; then
  printf 'compact-plus statusline: jq が必要です (例: brew install jq)\n'
  exit 0
fi

SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
USED_PCT=$(printf '%s' "$INPUT" | jq -r '.context_window.used_percentage // 0' 2>/dev/null)
MODEL_NAME=$(printf '%s' "$INPUT" | jq -r '.model.display_name // "model"' 2>/dev/null)

PCT_INT=${USED_PCT%.*}
PCT_INT=${PCT_INT:-0}

if [[ -n "$SESSION_ID" ]]; then
  WARN_MARKER="$WARN_DIR/$SESSION_ID"
  WARNED_MARKER="$WARNED_DIR/$SESSION_ID"

  if [[ "$PCT_INT" -ge "$WARN_THRESHOLD" ]] 2>/dev/null; then
    # cooldown マーカーが存在する間は書かない (二重通知防止)。
    if [[ ! -f "$WARNED_MARKER" ]]; then
      mkdir -p "$WARN_DIR" 2>/dev/null || true
      printf '%s\n' "$PCT_INT" > "$WARN_MARKER" 2>/dev/null || true
    fi
  else
    rm -f "$WARN_MARKER" 2>/dev/null || true
  fi
fi

if [[ -n "${COMPACT_PLUS_STATUSLINE_DELEGATE:-}" ]]; then
  printf '%s' "$INPUT" | bash -c "$COMPACT_PLUS_STATUSLINE_DELEGATE"
  exit 0
fi

NUDGE=""
[[ "$PCT_INT" -ge "$WARN_THRESHOLD" ]] 2>/dev/null && NUDGE="  ⚠ /compact 推奨"

printf '%s ⊙ ctx %s%%%s\n' "$MODEL_NAME" "$PCT_INT" "$NUDGE"
exit 0
