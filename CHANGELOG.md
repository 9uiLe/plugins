# Changelog

このリポジトリの主要な変更点を記録します。
フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠し、バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

## [0.3.0] - 2026-07-04

### Changed

- **agent-ops** スキル名を `codex-handoff` から `agent-handoff` にリネーム。旧名でのスキル呼び出しは新名 `agent-handoff` に変わる。

### Fixed

- **agent-ops** を Codex マーケットプレイスマニフェスト (`.agents/plugins/marketplace.json`) に登録 — v0.1.8 収録時からの登録漏れにより、`codex plugin add agent-ops@9uile-plugins` がプラグイン未検出で失敗していた。

### Added

- `scripts/verify-versions.sh` に Codex マニフェスト掲載チェックを追加 — Claude 側 marketplace.json に載る全プラグインが `.agents/plugins/marketplace.json` にも掲載されていることを検査し、登録漏れを CI で検出する。
- **agent-ops** `codex-handoff` の委譲先を Claude Code / Codex 両対応に一般化 — Claude Code 用実行経路 (references/02-execution-claude.md) を追加し、運用プロトコル・参照表・マニフェスト説明を委譲先選択後の運用規律として整理した。
## [0.2.0] - 2026-07-04

### Added

- **agent-ops** `codex-handoff` に着手前ゲート・振り返り台帳・Fable 非依存化プログラムを追加 — 指示書テンプレートへ「非目標」「未確定事項と仮定」「事前調査」セクションと M0 (調査・作戦フェーズ) を追加し、未確定事項を「確認が必要 / 仮定して進められる」の二分類で着手前に回収するゲート (references/03)、委譲ごとの振り返り 4 行 + 4 指標の台帳 (references/04)、ベースライン記録・批評採掘・Fable-off 訓練からなる Fable 非依存化プログラム (references/05) を新設。監査チェックリストに「指示書起因」タグを追加。(#38)
- **agent-ops** 運用プロトコルを追加 — 手順の記憶を台帳先頭の状態ヘッダ (フェーズ / ベースライン件数 / Fable-off カウンタ) へ移し、監督役セッションが発火直後に運用モードを宣言して各ステップの次の行動を提示する自動進行を新設 (references/06)。ユーザーが覚えるのはトリガーフレーズのみ。(#39)

### Changed

- **agent-ops** プラグイン版を v0.1.0 → v0.2.0 に更新。

## [0.1.8] - 2026-07-03

### Added

- プラグイン **agent-ops** (v0.1.0) を収録 — Fable 実行履歴から抽出したエージェント運用規律プラグイン。指示書駆動の外部エージェント委譲と懐疑的監査を行う Skill `codex-handoff`、固定ルーブリックの初見ユーザー評価を実機で反復する Skill `first-touch-review`、セッション知見を lint / script / skill / ADR に資産化する Skill `crystallize`、リファレンス 8 編を提供。
## [0.1.7] - 2026-07-03

### Added

- **quality-architect** (v0.1.5): `quality-review` に差分帰属ラベル（`diff-caused` / `pre-existing` / `unknown`）、CI artifact の整合検証（mtime / `commit_sha` / `target` の照合）、trivial diff fast-path（§2.1）、非対話環境フォールバック、成功基準セルフチェック（§4）を追加。`quality-gate-swift.sh` の出力 JSON に `generated_at` / `commit_sha` / `git_root` / `target` / `source` メタデータを追加し、artifact 検証を裏付け。
- **quality-architect** (v0.1.5): 07a 結合シグナルの merge contract を `references/07a-review-integration.md` へ分離。既定オフの実験層を SKILL 本文から切り出し、coupling シグナル採用時のみ Read する構造に。

### Changed

- **quality-architect** (v0.1.5): `quality-review` SKILL.md を全面改訂（215 → 160 行）。資産インベントリを言語非依存の manifest 駆動に変更し、profile 未定義言語は `profile: none` + 言語横断ツールの `measured-only` フォールバックで対応（Swift 固有ファイルのハードコードを解消）。設計妥当性トリアージを step 2.5 → step 2 に改番し、関連参照 10 箇所（00-overview / README / 07 / 07a / static-evaluation / architecture SKILL / coupling-gate-swift.sh）を同期。

### Fixed

- **quality-architect** (v0.1.5): `quality-gate-swift.sh` / `coupling-gate-swift.sh` の shellcheck SC2086（未クォート変数）を修正。
## [0.1.6] - 2026-07-02

### Added

- **quality-architect** (v0.1.4): 結合・凝集・複雑度・モジュール境界に関する指摘への「削減アクション」必須化。`references/07a-coupling-deep-dive.md` に §6.3.1「削減アクション・カタログ」（検出状況 → 下げる軸 → 具体的手順の対応表と提示書式）を追加し、`quality-review`（step 5・指摘テンプレ・§5）と `quality-architecture`（章 4'・§4）が BALANCE = FALSE の結合・複雑性を検出した際に Khononov のリバランス 3 軸（Strength↓ / Distance↓ / Volatility 隔離）に基づく具体的な削減手順の併記を要求するように。アクションは severity / verdict に影響しない（H9 維持）。
- **model-strategy** (v0.1.1): Codex CLI 対応。`SKILL.md` に実行環境判定（§0.5）と Codex での委譲代替手順（`/model`・`codex exec -m`・低 reasoning effort の別実行）、`references/07-codex.md`（GPT 系モデル価格・reasoning effort・サブスク制限の決定基準）を追加。
- **model-strategy** (v0.1.1): Fable 5 のサブスクリプション提供条件（〜2026-07-07 は週次上限 50% キャップで同梱、以降は API 単価の従量クレジット、セーフガードによる Opus 4.8 自動フォールバック）を `00-pricing.md` §4 に追加し、`01`/`02`/`03`/`SKILL.md` の判断基準を提供フェーズ別に更新。

### Changed

- **quality-architect** (v0.1.4): 両 SKILL.md に verbatim 重複していた Khononov 引用禁則（Pain 式の 2 留保・Instability 代理禁止・H9 片方向）を `07a §9` への単一ソース参照に置換し、規律の二重管理を解消。

### Fixed

- **model-strategy** (v0.1.1): `00-pricing.md` の「Fable 5 は新トークナイザで Opus 系比 30% 増 → 実効 2.6 倍」という誤記載を訂正。Fable 5 のトークナイザは Opus 4.8 と同一で、実効コストは名目通り約 2 倍（30% 増は Opus 4.7 系トークナイザ vs 旧世代モデルの比較）。
## [0.1.5] - 2026-06-15

### Changed

- **quality-architect**: `quality-review` スキルの「特性ごとのチェック」(step 4) に関連度トリアージを追加し、リファレンス `references/0N-*.md` を 9 特性すべて無条件に Read していた挙動を、精査対象と判定した特性のみ遅延ロードする方式へ変更。スコアカードには従来どおり 9 特性すべてを載せ網羅性を維持しつつ、典型的な差分で 1 レビューあたり概算 30,000 トークンのコンテキスト消費を削減。`quality-architecture` は既に重点 2〜4 特性に絞る設計のため変更なし。

## [0.1.4] - 2026-06-12

### Added

- プラグイン **model-strategy** (v0.1.0) を収録 — 従量課金前提でモデル・effort をコスパよく使い分けるためのプラグイン。タスクを分類して最適なモデル (Fable/Opus/Sonnet/Haiku)・effort・実行体制 (メイン or 委譲) を推奨する Skill `model-effort-guide`、安価な委譲先となる Subagent `sonnet-implementer` (Sonnet) / `haiku-scout` (Haiku)、公式ドキュメントに基づくリファレンス 4 編 (価格表 / effort 5 段階 / 決定マトリックス / コスト削減レバー) を提供。

## [0.1.3] - 2026-06-12

### Changed

- **quality-architect**: `quality-architecture` / `quality-review` スキルの frontmatter description を約半分に短縮（計約 1,800 字 → 約 900 字、スキル一覧として毎セッション注入されるコンテキストを概算 280 トークン削減）。起動判断に必要な対象の区別（新規設計 vs 既存コードレビュー）・日本語トリガー・姉妹スキルへの誘導は維持。

## [0.1.2] - 2026-06-05

### Added

- **tech-docs**: Prism (1.29.0) と Mermaid (10.9.1) を `plugins/tech-docs/shared-assets/vendor/` に同梱し、生成 HTML から CDN 参照を排除 (ADR-0002)。オフライン環境・IDE プレビュー・CSP 厳格環境でも装飾を含めて動作するように。`shared-assets/vendor/LICENSES.md` で上流の MIT ライセンスを併記。
- **infra**: vendor 真正性 CI (`shasum -a 256 -c SHA256SUMS`) と CDN URL 混入禁止 grep を `.github/workflows/verify-vendor.yml` に追加。`.gitattributes` で vendor 配下を binary 指定し PR diff のレビュー性を担保。
- **infra**: Prism / Mermaid の四半期バージョン確認用 scheduled workflow (`.github/workflows/vendor-upgrade-check.yml`) と Issue テンプレート (`.github/ISSUE_TEMPLATE/vendor_upgrade.yml`) を追加。Dependabot で追従できない vendor 配下を半自動でフォロー。
- **docs**: `docs/adr/0002-vendor-prism-mermaid.html` を新規追加。`docs/adr/README.md` で ADR インデックスと番号付与ルール (renumber 禁止・欠番許容) を文書化。

### Changed

- **tech-docs**: `skills/create-{adr,doc,spec}/SKILL.md` のアセットコピー手順に `vendor/` を追加し、CDN 利用を禁止する旨を明記。
- **tech-docs**: skeleton テンプレート / サンプル HTML / USAGE.md / README.md のスクリプト参照を `system/vendor/...` の相対パスへ移行。
- **security**: `SECURITY.md` に vendor 配下脆弱性報告経路の境界を一文追加。
## [0.1.1] - 2026-06-04

### Added

- **quality-architect**: 設計時（コードが無い段階）にモジュール境界の結合を検討するための補論 §11（設計時の結合検討）を `references/07a-coupling-deep-dive.md` に新設。定性ヒューリスティクス（§11.1）・設計時結合チェックリスト（§11.2）・§6.5 hint table（レビュー時専用）との混同禁止表（§11.3）を提供。

### Changed

- **quality-architect**: `quality-architecture` スキルの設計ワークフロー（§1 step 3）と出力章立て（§2 章 4'「モジュール境界と結合バランス」）に結合検討の入口を追加。`07-maintainability.md §2.1` から設計時 §11 / レビュー時 §6.5 への分岐リンクを明記。既存のしきい値・ルーティング規律（§5.1）・H9 片方向規律は不変。

## [0.1.0] - 2026-06-02

### Added

- Marketplace マニフェスト (`.claude-plugin/marketplace.json`) を追加。
- プラグイン **tech-docs** を収録 — ADR / 技術仕様書 / 汎用ドキュメントを 1 枚 HTML として生成する 3 つの Skill (`create-adr` / `create-spec` / `create-doc`) を提供。
- プラグイン **quality-architect** を収録 — ISO/IEC 25010:2023 製品品質モデル (9 特性 40 副特性) に基づくアーキテクチャ設計とコードレビューを行う 2 つの Skill (`quality-architecture` / `quality-review`) を提供。各特性の学術/公式リファレンス・ライブラリ付き。
- Issue / Pull Request テンプレート、`CONTRIBUTING.md`、`SECURITY.md` を整備。
- MIT License を採用。

[Unreleased]: https://github.com/9uiLe/plugins/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/9uiLe/plugins/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/9uiLe/plugins/compare/v0.1.8...v0.2.0
[0.1.8]: https://github.com/9uiLe/plugins/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/9uiLe/plugins/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/9uiLe/plugins/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/9uiLe/plugins/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/9uiLe/plugins/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/9uiLe/plugins/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/9uiLe/plugins/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/9uiLe/plugins/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/9uiLe/plugins/releases/tag/v0.1.0
