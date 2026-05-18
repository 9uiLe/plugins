---
name: create-spec
description: Create a technical specification document as a single self-contained HTML file using the tech-docs design system. Use when the user asks to write/draft a tech spec, design doc, RFC, system design, feature spec, or implementation proposal (e.g. "仕様書を書いて", "tech spec を作って", "this feature の設計ドキュメント", "RFC を書きたい").
---

# create-spec — 技術仕様書を書く

このスキルは **技術仕様書 (Tech Spec / Design Doc / RFC) を 1 枚の HTML として生成** します。
完成物はブラウザでそのまま開ける自己完結ファイル + 共有アセットの組み合わせです。

---

## 1. 進め方 (必ずこの順番で)

1. **対象ディレクトリの確認**
   - ユーザーが出力先を明示していなければ、現在の作業ディレクトリ直下に `docs/spec/` を提案し、合意を取る。
   - 既存の spec ディレクトリがあれば、その命名規則 (例: `2026-05-event-bus.html`) に従う。

2. **必要情報を 1 メッセージにまとめて確認**
   ユーザーが既に提供している情報は二重に聞かない。不足分のみ次の項目をまとめて 1 度で質問する:
   - タイトル (簡潔に「何を作るか」)
   - Owner / Status (Draft / In Review / Approved / Implemented)
   - 解こうとしている問題 (Overview)
   - Goals / Non-Goals
   - 現状の仕組み・前提・制約 (Background)
   - 提案する設計 (主要なエンティティ、データフロー、コンポーネント分割)
   - API 仕様 (エンドポイント、リクエスト/レスポンス、エラー)
   - データモデル (主要テーブル / スキーマ / 関係)
   - 実装フェーズ (段階的ロールアウト計画)
   - 運用観点 (Observability / Reliability / Security)
   - リスクとトレードオフ
   - Open Questions / 関連リンク

3. **生成**
   - `${PLUGIN_ROOT}/shared-assets/templates/skeleton-spec.html` を雛形にする。
   - 出力先 (例: `docs/spec/event-bus.html`) に書き出す。
   - 同じディレクトリの `system/` サブディレクトリに共有アセットをコピー (§3)。

4. **報告**
   - 生成パスと未確定の Open Questions を 1 段落で報告。
   - ブラウザで開いて確認するよう促す。

---

## 2. 章立て (雛形から不要な節は削除可)

```
h1: タイトル + eyebrow (Technical Specification)
  → Status / Owner / Last updated
h2: Overview            … 何を解くか・何が変わるか
h2: Goals               … 達成したいこと
  h3: Non-Goals         … 今回扱わないこと
h2: Background          … 現状の仕組み、前提、制約
h2: Proposed Design     … 設計の全体像 (Mermaid 図やコード例)
h2: API                 … エンドポイント・入出力・エラー
h2: Data Model          … エンティティ・関係・主要フィールド
h2: Implementation Plan … 段階的なフェーズ
h2: Operational Concerns
  h3: Observability     … メトリクス・ログ・トレース
  h3: Reliability       … 障害挙動・ロールバック手順
  h3: Security          … 脅威モデル・データ取扱い
h2: Risks & Tradeoffs   … callout--warning で強調
h2: Open Questions      … 未解決の論点
h2: References          … 関連 ADR / 既存ドキュメント
```

- **Proposed Design には必ず図かコード例を入れる**。文字だけで終わらせない。
  - システム構成・データフローは Mermaid (`flowchart` / `sequenceDiagram` / `erDiagram`)
  - 簡単な前後比較は `.compare` (Before / After)
- **API は OpenAPI 風の YAML または curl 例** を `<figure class="code-block">` で示す。
- **Risks & Tradeoffs は `<div class="callout callout--warning">` で目立たせる**。

---

## 3. 共有アセットの配置

仕様書 HTML は `system/tokens.css` / `system/components.css` / `system/components.js` を相対参照する。
出力先と同じ階層に `system/` ディレクトリを **必ず作成し**、以下をコピーする:

```
<output-dir>/
├── event-bus.html             ← 生成した spec
└── system/
    ├── tokens.css
    ├── components.css
    ├── components.js
    └── components/             ← components.css が @import している
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
mkdir -p docs/spec/system
cp -R ${PLUGIN_ROOT}/shared-assets/tokens.css \
      ${PLUGIN_ROOT}/shared-assets/components.css \
      ${PLUGIN_ROOT}/shared-assets/components.js \
      ${PLUGIN_ROOT}/shared-assets/components \
      docs/spec/system/
```

すでに `system/` が存在すれば再コピーせず、新規 HTML のみ追加する。

---

## 4. よく使うコンポーネント

詳細は `${PLUGIN_ROOT}/shared-assets/USAGE.md` を参照。代表的なものだけ:

- **Status pill**: `.badge.status-proposed` / `.status-accepted` ほか
- **メトリクスカード** (パフォーマンス目標など): `.metrics > .metric`
- **棒グラフ** (`data-bars`) / **折れ線** (`data-line`) / **ドーナツ** (`data-donut`)
- **タイムライン** (`.timeline`): 実装フェーズの可視化に向く
- **マトリクス** (`.matrix`): Impact × Effort, Risk × Likelihood などに
- **コードブロック**: `<figure class="code-block">` + `<pre><code class="language-yaml">`
- **Mermaid**: `.mermaid-wrap > pre.mermaid` + caption

---

## 5. やってはいけないこと

- ❌ 任意の色・フォント・サイズを直書きしない (`var(--*)` トークン経由)。
- ❌ Tailwind / Bootstrap 等を追加で読み込まない。
- ❌ コードブロック内の `<` `>` `&` を HTML エスケープし忘れない。
- ❌ 「Proposed Design」を文字だけで終わらせない (図か例を必ず入れる)。
- ❌ Goals に「速くする」「使いやすくする」だけ書かない (定量目標 or 検証可能な基準を 1 つ以上)。

---

## 6. テンプレートを直接見たいとき

雛形そのものを参照したいときは `${PLUGIN_ROOT}/shared-assets/templates/skeleton-spec.html` を読む。
プレースホルダーは `{{...}}` 形式。
