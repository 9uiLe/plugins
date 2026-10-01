# Visual Grammar

同じ意味の要素は、どの資料・どの view でも同じ見た目にする。各要素は形・線種・文字ラベルで区別し、色は補助にとどめる。class とトークンは `assets/explainer-base.css` に定義してあり、HTML へ inline する。

## 要素

| 意味 | `data-kind` | 形 | 線種 | 文字ラベル |
| --- | --- | --- | --- | --- |
| 説明対象の system | `system` | 角丸矩形 | 太い実線 | 名前 + 責務 |
| Component | `component` | 矩形 | 実線 | 名前 + 責務 1 行 |
| External system | `external` | 矩形 | 破線 | 「外部」+ 名前 + やり取りの内容 |
| User / Actor | `actor` | pill（両端が丸い） | 実線 | 役割名（「利用者」「運用者」） |
| Data store | `data` | 上辺が二重線の矩形（SVG では円筒） | 実線 | 「データ」+ 名前 + 保持する内容 |
| State | `state` | pill | 実線 | 状態名 |
| Decision | `decision` | 左に太線のあるカード | 実線 | 「判断」+ 判断内容 |
| Warning / Risk | `risk` | 左に太線のあるカード | 実線 | 「注意」+ 内容 |
| Boundary | `boundary` | 内側に要素を含む矩形 | 長い破線 | 左上に境界名（「App」「Process」「外部ネットワーク」） |

Inferred と Unknown は要素の種類ではなく、要素や関係に重ねる status として扱う。

| Status | 表現 |
| --- | --- |
| Observed | 通常の表示 + code ref |
| Inferred | 点線の外枠 + 「推論」badge |
| Unknown | 点線の外枠 + 「不明」badge + `?` |

## 関係（矢印）

すべての矢印にラベルを付け、依存・呼び出しの意味を書く（「refresh を要求」「user id で検索」）。ラベルのない矢印は作らない。

| 意味 | 線 | 例 |
| --- | --- | --- |
| 同期呼び出し・依存 | 実線 + 塗りの矢じり | `View ── referral code を要求 ──▶ UseCase` |
| 非同期 message / event | 破線 + 開いた矢じり | `Queue ┄┄ OrderPlaced ┄┄▷ Worker` |
| データの流れ | 細い実線 + 矢じり、ラベルはデータ名 | `API ── 署名済み token ──▶ Client` |
| 失敗・例外経路 | 実線 + 「失敗時」ラベル | `Store ── 失敗時: 401 ──▶ Client` |

矢印の向きは「呼ぶ側 → 呼ばれる側」または「データの出所 → 行き先」に統一し、view の caption にどちらかを書く。

## Change impact

| 区分 | `data-impact` | 表現 |
| --- | --- | --- |
| 影響あり | `affected` | 太い実線 + 「影響あり」 |
| 影響なし | `unaffected` | 細い実線、文字色を弱める + 「影響なし」 |
| 要確認 | `verify` | 破線 + 「要確認」 |

## HTML で描く図

空間配置が理解の中心でない図は、SVG ではなく HTML の構造で描く。折り返し、検索、文字の拡大に強い。

| Class | 用途 | 構造 |
| --- | --- | --- |
| `.map` | Component / Responsibility Map | `<div class="map">` の中に `.node` カード。カード内に責務、依存先と意味 |
| `.seq` | Sequence | `<ol class="seq">` の各 `<li>` に `<span class="lane">送信元</span><span class="msg">内容</span><span class="lane">宛先</span>`。例外は `<li class="alt">` |
| `.flow` | 単一 component 内の手順 | `<ol class="flow">` の番号付き step |
| `.states` | State の遷移表 | `<table class="states">`（遷移元 / event [guard] / action / 遷移先） |
| `.decision` | Decision / Trade-off | `<article class="decision">` に context / decision / rationale / trade-off / 根拠 |
| `.impact` | Change Impact | 入れ子の `<ul class="impact">`、各 `<li data-impact="…">` |
| `.codemap` | Code Map | `<table class="codemap">`。列は component / 責務 / file / symbol の順で、関連 claim は必要なら最後に足す（CSS は 3・4 列目を file / symbol として扱う）。各 `<td>` に列見出しと同じ `data-label` を付ける。狭い画面では行がラベル付きの縦並びになる |
| `.annotated` | Annotated Code | `<pre class="annotated">` 内の `<mark data-note="1">` と、続く `<ol class="notes">` |

図の要素は `class="node"` と `data-kind` を持つ。SVG でも `<g class="node" data-kind="component">` とする。validator はこの数で view の要素数を数える。

## SVG の規則

- `<svg viewBox="…" role="img" aria-labelledby="…">` とし、最初の子に `<title>`、続けて図の要点を述べる `<desc>` を置く。
- `width` 属性に viewBox と同じ幅を書く。広い画面では CSS が figure の幅に合わせ、狭い画面では縮小せず figure の中で横スクロールさせて、文字を読める大きさに保つ。
- 狭い画面でも横スクロールなしで読ませたい少数要素の図（first view の文脈図など）は、SVG ではなく `.map` と `.boundary` で描くと折り返せる。
- marker などの `id` は、ページ全体で一意にする（`arrow-ctx`、`arrow-deploy` のように view 名を付ける）。
- 文字は `<text>` で書き、画像化しない。表示サイズで 13px 相当以上にする。
- 色は CSS 変数（`var(--c-component)` など）を使い、SVG 内に独自の色を増やさない。

## 凡例

図に 2 種類以上の `data-kind`、status、矢印の意味が現れる場合は、figure の下に `.legend` を置く。凡例は、その図で使っているものだけを載せる。
