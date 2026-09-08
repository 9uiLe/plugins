# 9uiLe / plugins

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Latest release](https://img.shields.io/github/v/release/9uiLe/plugins?sort=semver&display_name=tag)](https://github.com/9uiLe/plugins/releases)
[![Open issues](https://img.shields.io/github/issues/9uiLe/plugins)](https://github.com/9uiLe/plugins/issues)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Marketplace-8A6FE8)](https://claude.com/claude-code)
[![Codex](https://img.shields.io/badge/Codex-Plugin-111827)](https://openai.com/codex)

Claude Code / Codex で使う、ソフトウェアの設計・レビュー、AI エージェントの利用量管理、スライドからの実務知識抽出のためのプラグイン集です。Marketplace 名は `9uile-plugins` です。必要なプラグインを個別にインストールできます。

## プラグインを選ぶ

| プラグイン | 用途 | 収録スキル |
| --- | --- | --- |
| [quality-architect](./plugins/quality-architect/README.md) | ISO/IEC 25010:2023 の製品品質モデルに基づくアーキテクチャ設計と既存コードのレビュー | `quality-architecture`、`quality-review` |
| [model-strategy](./plugins/model-strategy/README.md) | 送信コンテキスト量、会話の往復回数、モデルの推論設定（effort）、他エージェントへの委譲を考慮した利用方針の選択 | `model-effort-guide` |
| [speakerdeck-knowledge](./plugins/speakerdeck-knowledge/README.md) | SpeakerDeck から実務知識を抽出し、AI 向け Markdown とチーム共有用の図解 HTML を作成 | `speakerdeck-knowledge` |

スキルは、AI エージェントが依頼に応じて読み込む手順書です。設計案を作るには `quality-architecture`、既存のコードや設計を評価するには `quality-review` を使います。`model-effort-guide` は、モデル選択・利用量・委譲方針を明示的に相談するときに使います。

## インストール

`<plugin-name>` を `quality-architect`、`model-strategy`、`speakerdeck-knowledge` のいずれかに置き換えてください。

### Claude Code

Claude Code の会話内で Marketplace を登録し、プラグインをインストールします。

```text
/plugin marketplace add 9uiLe/plugins
/plugin install <plugin-name>@9uile-plugins
```

### Codex

ターミナルで Marketplace を登録し、プラグインを追加します。

```bash
codex plugin marketplace add 9uiLe/plugins
codex plugin add <plugin-name>@9uile-plugins
```

## 使い方

インストールしたプラグインの用途に応じて、対象や目的を添えて依頼します。

| やりたいこと | 依頼例 |
| --- | --- |
| 新規設計 | 「可用性と保守性を重視して、このサービスのアーキテクチャを設計して」 |
| コードレビュー | 「現在の差分を ISO/IEC 25010 の品質特性でレビューして」 |
| モデル・委譲方針の選択 | 「このタスクの利用量を抑えるモデル・effort・委譲方針を決めて」 |
| スライドから知識を抽出 | 「この SpeakerDeck URL から実装に使える知識と、共有用の図解 HTML を作成して」 |

出力内容、必要なツール、任意機能の設定は各プラグインの README を参照してください。

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
│   ├── speakerdeck-knowledge/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── .codex-plugin/plugin.json
│   │   ├── skills/                  ← speakerdeck-knowledge と取得補助・図解用 CSS
│   │   ├── examples/ui-design/      ← 指定スライドでの検証資料
│   │   ├── tests/
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

`.claude-plugin/marketplace.json` と `.agents/plugins/marketplace.json` が、それぞれの環境で配布するプラグインを定義します。各プラグインのマニフェストは `plugins/<name>/` 内にあり、スキル本体は `skills/`、必要時に参照する資料は `references/` に置きます。

## 開発に参加する

変更対象の選び方、ローカルでの導入・検証、Pull Request の手順は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

スキルやプラグインの設計には [コンテキスト効率を考慮した設計指針](./docs/context-efficient-skill-design.md)、バージョン管理と公開には [RELEASING.md](./RELEASING.md) を使います。

## 問い合わせ

- 不具合・改善提案: [GitHub Issues](https://github.com/9uiLe/plugins/issues)。新規 Issue 作成時にバグ報告または機能要望のテンプレートを選んでください。
- 使い方の相談: [GitHub Discussions](https://github.com/9uiLe/plugins/discussions)。
- 脆弱性の非公開報告: [SECURITY.md](./SECURITY.md) の手順に従ってください。

## リリース情報

バージョンごとの変更内容と更新時の注意点は [CHANGELOG.md](./CHANGELOG.md) と [GitHub Releases](https://github.com/9uiLe/plugins/releases) に記載しています。

## ライセンス

[MIT](./LICENSE)
