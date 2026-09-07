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
| [quality-architect](./plugins/quality-architect) | ISO/IEC 25010:2023 製品品質モデル (9 特性 40 副特性) でアーキテクチャ設計とコードレビューを行う 2 つの Skill (`quality-architecture` / `quality-review`) を提供します。各特性の学術/公式リファレンス・ライブラリ付き。 |
| [model-strategy](./plugins/model-strategy) | 総コンテキスト量・turn 数、モデル / effort、委譲方針を扱う Skill (`model-effort-guide`) を提供します。通常は軽量に運用し、詳細なルーティング監査や conductor mode は明示 opt-in です。 |

モデル選択・利用量・委譲方針を相談する際は `model-effort-guide`、新規設計には `quality-architecture`、既存コードや設計のレビューには `quality-review` を使います。具体例と環境ごとの利用方法は各プラグインの README を参照してください。

## リポジトリ構成

```text
.
├── .claude-plugin/marketplace.json   ← Claude Code Marketplace
├── .agents/plugins/marketplace.json ← Codex Marketplace
├── plugins/
│   ├── quality-architect/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── .codex-plugin/plugin.json
│   │   ├── skills/                  ← quality-architecture / quality-review
│   │   ├── references/              ← 品質特性・静的評価の資料
│   │   ├── scripts/                 ← Swift 向け品質・結合ゲート
│   │   ├── examples/ci/             ← GitHub Actions の導入例
│   │   ├── quality-gates.yml
│   │   └── README.md
│   └── model-strategy/
│       ├── .claude-plugin/plugin.json
│       ├── .codex-plugin/plugin.json
│       ├── skills/                  ← model-effort-guide
│       ├── agents/                  ← Claude Code 向け委譲先・judge
│       ├── hooks/                   ← opt-in の警告・範囲ガード
│       ├── scripts/                 ← ルーティング・ステータス表示
│       ├── references/
│       ├── tests/
│       └── README.md
├── docs/                           ← 設計指針・ADR
├── scripts/                        ← リリース・バージョン検証
├── releases/                       ← リリースノート
├── CHANGELOG.md
├── CONTRIBUTING.md
├── RELEASING.md
├── LICENSE
└── README.md
```

新規プラグインを追加するときは `plugins/<name>/` を作り、Claude Code 用の `.claude-plugin/plugin.json`、Codex 用の `.codex-plugin/plugin.json`、ルートの `.claude-plugin/marketplace.json` / `.agents/plugins/marketplace.json` を更新します。

## 開発

Skill / Plugin を設計・レビューするときは、[コンテキスト効率を考慮した Skill / Plugin 設計](./docs/context-efficient-skill-design.md) を参照してください。常駐instruction、遅延ロードするSkill/reference、subagent、hook/monitorの配置基準と一次資料をまとめています。

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

リリースごとの変更点は [CHANGELOG.md](./CHANGELOG.md) と [GitHub Releases](https://github.com/9uiLe/plugins/releases) にまとめています。

v0.6.0 で `agent-ops`、`compact-plus`、`second-opinion`、`ios-build-optimization` を配布対象から削除しました。更新時の注意点は [v0.6.0 リリースノート](./releases/v0.6.0.md) を参照してください。

## ライセンス

MIT — 詳細は [LICENSE](./LICENSE) を参照してください。
