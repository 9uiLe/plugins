# Changelog

このリポジトリの主要な変更点を記録します。
フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠し、バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [Unreleased]

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

[Unreleased]: https://github.com/9uiLe/plugins/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/9uiLe/plugins/releases/tag/v0.1.0
