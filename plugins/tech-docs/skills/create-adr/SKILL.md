---
name: create-adr
description: Create a new Architecture Decision Record (ADR) as a single self-contained HTML file using the tech-docs design system. Use when the user asks to write/draft/create an ADR, document an architectural decision, record a design trade-off, or capture rationale for a technical choice (e.g. "ADR を書いて", "この決定を記録したい", "design decision を残したい").
---

# create-adr — Architecture Decision Record を書く

このスキルは **MADR 形式の ADR を 1 枚の HTML として生成** します。
完成物はブラウザでそのまま開ける自己完結ファイル + 共有アセットの組み合わせです。

---

## 1. 進め方 (必ずこの順番で)

1. **対象ディレクトリの確認**
   - ユーザーが出力先を明示していなければ、現在の作業ディレクトリ直下に `docs/adr/` を提案し、合意を取る。
   - 既存の ADR ディレクトリがあれば、その採番ルール (例: `0001-xxx.html`) に従う。

2. **必要情報を 1 メッセージにまとめて確認**
   ユーザーが既に情報を提供している場合は二重に聞かない。不足している場合のみ、次の項目をまとめて 1 度だけ質問する:
   - タイトル (短く、決定の本質を表す名詞句)
   - ADR 番号 (既存ディレクトリの最大+1 を提案)
   - Status (`Proposed` / `Accepted` / `Deprecated` / `Superseded` / `Rejected`)
   - 決定者 (Deciders) と日付
   - 背景 (Context) — なぜこの決定が必要になったか
   - 検討した選択肢 (最低 2 つ) と各案のメリット/デメリット
   - 採用した案とその理由
   - 想定される帰結 (Positive / Negative / Neutral)
   - 関連リンク / 参考資料 (任意)

3. **生成**
   - `${PLUGIN_ROOT}/shared-assets/templates/skeleton-adr.html` を雛形にする。
   - 出力先 (例: `docs/adr/0007-event-bus-vs-direct-rpc.html`) に書き出す。
   - 同じディレクトリの **`system/` サブディレクトリに共有アセットをコピー** する (詳細は §3)。

4. **報告**
   - 生成したファイルパス、コピーしたアセット、未確定の項目 (Open Questions) を 1 段落で報告する。
   - ブラウザで開いて確認するよう促す (`open <path>` または `python3 -m http.server` を案内)。

---

## 2. 章立て (MADR — 雛形から不要な節は削除可)

```
h1: ADR-NNNN · タイトル
  → adr-frontmatter (ADR / Status / Date / Deciders / Tags)
h2: Context              … 背景と問題
h2: Decision Drivers     … 判断基準 (箇条書き)
h2: Considered Options   … 各案の説明 + 比較表
h2: Decision             … 結論 (callout--success で強調)
h2: Consequences         … Positive / Negative / Neutral
h2: Compliance & Monitoring  … 任意 (遵守を担保する仕組み)
h2: References
```

- **Decision は必ず `<div class="callout callout--success">` で強調する** (採用案と理由を 1〜2 段落)。
- **Considered Options には比較表を入れる**。採用案の行に `.is-recommended` を付ける。
- 比較表のマークは `cmp-mark--yes` / `--no` / `--mid` / `--na` のみ使う。

---

## 3. 共有アセットの配置

ADR HTML は `system/tokens.css` / `system/components.css` / `system/components.js` を相対参照する。
出力先と同じ階層に `system/` ディレクトリを **必ず作成し**、以下をコピーする:

```
<output-dir>/
├── 0007-xxx.html              ← 生成した ADR
└── system/
    ├── tokens.css
    ├── components.css
    ├── components.js
    ├── components/             ← components.css が @import している
    │   ├── layout.css
    │   ├── typography.css
    │   ├── badge.css
    │   ├── callout.css
    │   ├── code-block.css
    │   ├── table.css
    │   ├── metric.css
    │   ├── bar-chart.css
    │   ├── donut-chart.css
    │   ├── line-chart.css
    │   ├── matrix.css
    │   ├── timeline.css
    │   ├── mermaid.css
    │   ├── decision-tree.css
    │   ├── compare.css
    │   ├── adr-frontmatter.css
    │   └── utilities.css
    └── vendor/                 ← Prism / Mermaid をオフライン同梱 (ADR-0002)
        ├── prism.min.js
        ├── prism-tomorrow.min.css
        ├── prism-components/
        │   └── prism-*.min.js  ← 雛形が参照する言語のみで十分
        └── mermaid.min.js
```

コピー元: `${PLUGIN_ROOT}/shared-assets/`
コピーコマンド例:
```bash
mkdir -p docs/adr/system
cp -R ${PLUGIN_ROOT}/shared-assets/tokens.css \
      ${PLUGIN_ROOT}/shared-assets/components.css \
      ${PLUGIN_ROOT}/shared-assets/components.js \
      ${PLUGIN_ROOT}/shared-assets/components \
      ${PLUGIN_ROOT}/shared-assets/vendor \
      docs/adr/system/
```

すでに `system/` が存在する場合は再コピーせず、新規 ADR HTML のみ追加する。
**CDN は使わない** (オフライン環境・IDE プレビュー・CSP 厳格環境でも動作させるため。詳細: ADR-0002)。

---

## 4. クラスとトークンの選び方

詳細は `${PLUGIN_ROOT}/shared-assets/USAGE.md` を参照する (AI 向けの完全リファレンス)。よく使うものだけここで列挙:

- **Status pill**: `.badge.status-proposed` / `.status-accepted` / `.status-deprecated` / `.status-superseded` / `.status-rejected`
- **Decision callout**: `.callout.callout--success` (採用), `.callout--warning` (トレードオフ警告)
- **比較表**: `.table` + `.cmp-mark--{yes,no,mid,na}` + `.is-recommended`
- **コードブロック**: `<figure class="code-block">` + `<pre><code class="language-XYZ">`
- **意思決定木** (Mermaid を使わない軽量分岐): `.decision-tree` (USAGE.md §9.1)
- **Before/After**: `.compare` (USAGE.md §9.2)

---

## 5. やってはいけないこと

- ❌ 任意の色・フォント・サイズを直書きしない。必ず `var(--*)` トークンから派生させる。
- ❌ Tailwind / Bootstrap 等を読み込まない。
- ❌ コードブロック内の `<` `>` `&` を HTML エスケープし忘れない。
- ❌ 「とりあえず Mermaid」ではなく、分岐は `.decision-tree`、フローや構成は Mermaid と使い分ける。
- ❌ 絵文字を装飾目的で使わない (callout のアイコンは決められた文字のみ)。

---

## 6. テンプレートを直接見たいとき

雛形そのものを参照したいときは `${PLUGIN_ROOT}/shared-assets/templates/skeleton-adr.html` を読む。
プレースホルダーは `{{...}}` 形式。
