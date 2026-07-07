# 指示書: codex-handoff スキルの委譲先 Claude/Codex 両対応化

## 0. 役割と絶対制約

あなたは 9uiLe/plugins リポジトリ (Claude Code / Codex プラグインマーケットプレイス) の実装担当です。レビューは監督役 (Claude, Fable 5) が行います。

- この指示書が正典です。指示書にない設計判断はしないでください。
- 迷った場合は停止して質問するか、最終報告の「未解決の質問」に列挙してください。
- git 操作 (commit / branch / push / stash 等) は一切禁止です。作業ツリーへのファイル編集のみ行ってください。コミットは監査後に監督役が行います。
- 不可逆操作・外部送信・公開設定の変更は禁止です。
- スコープ外 (§2 の「触ってはいけない」) のファイルは読むのは可、編集は不可です。

## 1. 背景と正典リンク

- 目的: `agent-ops` プラグインの `codex-handoff` スキルは現在、委譲先 (実装担当の外部エージェント) を Codex 前提で記述している。委譲先として **Claude Code も Codex も選べる**ように一般化する。運用規律 (指示書・ゲート・監査・台帳) は委譲先非依存であることを明確にし、委譲先固有なのは実行経路 (起動コマンド・サンドボックス) だけという構造に整理する。
- 参照すべき既存コード:
  - `plugins/agent-ops/skills/codex-handoff/SKILL.md` (本体)
  - `plugins/agent-ops/references/00-handoff-template.md` 〜 `06-operating-protocol.md`
  - `plugins/agent-ops/README.md`
  - `plugins/agent-ops/.claude-plugin/plugin.json` / `plugins/agent-ops/.codex-plugin/plugin.json`
  - `.claude-plugin/marketplace.json` / `.agents/plugins/marketplace.json` (agent-ops エントリの description)
- 境界 (維持すること): `model-strategy` プラグインが「どの委譲先・モデル・effort を選ぶか」の判断を担い、`codex-handoff` は選んだ後の運用規律を担う。この境界は変更しない。委譲先の選定基準をこのスキルに書き込まないこと。

## 2. 作業スコープ

- 追加・変更する成果物:
  - `plugins/agent-ops/skills/codex-handoff/SKILL.md` — 委譲先を「Claude Code / Codex」の両対応として記述
  - `plugins/agent-ops/references/` 配下の該当ファイル — 「Codex」言及の一般化。実行経路リファレンスは Claude Code 用を新設するか統合するか M0 で提案
  - `plugins/agent-ops/README.md`
  - `plugins/agent-ops/.claude-plugin/plugin.json` と `plugins/agent-ops/.codex-plugin/plugin.json` の description (「external agents (Codex)」の文言)
  - `.claude-plugin/marketplace.json` の agent-ops エントリ description (plugin.json と文言を一致させる)
  - `CHANGELOG.md` の `[Unreleased]` セクションへの追記 (Keep a Changelog 準拠、日本語、既存エントリの文体に合わせる)
- 触ってはいけない既存ファイル: 上記以外すべて。特に `plugins/model-strategy/`、`plugins/quality-architect/`、`plugins/tech-docs/`、`scripts/`、`.github/`、`releases/`、`docs/`、他スキル (`crystallize`、`first-touch-review`) の SKILL.md。

### Claude Code の実行経路 (正典として転記する事実)

Claude Code 用実行経路リファレンスには以下を採用する。これ以外の起動フラグを創作しないこと:

- 対話: `headroom wrap claude`
- 非対話: `headroom wrap claude -- -p --permission-mode acceptEdits "<プロンプト>"` (対象リポジトリを cwd にして実行)
- プロンプトには指示書ファイルの絶対パスを渡し、「最初に全文読んでから作業する」ことを明記する (Codex と同じ規律)
- 長時間実行・worktree 分離・トークン計測プロキシ (headroom) 経由の原則は Codex と共通
- モデル・effort・価格の判断は書かない (model-strategy の担当)

## 3. 非目標

- スキル名 `codex-handoff` の変更 (rename) はしない。ディレクトリ名・スキル名は互換性のため維持し、名前が歴史的経緯であることを SKILL.md 内で一言説明するに留める。
- プラグインのバージョン番号変更・リリース作業はしない。
- `model-strategy` 側への変更 (Claude Code の価格・モデル判断の追加等) はしない。
- 委譲先の自動選択ロジックやスクリプトの追加はしない。ドキュメント (スキル・リファレンス・マニフェスト文言) の変更のみ。
- 既存の運用規律 (M0 ゲート、監査、台帳、Fable 非依存化) の内容変更はしない。委譲先の一般化に必要な語の置換・追記のみ。

## 4. 未確定事項と仮定

- 確認が必要: なし (M0 の質問 2 件に監督役が回答済み。以下に反映)。
  - `.agents/plugins/marketplace.json` への agent-ops の description 追加は**しない**。同ファイルは全エントリが description を持たないスキーマ構成であり、一貫性を優先する。同ファイルは変更対象外 (§7 の jq 検証のみ行う)。
  - §7 の「参照表と references/ の過不足一致」は **handoff 用リファレンス (00〜06 系列 + 新設 `02-execution-claude.md`) のみ**を指す。`10/11/12/20/21` は他スキル (first-touch-review / crystallize) 用であり対象外。
- 仮定して進めてよい (採用した仮定は最終報告に列挙):
  - 用語は「委譲先」で統一し、具体例として「Claude Code / Codex」を並記する。
  - `.codex-plugin` の存在意義 (Codex を監督役にもできる) と、委譲先としての Codex は別概念。混同しない。`.codex-plugin` や監督役としての Codex への言及は残す。

