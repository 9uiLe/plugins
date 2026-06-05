# Changelog

このリポジトリの主要な変更点を記録します。
フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠し、バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

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

[Unreleased]: https://github.com/9uiLe/plugins/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/9uiLe/plugins/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/9uiLe/plugins/releases/tag/v0.1.0
