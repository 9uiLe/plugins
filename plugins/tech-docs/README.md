# tech-docs

Claude Code 用プラグイン。ADR / 技術仕様書 / 汎用ドキュメントを、共通デザインシステム付きの **1 枚 HTML** として生成する 3 つの Skill を提供します。

---

## 何ができるか

このプラグインを有効にすると、Claude Code 上で次の作業が自然言語で依頼できるようになります:

| Skill | いつ呼ばれるか | 章立て |
| --- | --- | --- |
| `create-adr` | ADR / アーキテクチャ決定の記録を作りたいとき | MADR 形式 (Context / Drivers / Options / Decision / Consequences) |
| `create-spec` | 技術仕様書・Design Doc・RFC を書きたいとき | Overview / Goals / Background / Design / API / Implementation / Ops / Risks |
| `create-doc` | runbook / postmortem / onboarding など、上記以外の技術ドキュメント | 種別ごとに最適な章立てを提案 |

出力は **CSS / JS が同梱された静的 HTML** なので、ブラウザでそのまま開けます。Vercel / GitHub Pages / S3 などにそのまま置けます。

---

## インストール

```bash
# Marketplace 経由 (推奨)
/plugin marketplace add 9uiLe/plugins
/plugin install tech-docs@9uile-plugins
```

ローカル開発時はリポジトリを clone してから `~/.claude/settings.json` の `plugins.installed` に直接パスを指定する方法もあります。詳しくは Claude Code の plugin ドキュメントを参照してください。

---

## 使い方

Claude Code 上で次のように依頼します:

```
/create-adr で「event-driven vs request-driven の選択」をまとめて
仕様書を書きたい — payment service の冪等化
postmortem を作って — 2026-05-15 のキャッシュ障害
```

Claude が必要な情報を 1 度だけ確認し、HTML ファイルと `system/` アセットを出力ディレクトリに生成します。

### 生成されるファイル構成

```
docs/adr/                              ← 出力先 (作業ディレクトリからの相対)
├── 0007-event-driven-vs-request-driven.html
└── system/
    ├── tokens.css
    ├── components.css
    ├── components.js
    └── components/                    ← @import 先の細粒度モジュール
        ├── layout.css
        ├── typography.css
        ├── badge.css
        ├── callout.css
        ├── code-block.css
        ├── table.css
        ├── metric.css
        ├── bar-chart.css
        ├── donut-chart.css
        ├── line-chart.css
        ├── matrix.css
        ├── timeline.css
        ├── mermaid.css
        ├── decision-tree.css
        ├── compare.css
        ├── adr-frontmatter.css
        └── utilities.css
```

同じディレクトリに次の ADR / spec を追加すると、`system/` は使い回されます。

---

## デザインシステム

`shared-assets/` 配下にデザインシステム本体を同梱しています。

| ファイル | 役割 |
| --- | --- |
| `tokens.css` | 色 / フォント / スペーシング / モーション等のデザイントークン (CSS Variables) |
| `components.css` | 17 個のコンポーネント CSS を `@import` で束ねるエントリ |
| `components/*.css` | レイアウト / タイポ / バッジ / コールアウト / 表 / 各種チャート / Mermaid / ADR フロントマター / utilities |
| `components.js` | TOC / コピー / scrollspy / 棒・折れ線・ドーナツチャート描画 / Mermaid 初期化 / Prism 初期化 |
| `templates/skeleton-*.html` | ADR / spec / doc 用のスケルトン HTML |
| `samples/` | デザインシステムショーケース + サンプル ADR |
| `USAGE.md` | クラス・コンポーネントの完全リファレンス (AI 向け) |

ライブラリは追加で必要ありません。Prism (シンタックスハイライト) と Mermaid (フロー図) のみ CDN から読み込みます。

---

## サンプルを見たい

```bash
cd plugins/tech-docs/shared-assets/samples
python3 -m http.server 8000
# → http://localhost:8000/showcase.html (全コンポーネントの一覧)
# → http://localhost:8000/adr-sample.html (MADR 形式の ADR サンプル)
```

---

## ライセンス

MIT
