# 9uiLe / plugins

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Latest release](https://img.shields.io/github/v/release/9uiLe/plugins?sort=semver&display_name=tag)](https://github.com/9uiLe/plugins/releases)
[![Open issues](https://img.shields.io/github/issues/9uiLe/plugins)](https://github.com/9uiLe/plugins/issues)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Marketplace-8A6FE8)](https://claude.com/claude-code)
[![Codex](https://img.shields.io/badge/Codex-Plugin-111827)](https://openai.com/codex)

Claude Code / Codex で使う、AI エージェントの利用量管理、スライドからの実務知識抽出、コードとアーキテクチャの説明資料作成、変更しやすいコードの設計・レビューのためのプラグイン集です。Marketplace 名は `9uile-plugins` です。必要なプラグインを個別にインストールできます。

## プラグインを選ぶ

| プラグイン | 用途 | 収録スキル |
| --- | --- | --- |
| [model-strategy](./plugins/model-strategy/README.md) | 送信コンテキスト量、会話の往復回数、モデルの推論設定（effort）、他エージェントへの委譲を考慮した利用方針の選択 | `model-effort-guide` |
| [speakerdeck-knowledge](./plugins/speakerdeck-knowledge/README.md) | SpeakerDeck から実務知識を抽出し、AI 向け Markdown とチーム共有用の図解 HTML を作成 | `speakerdeck-knowledge` |
| [architecture-explainer](./plugins/architecture-explainer/README.md) | コードとアーキテクチャを、根拠つきで目的・構成・実行時の動き・コード・設計理由・変更影響を辿れる HTML 説明資料にし、既存資料の評価・改善も行う | `architecture-explainer` |
| [engineering-principles](./plugins/engineering-principles/README.md) | Test で仕様（What）、コードで実現方法（How）、Documentation で文脈（Context）を表し、状態設計・Test の責務・責務分離・結合・Code と Documentation の整合を確認して、仕様変更を局所的にする実装・レビュー・改善 | `maintainable-code` |

スキルは、AI エージェントが依頼に応じて読み込む手順書です。`model-effort-guide` は、モデル選択・利用量・委譲方針を明示的に相談するときに使います。

## インストール

`<plugin-name>` を `model-strategy`、`speakerdeck-knowledge`、`architecture-explainer`、`engineering-principles` のいずれかに置き換えてください。

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
| モデル・委譲方針の選択 | 「このタスクの利用量を抑えるモデル・effort・委譲方針を決めて」 |
| スライドから知識を抽出 | 「この SpeakerDeck URL から実装に使える知識と、共有用の図解 HTML を作成して」 |
| アーキテクチャの説明資料 | 「この Repository の認証アーキテクチャを、新規参加者向けに HTML で説明して」 |
| 変更しやすさの観点でレビュー | 「maintainable-code の観点でこの変更をレビューして」 |

出力内容、必要なツール、任意機能の設定は各プラグインの README を参照してください。

## リポジトリ構成

```text
.
├── .claude-plugin/marketplace.json   ← Claude Code Marketplace
├── .agents/plugins/marketplace.json ← Codex Marketplace
├── plugins/
│   ├── architecture-explainer/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── .codex-plugin/plugin.json
│   │   ├── skills/                  ← architecture-explainer と validator・説明資料用 CSS
│   │   ├── tests/
│   │   └── README.md
│   ├── engineering-principles/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── .codex-plugin/plugin.json
│   │   ├── skills/                  ← maintainable-code
│   │   └── README.md
│   ├── speakerdeck-knowledge/
│   │   ├── .claude-plugin/plugin.json
│   │   ├── .codex-plugin/plugin.json
│   │   ├── skills/                  ← speakerdeck-knowledge と取得・画像生成補助・図解用 CSS
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
├── docs/                           ← 設計指針・運用記録
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