## 5. 事前調査

実装前に行い、M0 の出力に含めること:

1. `plugins/agent-ops/` 配下と両 marketplace.json の「Codex」全言及を `grep -rn` で網羅列挙し、次の 3 分類に振り分ける:
   - (a) 委譲先の例として一般化すべき箇所
   - (b) Codex 固有の実行経路として残すべき箇所
   - (c) 固有名として残すべき箇所 (スキル名、`.codex-plugin`、監督役としての Codex への言及等)
2. SKILL.md 内の参照表 (`references/` の一覧) と実ファイルの対応を確認する。

## 6. マイルストーンと停止点

- M0 (必須): まず実装しないでください。この指示書を満たすために、既存コード・仕様・リスクを調査し、次を短く提示してください。
  1. 実装方針 (実行経路リファレンスの構成案を含む: `02-execution-claude.md` 新設か、`02-execution.md` への統合か。推奨案とその理由を 1 つ)
  2. 変更対象ファイル (§5 の 3 分類の一覧を含む)
  3. 検証方法
  4. 未確定事項 — 「確認が必要」と「合理的に仮定して進められる」に分けること。各項目に、答えによって実装がどう変わるかを 1 行で添えること。
  提示したら停止し、承認を待ってください。
- M1: 承認された方針に従って実装。完了したら §8 の形式で報告して停止。
- 各マイルストーン完了で停止し、承認を待つ。次に着手しない。

## 7. 受け入れ条件

- `jq . plugins/agent-ops/.claude-plugin/plugin.json > /dev/null`
- `jq . plugins/agent-ops/.codex-plugin/plugin.json > /dev/null`
- `jq . .claude-plugin/marketplace.json > /dev/null`
- `jq . .agents/plugins/marketplace.json > /dev/null`
- `bash scripts/verify-versions.sh` が exit 0
- `grep -rn "Codex" plugins/agent-ops/skills/codex-handoff/ plugins/agent-ops/references/` の残存箇所がすべて §5 の分類 (b) または (c) であることの一覧提示
- SKILL.md の参照表と handoff 用リファレンス (00〜06 系列 + `02-execution-claude.md`) が過不足なく一致 (他スキル用 `10/11/12/20/21` は対象外)

## 8. 完了報告フォーマット

1. 変更ファイル一覧
2. 検証コマンドと生ログ (受け入れ条件の全コマンド)
3. 指示書から外れた点・裁量で決めた点
4. 採用した仮定と未解決の質問

## 9. M0 承認記録 (2026-07-04)

M0 は完了し、監督役が以下の実装方針を承認済み。M1 のセッションはこの方針に従うこと。

- 実行経路リファレンスは `plugins/agent-ops/references/02-execution-claude.md` を新設し、既存の `02-execution-codex.md` は Codex 固有経路として残す。`SKILL.md` / `README.md` / `06-operating-protocol.md` は「委譲先に応じて Claude Code 用または Codex 用の実行経路を読む」と一般化する。
- 変更対象ファイル (これ以外に広げない):
  - `plugins/agent-ops/skills/codex-handoff/SKILL.md`
  - `plugins/agent-ops/references/02-execution-claude.md` (新設)
  - `plugins/agent-ops/references/03-preflight-gate.md`
  - `plugins/agent-ops/references/06-operating-protocol.md`
  - `plugins/agent-ops/README.md`
  - `plugins/agent-ops/.claude-plugin/plugin.json`
  - `plugins/agent-ops/.codex-plugin/plugin.json`
  - `.claude-plugin/marketplace.json` (agent-ops エントリの description のみ)
  - `CHANGELOG.md` (`[Unreleased]` への追記のみ)
- `.agents/plugins/marketplace.json` は変更しない (§4 の回答どおり)。
- `crystallize/SKILL.md`、`first-touch-review/SKILL.md`、`05-fable-independence.md` の「Codex」言及は分類 (c) として変更しない。

## 10. M1 監査結果と差し戻し指示 (2026-07-04)

M1 の成果物は受け入れ条件を通過したが、監査で以下 2 件を指摘。M2 (差し戻し修正) ではこの 2 点のみを修正し、他のファイル・行には触れないこと。

1. `plugins/agent-ops/references/03-preflight-gate.md` の強化ゲート第 1 項を元の文面に戻す:
   「1. 異なる 2 モデル (例: Opus 4.8 と Codex) のフレッシュセッションに、同じ指示書を独立にレビューさせる: 「作業はするな。未決定の設計判断・複数解釈できる記述・欠けた受け入れ条件・実行側の予想失敗モードを列挙せよ」。」
   理由: この行は M0 で (c) 固有名として残すと分類済み。「または実行環境」はアンサンブル批評の要点 (モデル多様性) を弱める内容変更であり、§3 非目標に抵触する。同ファイル 7 行目の変更 (「実行担当 (Codex 等)」→「実行担当」) は分類 (a) どおりで受け入れ済み。戻さないこと。
2. `plugins/agent-ops/skills/codex-handoff/SKILL.md` の導入部 (8 行目「外部エージェントへ作業を委譲するとき〜」の直後) に、§3 で指示した一言を追加する:
   「スキル名の `codex-handoff` は歴史的経緯であり、委譲先は Claude Code / Codex のいずれでもよい。」
   (文面はこのまま使ってよい。)

修正後、§7 の受け入れ条件のうち `grep -rn "Codex" ...` と `bash scripts/verify-versions.sh` を再実行し、§8 の形式で報告して停止すること。
