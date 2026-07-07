# 指示書: codex-handoff スキルを agent-handoff にリネーム

## 0. 役割と絶対制約

あなたは 9uiLe/plugins リポジトリの実装担当です。レビューは監督役 (Claude, Fable 5) が行います。

- この指示書が正典です。指示書にない設計判断はしないでください。
- 迷った場合は停止して質問するか、最終報告の「未解決の質問」に列挙してください。
- git 操作 (commit / branch / push / stash / git mv 等) は一切禁止です。ディレクトリ移動は通常の `mv` で行ってください (リネーム検出はコミット時に git が行います)。
- 不可逆操作・外部送信・公開設定の変更は禁止です。
- スコープ外のファイルは読むのは可、編集は不可です。

## 1. 背景と正典リンク

- 目的: 前タスク (`docs/handoffs/2026-07-04-codex-handoff-dual-target.md`) で `codex-handoff` スキルの委譲先を Claude Code / Codex 両対応に一般化した。これを受けてユーザーがスキル名自体の変更を決定した。新名称は **`agent-handoff`** (確定。変更しないこと)。
- 前タスクとの関係: 前タスクでは rename を非目標とし、「スキル名は歴史的経緯」という注記を SKILL.md に入れた。本タスクでリネームするため、この注記は不要になる (削除する)。
- 未コミットの作業ツリー上に前タスクの変更が載っている。その変更を壊さないこと。

## 2. 作業スコープ

- 追加・変更する成果物:
  - `plugins/agent-ops/skills/codex-handoff/` ディレクトリを `plugins/agent-ops/skills/agent-handoff/` へ `mv`
  - `plugins/agent-ops/skills/agent-handoff/SKILL.md` — frontmatter `name: agent-handoff`、タイトル、本文中の自己言及 (`codex-handoff` → `agent-handoff`)。「スキル名の `codex-handoff` は歴史的経緯であり〜」の一文は削除
  - `plugins/agent-ops/README.md` — スキル表・本文の `codex-handoff` 言及
  - `plugins/agent-ops/references/` 配下 — `codex-handoff` 言及があれば更新 (M0 で列挙)
  - 他スキル (`crystallize`、`first-touch-review`) の SKILL.md — `codex-handoff` への言及がある場合、その言及箇所のみ更新可
  - `CHANGELOG.md` — `[Unreleased]` に Changed としてリネームを 1 エントリ追記 (旧名でのスキル呼び出しが変わる旨を含める)。**前タスクが追加した既存の `[Unreleased]` エントリは変更しない**
- 触ってはいけないファイル (歴史的記録):
  - `docs/handoff-ledger.md`、`docs/handoffs/`、`releases/`、`CHANGELOG.md` の過去リリース分 (`[0.x.y]` セクション)
  - 上記スコープ以外のすべて (plugin.json ×2 と marketplace.json ×2 は現状スキル名を含まない想定。M0 で確認し、含まれていた場合のみ「確認が必要」に挙げること)

## 3. 非目標

- 新名称の再検討・代替案の提案はしない (`agent-handoff` で確定)。
- スキル本文の内容変更はしない。名前の置換と、不要になった歴史的経緯注記の削除のみ。
- バージョン番号変更・リリース作業はしない。
- 旧名 `codex-handoff` のエイリアスや後方互換シムは作らない。

## 4. 未確定事項と仮定

- 確認が必要: M0 で列挙すること。
- 仮定して進めてよい (採用した仮定は最終報告に列挙):
  - `docs/` と `releases/` と CHANGELOG 過去リリース分に残る `codex-handoff` は歴史的記録であり、リネーム対象外。

## 5. 事前調査

実装前に行い、M0 の出力に含めること:

1. `grep -rn "codex-handoff"` をリポジトリ全体 (`.git` 除く) で実行し、全ヒットを次の 2 分類に振り分ける:
   - (a) リネーム対象 (現行ドキュメント・マニフェスト)
   - (b) 歴史的記録として残す (CHANGELOG 過去分、releases/、docs/)
2. plugin.json ×2、marketplace.json ×2 にスキル名の言及がないことを確認する。

## 6. マイルストーンと停止点

- M0 (必須): まず実装しないでください。この指示書を満たすために調査し、次を短く提示してください。
  1. 実装方針
  2. 変更対象ファイル (§5 の 2 分類の一覧を含む)
  3. 検証方法
  4. 未確定事項 — 「確認が必要」と「合理的に仮定して進められる」に分けること。各項目に、答えによって実装がどう変わるかを 1 行で添えること。
  提示したら停止し、承認を待ってください。
- M1: 承認された方針に従って実装。完了したら §8 の形式で報告して停止。

## 7. 受け入れ条件

- `test -f plugins/agent-ops/skills/agent-handoff/SKILL.md && test ! -e plugins/agent-ops/skills/codex-handoff`
- `grep -q "^name: agent-handoff" plugins/agent-ops/skills/agent-handoff/SKILL.md`
- `grep -rn "codex-handoff" plugins/ .claude-plugin/ .agents/` がヒット 0 件 (歴史的記録の `docs/` `releases/` `CHANGELOG.md` は検索対象に含めない。CHANGELOG はリネームエントリ内での旧名言及のみ可)
- `jq . plugins/agent-ops/.claude-plugin/plugin.json > /dev/null` ほか JSON 4 ファイルすべて
- `bash scripts/verify-versions.sh` が exit 0
- SKILL.md の参照表と handoff 用リファレンス (00〜06 系列 + `02-execution-claude.md`) が過不足なく一致 (前タスクの状態を維持)

## 8. 完了報告フォーマット

1. 変更ファイル一覧 (mv したディレクトリを含む)
2. 検証コマンドと生ログ (受け入れ条件の全コマンド)
3. 指示書から外れた点・裁量で決めた点
4. 採用した仮定と未解決の質問

## 9. M0 承認記録 (2026-07-04)

M0 は完了し、監督役が以下を承認済み。M1 はこの行レベル分類に従い、リネーム対象以外の行に触れないこと。

- リネーム対象 (これ以外に広げない):
  - `plugins/agent-ops/skills/codex-handoff/` → `plugins/agent-ops/skills/agent-handoff/` (`mv`)
  - `SKILL.md` 2, 6, 10, 22 行目 (frontmatter `name:`、H1、歴史的経緯注記の削除、自己言及)
  - `plugins/agent-ops/README.md` 13 行目 (スキル表)
  - `CHANGELOG.md` `[Unreleased]` に `### Changed` を新設してリネームエントリを 1 件追加
- 変更不要と確認済み: `references/` 全ファイル、`crystallize`・`first-touch-review` の SKILL.md、plugin.json ×2、marketplace.json ×2
- 歴史的記録として残す (触らない): `docs/handoffs/` ×2、`docs/handoff-ledger.md`、`releases/` ×2、`CHANGELOG.md` 過去リリース分および既存 `[Unreleased]` エントリ (15 行目の旧名言及を含む)
