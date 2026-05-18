---
name: create-doc
description: Create a general-purpose technical documentation page as a single self-contained HTML file using the tech-docs design system. Use when the user wants a polished HTML document that doesn't fit ADR or spec (runbook, postmortem, onboarding guide, internal handbook, research note, meeting summary, etc.) — e.g. "ドキュメントを HTML で作って", "runbook を書いて", "ポストモーテムをまとめたい".
---

# create-doc — 汎用ドキュメントを書く

このスキルは **ADR / 仕様書以外の汎用ドキュメントを 1 枚の HTML として生成** します。
完成物はブラウザでそのまま開ける自己完結ファイル + 共有アセットの組み合わせです。

ユースケース例: runbook、postmortem、オンボーディングガイド、調査メモ、議事録のまとめ、社内ハンドブック、技術リサーチノートなど。

> **どのスキルを使うか迷ったら**
> - 「採用した設計選択を後から参照可能な形で残したい」 → `create-adr`
> - 「これから作るものの設計を提案・議論したい」 → `create-spec`
> - **それ以外の技術ドキュメント全般** → このスキル

---

## 1. 進め方 (必ずこの順番で)

1. **ドキュメント種別の確認**
   - ユーザーが種別 (runbook / postmortem / onboarding / 調査メモ / その他) を明示していなければ確認する。
   - 種別によって章立てが変わる (§2 参照)。

2. **対象ディレクトリの確認**
   - 出力先が指定されていなければ、種別に応じて提案する:
     - runbook → `docs/runbooks/`
     - postmortem → `docs/postmortems/`
     - その他 → `docs/`
   - 既存ディレクトリがあれば命名規則を踏襲する。

3. **必要情報を 1 メッセージにまとめて確認**
   ユーザーが提供済みのものは再質問しない。不足分のみ 1 度で聞く:
   - タイトル、Owner、最終更新日
   - 種別 (§2 の章立てを選ぶため)
   - 目的 (このドキュメントが読まれる場面)
   - 本文に必要な要素 (手順 / 図 / 表 / コードサンプル / メトリクス)

4. **生成**
   - `${PLUGIN_ROOT}/shared-assets/templates/skeleton-doc.html` を雛形にする。
   - 種別に応じて章立てを差し替える (§2)。
   - 出力先に書き出し、`system/` サブディレクトリに共有アセットをコピー (§3)。

5. **報告**
   - 生成パスとブラウザでの確認方法を案内する。

---

## 2. 種別ごとの推奨章立て

雛形の Summary / Details / References を、種別に応じて以下に置き換える。

### 2.1 Runbook (運用手順書)
```
h2: 概要               … いつ・誰が・何のために使う手順か
h2: Prerequisites      … 事前条件 (権限・ツール・前提)
h2: Procedure          … 手順 (番号付きリスト + コード例)
h2: Verification       … 成功確認 (メトリクスやコマンド)
h2: Rollback           … 戻し方
h2: Troubleshooting    … よくある失敗パターン (callout--warning)
h2: References
```

### 2.2 Postmortem (障害事後分析)
```
h2: Summary            … 何が起きたか 2〜3 行
  → status pill (Resolved / Mitigated)
h2: Impact             … 影響 (顧客数 / 売上 / 期間) — metrics カード推奨
h2: Timeline           … 時系列の出来事 (.timeline コンポーネント可)
h2: Root Cause         … 根本原因 (callout--danger / --warning)
h2: Resolution         … 対応した内容 (callout--success)
h2: Detection Gap      … なぜ早く気づけなかったか
h2: Action Items       … フォロー TODO (担当者・期日付きテーブル)
h2: Lessons Learned
```

### 2.3 Onboarding / オンボーディングガイド
```
h2: Welcome
h2: Day 1 Setup        … 環境構築 (コードブロック多用)
h2: Codebase Tour      … 主要ディレクトリ・モジュールの説明
h2: Key Concepts       … ドメイン用語と概念
h2: First Tasks        … 最初に取り組むイシュー例
h2: Who to Ask         … 質問先 (テーブル: 領域 × 担当者)
h2: Further Reading
```

### 2.4 調査メモ / リサーチノート
```
h2: 背景               … 何を調べたか・なぜか
h2: 調査範囲 / 前提
h2: Findings           … 見つけたこと (発見ごとに小見出し)
h2: Comparison         … 比較した場合は .table + .cmp-mark
h2: 結論 / 推奨        … callout--tip or callout--success
h2: Open Questions
h2: References
```

### 2.5 上記に当てはまらない汎用ドキュメント
雛形の Summary / Details / References のまま、必要に応じて見出しを追加する。
**章立ては自由だが、必ず h2 を 2 個以上にして TOC が機能するようにする**。

---

## 3. 共有アセットの配置

生成 HTML は `system/tokens.css` / `system/components.css` / `system/components.js` を相対参照する。
出力先と同じ階層に `system/` ディレクトリを **必ず作成し**、以下をコピーする:

```
<output-dir>/
├── runbook-restart-worker.html
└── system/
    ├── tokens.css
    ├── components.css
    ├── components.js
    └── components/
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

コピー元: `${PLUGIN_ROOT}/shared-assets/`
コピーコマンド例:
```bash
mkdir -p docs/runbooks/system
cp -R ${PLUGIN_ROOT}/shared-assets/tokens.css \
      ${PLUGIN_ROOT}/shared-assets/components.css \
      ${PLUGIN_ROOT}/shared-assets/components.js \
      ${PLUGIN_ROOT}/shared-assets/components \
      docs/runbooks/system/
```

すでに `system/` があれば再コピーしない。

---

## 4. よく使うコンポーネント

詳細は `${PLUGIN_ROOT}/shared-assets/USAGE.md` を参照。

- **Callout**: `note` / `info` / `tip` / `warning` / `danger` / `success` の 6 バリアント
- **Status pill**: `.badge.status-*`
- **コードブロック**: `<figure class="code-block">` + Prism
- **テーブル**: `.table-wrap > .table`、数値列は `.num.mono`
- **メトリクスカード**: `.metrics > .metric` (postmortem の影響規模に便利)
- **タイムライン**: `.timeline` (postmortem の時系列 / runbook の手順順序)
- **Mermaid**: `.mermaid-wrap > pre.mermaid` (構成図・シーケンス)

---

## 5. やってはいけないこと

- ❌ 任意の色・フォント・サイズを直書きしない (`var(--*)` トークン経由)。
- ❌ Tailwind / Bootstrap 等を追加で読み込まない。
- ❌ コードブロック内の `<` `>` `&` を HTML エスケープし忘れない。
- ❌ Postmortem を非難の文書にしない (人ではなくシステムの問題として書く)。
- ❌ 「いつか書く」プレースホルダーで埋めない (空ならその節を削る)。

---

## 6. テンプレートを直接見たいとき

雛形そのものを参照したいときは `${PLUGIN_ROOT}/shared-assets/templates/skeleton-doc.html` を読む。
プレースホルダーは `{{...}}` 形式。
