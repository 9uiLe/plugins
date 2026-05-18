# docs-adr — AI 向け使い方ガイド

このファイルは **AI が開発ドキュメント / ADR を HTML で生成するときのリファレンス** です。
プロンプトに添付するか、`CLAUDE.md` 等から参照してください。

---

## 1. 基本ルール

1. すべてのドキュメントは **HTML 1 ファイル**で完結させる。
2. **必ず** `system/tokens.css` と `system/components.css` を読み込む。
3. インタラクション (TOC / コピー / チャート描画 / Mermaid) が必要な場合は `system/components.js` を読み込み、最後に `DocsADR.initAll({...})` を呼ぶ。
4. 新規の色・フォント・スペーシングを **発明しない**。必要なら必ず `var(--*)` トークンから派生させる。
5. 日本語と英語は混在 OK。固有名詞・コード片は英語のまま。

---

## 2. 最小テンプレート

新規ドキュメントは次のスケルトンから始める:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ADR-NNNN · タイトル</title>

  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Noto+Sans+JP:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="system/tokens.css" />
  <link rel="stylesheet" href="system/components.css" />

  <!-- コードハイライト -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-diff.min.js"></script>

  <!-- フロー図 (使う場合のみ) -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
</head>
<body>
  <div class="doc-shell">
    <aside class="doc-toc" id="toc">
      <p class="doc-toc-label">On this page</p>
    </aside>
    <main class="doc-main prose" id="content">
      <h1>ADR-NNNN · タイトル</h1>
      <!-- 本文 -->
    </main>
  </div>

  <script src="system/components.js"></script>
  <script>
    window.addEventListener('load', function () {
      DocsADR.initAll({
        toc: { container: '#toc', content: '#content', selector: 'h2, h3' }
      });
    });
  </script>
</body>
</html>
```

---

## 3. MADR 形式の章立て

ADR を書くときは以下の章立てを推奨 (MADR 準拠):

```
h1: ADR-NNNN · タイトル
  → adr-frontmatter (Status, Date, Deciders, …)
h2: Context              (背景・問題)
h2: Decision Drivers     (判断基準)
h2: Considered Options   (検討した選択肢)
h2: Decision             (決定 — callout--success で強調)
h2: Consequences         (帰結 — Positive / Negative / Neutral)
h2: Compliance & Monitoring (任意・遵守の仕組み)
h2: References           (関連リンク)
```

---

## 4. クラスリファレンス

### 4.1 レイアウト

| クラス | 用途 |
| --- | --- |
| `.doc-shell` | サイドバー TOC + 本文の 2 カラムシェル |
| `.doc-toc` | 左サイドバー TOC (中の `<ul>` は JS が生成) |
| `.doc-main.prose` | 本文。`.prose` で見出し・段落の typography が当たる |

### 4.2 タイポグラフィ (本文中)

- 見出しは `<h1>` 〜 `<h4>` をそのまま使う (`.prose` 配下で自動スタイル)
- リード文は `<p class="lead">…</p>`
- インラインコードは `<code class="inline">…</code>`
- ショートカットキーは `<kbd>⌘</kbd>`
- ハイライトは `<mark>…</mark>`
- 補足色は `.muted` / `.mono`

### 4.3 Callout (注釈)

```html
<div class="callout callout--MODIFIER">
  <span class="callout-icon">i</span>
  <div class="callout-body">
    <p class="callout-title">TITLE</p>
    <p>本文</p>
  </div>
</div>
```

| Modifier | 用途 | アイコン目安 |
| --- | --- | --- |
| `callout--note` | 中立的補足 | `i` |
| `callout--info` | 情報提供 | `i` |
| `callout--tip` | 推奨パターン (アクセント色) | `★` |
| `callout--warning` | 注意・トレードオフ | `!` |
| `callout--danger` | 破壊的変更・禁止 | `!` |
| `callout--success` | 採用された決定 | `✓` |

### 4.4 Badge / Status

```html
<span class="badge">Default</span>
<span class="badge badge--accent">Accent</span>
<span class="badge badge--success">Success</span>
<span class="badge badge--warning">Warning</span>
<span class="badge badge--danger">Danger</span>
<span class="badge badge--info">Info</span>
<span class="badge badge--no-dot">ドット非表示</span>
```

ADR ステータス専用:

```html
<span class="badge status-proposed">Proposed</span>
<span class="badge status-accepted">Accepted</span>
<span class="badge status-deprecated">Deprecated</span>
<span class="badge status-superseded">Superseded</span>
<span class="badge status-rejected">Rejected</span>
```

### 4.5 ADR フロントマター

```html
<div class="adr-frontmatter">
  <div class="adr-frontmatter__field">
    <span class="adr-frontmatter__key">Status</span>
    <span class="adr-frontmatter__value"><span class="badge status-accepted">Accepted</span></span>
  </div>
  <!-- 必要なフィールドを並べる -->
