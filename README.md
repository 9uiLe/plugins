# 9uiLe / plugins

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Latest release](https://img.shields.io/github/v/release/9uiLe/plugins?sort=semver&display_name=tag)](https://github.com/9uiLe/plugins/releases)
[![Open issues](https://img.shields.io/github/issues/9uiLe/plugins)](https://github.com/9uiLe/plugins/issues)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Marketplace-8A6FE8)](https://claude.com/claude-code)
[![Codex](https://img.shields.io/badge/Codex-Plugin-111827)](https://openai.com/codex)

[Claude Code](https://claude.com/claude-code) / Codex 用プラグインを集めた Marketplace リポジトリです。

## インストール

### Claude Code

Claude Code 上で次を実行してください。

```
/plugin marketplace add 9uiLe/plugins
```

その後、利用したいプラグインだけを個別にインストールします:

```
/plugin install <plugin-name>@9uile-plugins
```

### Codex

Codex では、このリポジトリを Marketplace として登録してからプラグインを追加します。

```bash
codex plugin marketplace add 9uiLe/plugins
codex plugin add <plugin-name>@9uile-plugins
```

## 収録プラグイン

| Name | Description |
| --- | --- |
| [tech-docs](./plugins/tech-docs) | ADR / 技術仕様書 / 汎用ドキュメントを、デザインシステム付きの 1 枚 HTML として生成する 3 つの Skill (`create-adr` / `create-spec` / `create-doc`) を提供します。 |
| [quality-architect](./plugins/quality-architect) | ISO/IEC 25010:2023 製品品質モデル (9 特性 40 副特性) でアーキテクチャ設計とコードレビューを行う 2 つの Skill (`quality-architecture` / `quality-review`) を提供します。各特性の学術/公式リファレンス・ライブラリ付き。 |
| [model-strategy](./plugins/model-strategy) | 従量課金前提でモデル (Fable/Opus/Sonnet/Haiku) と effort をコスパよく使い分ける Skill (`model-effort-guide`) と、安価な委譲先サブエージェント (`sonnet-implementer` / `haiku-scout`) を提供します。公式価格リファレンス付き。 |
| [agent-ops](./plugins/agent-ops) | エージェント開発を「指示書・証拠・反復」で運用する 3 つの Skill (`agent-handoff` / `first-touch-review` / `crystallize`) を提供します。外部エージェント (Claude Code / Codex) への handoff 駆動委譲、懐疑的監査、固定ルーブリックの first-touch UX レビュー、セッション知見の資産化に対応します。 |
| [compact-plus](./plugins/compact-plus) | Claude Code の `/compact` 前後でセッション状態を保存・復元します。transcript backup、LLM 生成の state file、閾値超過時の `/compact` 推奨通知、圧縮後の復旧誘導を hook で提供します ([u-ichi/compact-plus](https://github.com/u-ichi/compact-plus) (MIT) の移植)。 |
| [second-opinion](./plugins/second-opinion) | 現在のセッションを機械抽出する独立レビュー Skill (`second-opinion`) と、証拠の十分性・モデル役割・反論・懸念・不足情報を可視化して意思決定を記録する Skill (`decision-council`) を提供します。Orca は任意の transport であり必須ではありません。 |
| [ios-build-optimization](./plugins/ios-build-optimization) | 大規模 iOS アプリ (Swift / SwiftPM / Xcode) のビルド時間とモジュール構成を評価・改善する Skill (`ios-build-optimization`) を提供します。Build Timeline に基づくボトルネック分類、依存グラフ指標による Target/Package/linkage 判断、根拠ラベル付き提案と計測計画を出力します。一次資料 (WWDC / Swift 公式) のリファレンス付き。 |

## リポジトリ構成

```
.
├── .claude-plugin/
│   └── marketplace.json     ← Claude Code Marketplace マニフェスト
├── .agents/
│   └── plugins/
│       └── marketplace.json ← Codex Marketplace マニフェスト
├── plugins/
│   └── tech-docs/
│       ├── .claude-plugin/plugin.json
│       ├── .codex-plugin/plugin.json
│       ├── skills/
│       │   ├── create-adr/SKILL.md
│       │   ├── create-spec/SKILL.md
│       │   └── create-doc/SKILL.md
│       ├── shared-assets/   ← デザインシステム + テンプレート
│       └── README.md
├── LICENSE
└── README.md
```

新規プラグインを追加するときは `plugins/<name>/` を作り、Claude Code 用の `.claude-plugin/plugin.json`、Codex 用の `.codex-plugin/plugin.json`、ルートの `.claude-plugin/marketplace.json` / `.agents/plugins/marketplace.json` を更新します。

## 開発

ローカルで動作確認するときは、リポジトリをローカルパスとして Marketplace に登録できます。

```
/plugin marketplace add /path/to/this/repo
```

```bash
codex plugin marketplace add /path/to/this/repo
```

## 不具合報告・改善提案

バグや改善のアイデアは GitHub Issue で受け付けています。リポジトリの **Issues → New issue** から、目的に合ったテンプレート（🐞 バグ報告 / ✨ 改善・機能要望）を選んで起票してください。

起票や Pull Request の手順、修正時に押さえておくべきリポジトリ構成は [CONTRIBUTING.md](./CONTRIBUTING.md) にまとめています。

## セキュリティ

脆弱性の報告手順は [SECURITY.md](./SECURITY.md) を参照してください。**公開 Issue ではなく** GitHub の Private Vulnerability Reporting からご連絡ください。

## 変更履歴

リリースごとの変更点は [CHANGELOG.md](./CHANGELOG.md) にまとめています。

## ライセンス

MIT — 詳細は [LICENSE](./LICENSE) を参照してください。
