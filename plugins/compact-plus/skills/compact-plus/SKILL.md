---
name: compact-plus
description: "Save the current Claude Code session state to a temporary state file before running /compact. MANDATORY TRIGGERS: /compact-plus, compact-plus, compact plus, compaction plus handoff, pre-compact state save. DO NOT TRIGGER: post-compact recovery, ordinary progress updates, plan creation, or casual context-usage discussion. Japanese triggers: 「/compact の前に状態を保存して」「コンパクト前の状態を残して」「compact-plus で退避して」"
argument-hint: "[recovery notes]"
allowed-tools: Bash, Read, Write, Edit, Grep
---

# compact-plus

Claude Code では、`/compact` 実行時に PreCompact hook が圧縮前 state file を自動保存する。
Codex はこの hook を実行しないため、このスキルは必要に応じた手動 fallback として使う。

Claude Code の `/compact` の前に、圧縮 summary では確実に保存されるとは限らない作業状態を
`${TMPDIR}/claude-compact-state/${SESSION_ID}.md` に保存する。

## strict-procedure プロファイル

- 厳格度: strict-procedure。state file の内容と完了報告が成果物。
- ハードゲート: session id を検出できない場合、推測で state file 名を作らない。停止し、session id 検出に失敗した旨を報告する。
- 強制関数: 保存先パスを確定させたうえで、保存したファイルを読み返し、必須見出しが揃っていることを検証する。
- 完了報告: state file のパス、主な保存項目、未検証項目、`/compact` 実行の指示を報告する。

## 手順

1. session id を取得する。
   - `$CLAUDE_SESSION_ID` 環境変数を確認する。未設定の場合は、このプラグイン同梱の
     `scripts/get-session-id.sh` (このスキルファイルから見て `../../scripts/get-session-id.sh`) を実行する。
   - 検出できない場合は state file を作らない。session id が取得できず準備が未完了である旨を報告する。
2. 保存先を `${TMPDIR:-/tmp}/claude-compact-state/${SESSION_ID}.md` に設定する。
3. TaskList、アクティブな plan file、並行ワーカー構成 (サブエージェント、tmux 等) の状態、現在編集中のファイルを確認する。
   - アクティブな plan ファイルがある場合はそれを読む。
   - 並行ワーカー構成を使っていなければ `Not used` と記録する。
4. 以下の見出しを、この順番のまま state file に保存する。

```markdown
# Compact Prep State
## Active Plan
## Current Phase
## TaskList Summary
## Session Decisions
## Constraints and Blockers
## Worker Topology
## Skills Invoked
## Editing Files
## Failed Attempts
## Recovery Notes
```

5. 保存後に state file を読み返し、上記の見出しがすべて存在することを確認する。
6. ユーザーに伝える: `準備完了。/compact を実行してください。`

## 保存する内容

- アクティブな plan file のパスと現在のフェーズまたはステップ。
- 進行中の task list と関連メモ。
- セッション中に下した決定、ユーザーの選択、却下した代替案とその理由。
- 制約、ブロッカー、未完了の検証。
- 並行ワーカー構成。使っている場合は pane、role、responsibility を記録する。
- セッション中にこれまで呼び出した skill と slash command。これは呼び出し履歴であり、現在も有効であることの証明ではない。
- 編集中のファイルと、未保存または未検証の作業に関するメモ。
- 失敗した試行、tool error、繰り返すべきでない却下済みアプローチ。
- 圧縮後の agent 向け recovery notes。

## 完了報告

完了時に以下を含める:

- state file のパス。
- 主な保存項目。
- 未検証項目とその理由。
- `準備完了。/compact を実行してください。`