</div>
```

推奨フィールド: `ADR` / `Status` / `Date` / `Deciders` / `Supersedes` / `Tags`。
数値・日付は `.mono` を付けて等幅で。

---

## 5. コードブロック

### 5.1 基本構造

```html
<figure class="code-block">
  <div class="code-block__header">
    <span class="code-block__filename">path/to/file.ts</span>
    <span class="code-block__lang">TypeScript</span>
    <span class="code-block__spacer"></span>
    <!-- コピーボタンは JS が自動挿入 -->
  </div>
  <pre><code class="language-typescript">...</code></pre>
</figure>
```

- Prism が `<code class="language-XYZ">` を読んでハイライトする。
- 対応言語例: `typescript`, `tsx`, `jsx`, `javascript`, `bash`, `json`, `yaml`, `diff`, `go`, `rust`, `html`, `css`, `sql`。
- `&lt;` / `&gt;` / `&amp;` の HTML エスケープを忘れない。

### 5.2 差分 (diff)

`<span class="code-line">` で行を区切り、追加行に `.code-line--add`、削除行に `.code-line--del`、強調行に `.code-line--hl` を付ける:

```html
<pre><code><span class="code-line">unchanged line</span><span class="code-line code-line--del">removed line</span><span class="code-line code-line--add">added line</span></code></pre>
```

> **重要**: `<span class="code-line">` 同士の間に改行や空白を入れない (見た目が崩れる)。1 行を 1 タグで包む。

### 5.3 行番号

`.code-block` に `.code-block--numbered` を追加し、各行を `<span class="code-line">` で包む。

---

## 6. 表

### 6.1 基本

```html
<div class="table-wrap">
  <table class="table">
    <thead><tr><th>col</th><th class="num">数値</th></tr></thead>
    <tbody>
      <tr><td>row</td><td class="num mono">42</td></tr>
    </tbody>
  </table>
</div>
```

- 数値列には `<th class="num">` / `<td class="num">`。等幅にするなら `.mono` も追加。
- 中央寄せは `.center`。

### 6.2 比較表 (○ × △)

```html
<tr class="is-recommended">     <!-- 採用案の行 -->
  <td>Option B</td>
  <td class="center"><span class="cmp-mark cmp-mark--yes"></span></td>
  <td class="center"><span class="cmp-mark cmp-mark--no"></span></td>
  <td class="center"><span class="cmp-mark cmp-mark--mid"></span></td>
  <td class="center"><span class="cmp-mark cmp-mark--na"></span></td>
</tr>
```

| クラス | 表示 |
| --- | --- |
| `cmp-mark--yes` | ○ (緑) |
| `cmp-mark--no` | × (赤) |
| `cmp-mark--mid` | △ (黄) |
| `cmp-mark--na` | – (灰) |

採用案の行には `.is-recommended` を付けると、左に縦線とアクセント背景が付く。

---

## 7. チャート

### 7.1 メトリクスカード

```html
<div class="metrics">
  <div class="metric">
    <span class="metric__label">Label</span>
    <span class="metric__value">142 <span class="unit">ms</span></span>
    <span class="metric__trend metric__trend--down">−18%</span>
  </div>
</div>
```

`metric__trend--up` / `--down` / `--flat`。色は **数値の良し悪し**ではなく **トレンドの方向** を表現。良し悪しは数値そのものとコンテキストで読み取らせる。

### 7.2 棒グラフ — `data-bars`

```html
<div class="bar-chart" data-bars='[
  {"label":"A","value":42,"unit":"s","variant":"success"},
  {"label":"B","value":86,"unit":"s","variant":"warning"},
  {"label":"C","value":312,"unit":"s","variant":"danger","max":350}
]'></div>
```

`variant`: `success` / `warning` / `danger` / `neutral` / なし (= accent)。
`max` を指定すると共通スケールで揃う。

### 7.3 折れ線 — `data-line`

```html
<div class="line-chart" data-line='{
  "title":"週次 P95 (ms)",
  "xLabels":["W1","W2","W3","W4"],
  "series":[
    {"name":"current","values":[220,210,205,198],"variant":"neutral"},
    {"name":"target","values":[null,null,180,148],"variant":"accent"}
  ]
}'></div>
```

`variant`: `accent` / `success` / `neutral` / `warning` / `danger`。
`null` は欠損として描画されない。

### 7.4 ドーナツ — `data-donut`

```html
<div class="donut-chart" data-donut='{
  "center":"68%",
  "label":"coverage",
  "segments":[
    {"label":"unit","value":54},
    {"label":"e2e","value":14},
    {"label":"未","value":32,"color":"#e4e7ec"}
  ]
}'></div>
```

`color` は省略時にプロジェクトのパレットから自動割り当て。

### 7.5 マトリクス (2×2)

```html
<div class="matrix">
  <div class="matrix__y-label">Impact ↑</div>
  <div class="matrix__grid">
    <div class="matrix__cell">
      <span class="matrix__cell-label">Quick Wins</span>
      <div class="matrix__items">
        <span class="matrix__item matrix__item--accent">採用候補</span>
        <span class="matrix__item">その他</span>
      </div>
    </div>
    <!-- Big Bets / Fill-ins / Time-sinks の順で 4 セル -->
  </div>
  <div class="matrix__x-label">→ Effort (大)</div>
