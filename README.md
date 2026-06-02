# 9uiLe / plugins

[Claude Code](https://claude.com/claude-code) 用プラグインを集めた Marketplace リポジトリです。

## インストール

Claude Code 上で次を実行してください:

```
/plugin marketplace add 9uiLe/plugins
```

その後、利用したいプラグインだけを個別にインストールします:

```
/plugin install <plugin-name>@9uile-plugins
```

## 収録プラグイン

| Name | Description |
| --- | --- |
| [tech-docs](./plugins/tech-docs) | ADR / 技術仕様書 / 汎用ドキュメントを、デザインシステム付きの 1 枚 HTML として生成する 3 つの Skill (`create-adr` / `create-spec` / `create-doc`) を提供します。 |
| [quality-architect](./plugins/quality-architect) | ISO/IEC 25010:2023 製品品質モデル (9 特性 40 副特性) でアーキテクチャ設計とコードレビューを行う 2 つの Skill (`quality-architecture` / `quality-review`) を提供します。各特性の学術/公式リファレンス・ライブラリ付き。 |

## リポジトリ構成

```
.
├── .claude-plugin/
│   └── marketplace.json     ← Marketplace マニフェスト
├── plugins/
│   └── tech-docs/
│       ├── .claude-plugin/plugin.json
│       ├── skills/
│       │   ├── create-adr/SKILL.md
│       │   ├── create-spec/SKILL.md
│       │   └── create-doc/SKILL.md
│       ├── shared-assets/   ← デザインシステム + テンプレート
│       └── README.md
├── LICENSE
└── README.md
```

新規プラグインを追加するときは `plugins/<name>/` を作り、`.claude-plugin/marketplace.json` の `plugins` 配列にエントリを追加します。

## 開発

ローカルで動作確認するときは、リポジトリをローカルパスとして Marketplace に登録できます:

```
/plugin marketplace add /path/to/this/repo
```

## 不具合報告・改善提案

バグや改善のアイデアは GitHub Issue で受け付けています。リポジトリの **Issues → New issue** から、目的に合ったテンプレート（🐞 バグ報告 / ✨ 改善・機能要望）を選んで起票してください。

起票や Pull Request の手順、修正時に押さえておくべきリポジトリ構成は [CONTRIBUTING.md](./CONTRIBUTING.md) にまとめています。

## ライセンス

MIT — 詳細は [LICENSE](./LICENSE) を参照してください。