</div>
```

セル順は左上 → 右上 → 左下 → 右下。

### 7.6 タイムライン / ガント

```html
<div class="timeline">
  <div class="timeline__scale">
    <span class="timeline__tick">Q1</span>
    <span class="timeline__tick">Q2</span>
    <span class="timeline__tick">Q3</span>
    <span class="timeline__tick">Q4</span>
  </div>
  <div class="timeline__rows">
    <div class="timeline__row">
      <div class="timeline__row-label">タスク名</div>
      <div class="timeline__track">
        <div class="timeline__bar" style="left:10%;width:30%">label</div>
        <div class="timeline__milestone" style="left:42%"></div>
      </div>
    </div>
  </div>
</div>
```

- `left` / `width` は %。
- `timeline__bar--success` / `--warning` / `--neutral` / `--ghost` で色を分ける。
- マイルストーンは `timeline__milestone`。

---

## 8. フロー図 (Mermaid)

`.mermaid-wrap` でくるみ、中に `<pre class="mermaid">` を置く。
`DocsADR.initMermaid()` がプロジェクトのトークンで自動テーマ化する。

```html
<div class="mermaid-wrap">
<pre class="mermaid">
flowchart LR
  A[クライアント] --> B[API Gateway]
  B --> C[Service]
</pre>
  <div class="mermaid-wrap__caption">Figure 1 · タイトル</div>
</div>
```

対応グラフ:
- `flowchart` (システム構成 / フローチャート)
- `sequenceDiagram` (シーケンス図)
- `stateDiagram-v2` (状態遷移)
- `erDiagram` (ER 図)
- `gantt`, `journey`, `classDiagram` も使える

---

## 9. ADR 専用コンポーネント

### 9.1 Decision Tree

意思決定の分岐を Mermaid なしで描ける軽量コンポーネント:

```html
<div class="decision-tree">
  <div class="dt-node">
    <div class="dt-question">質問?</div>
    <div class="dt-branches">
      <div class="dt-branch">
        <span class="dt-branch__label">Yes</span>
        <div class="dt-leaf">結論 A</div>
      </div>
      <div class="dt-branch">
        <span class="dt-branch__label">No</span>
        <div class="dt-leaf dt-leaf--neutral">結論 B</div>
      </div>
    </div>
  </div>
</div>
```

ネスト可。`.dt-leaf` のバリアント: `--success` / `--warning` / `--neutral` / なし (= accent)。

### 9.2 Before / After

```html
<div class="compare">
  <div class="compare__side compare__side--before">
    <h4 class="compare__title">Before</h4>
    <div class="compare__body"><!-- … --></div>
  </div>
  <div class="compare__arrow">→</div>
  <div class="compare__side compare__side--after">
    <h4 class="compare__title">After</h4>
    <div class="compare__body"><!-- … --></div>
  </div>
</div>
```

---

## 10. やってはいけないこと

- ❌ `style="color: #ff0000"` のように任意の色を直書きしない。`var(--color-*)` を使う。
- ❌ Tailwind / Bootstrap などの CSS フレームワークを追加で読み込まない。
- ❌ コードブロック内の `<` `>` `&` の HTML エスケープ忘れ。
- ❌ Mermaid を使わない図を SVG で手描きしない。
- ❌ `body` や `<div>` に直接インラインで margin / padding を山盛りにしない (`--sp-*` を使う)。
- ❌ font-size を px 直書きしない (`--fs-*` を使う)。
- ❌ 絵文字を装飾目的で使わない。

---

## 11. JS API

`window.DocsADR` から利用できます:

```js
DocsADR.initAll({
  toc: { container: '#toc', content: '#content', selector: 'h2, h3' }
});

// 個別:
DocsADR.initCopyButtons();
DocsADR.buildTOC({ container: '#toc', content: '#content' });
DocsADR.initScrollspy({ toc: '#toc' });
DocsADR.renderBars();
DocsADR.renderDonuts();
DocsADR.renderLines();
DocsADR.initMermaid();
DocsADR.initPrism();
```

---

## 12. ファイル一覧

```
/
├── index.html          ← デザインシステムショーケース
├── adr-sample.html     ← MADR 形式のサンプル ADR
├── USAGE.md            ← このファイル
└── system/
    ├── tokens.css      ← デザイントークン (色・フォント・スペーシング)
    ├── components.css  ← 全コンポーネントのスタイル
    └── components.js   ← TOC / コピー / チャート / Mermaid 初期化
```
