# HTML Structure

HTML は Presentation IR と Explanation Model を renderer が描いた最終形式である。1 ファイルで開ける standalone HTML とする。この文書は renderer output と、既存 HTML を Review する際の構造 contract である。Create / Improve では `architecture-explainer render` を使う。

## 技術方針

- renderer は `styles/globals.css` から build 時に生成した Tailwind CSS と theme token を `<style>` に inline する。資料固有の CSS を IR に書かない。
- 外部 CDN、外部 font、外部 script を読み込まない。React / TSX は build 時の静的 HTML 生成だけに使う。閲覧時の hydration は不要。
- ナビゲーションは anchor link で作る。追加の開閉には、重要情報を隠さない範囲で `<details>` を使える。

## Information Architecture

Explanation Plan の問いに対応する section だけを、次の順から選んで置く。番号と id は固定し、資料間で同じ id を同じ意味に使う。

| Section id | 見出し | 答える問い |
| --- | --- | --- |
| `what` | What is this? | これは何か（first view） |
| `context` | System Context | 誰・何と接続するか |
| `responsibilities` | Responsibilities | 何が何を担当するか |
| `how-it-works` | How it works | 実行時にどう動くか |
| `state-data` | State / Data | 状態・データがどう変わるか |
| `why` | Why it is designed this way | なぜこの設計か |
| `code` | Where it lives in code | コードのどこにあるか |
| `change` | What happens if I change X? | 変更すると何に影響するか |
| `unknowns` | Known unknowns | 何が分からないか |

ユーザー向け見出しと文章は原則日本語にする。code identifier、API 名、protocol 名、event 名、設定キー、規格・製品名は原文を維持してよい。debugger 向けでは `what` を「症状と結論」とし、`how-it-works` を「問題の起きる経路」と「修正後の経路」に分けてよい。

## ページ骨格

```html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>認証の仕組み — architecture explainer</title>
  <style>/* build 時に生成した CSS を inline */</style>
</head>
<body>
  <a class="skip" href="#main">本文へ移動</a>
  <header class="doc-header">
    <p class="eyebrow">対象: auth / 読者: 新規参加者 / 根拠: commit 1a2b3c4</p>
    <h1>認証の仕組み</h1>
  </header>
  <div class="page">
    <nav class="toc" aria-label="目次">…</nav>
    <main id="main">
      <section id="what" class="first-view">
        <p class="lede">2〜3 行の説明</p>
        <figure class="view" data-question="…">…<figcaption>…</figcaption></figure>
        <p class="takeaway"><strong>要点</strong> …</p>
      </section>
      <section id="context">…</section>
    </main>
  </div>
</body>
</html>
```

- header の `<h1>` に subject、`eyebrow` に audience と Source Truth の版（commit SHA、branch、資料名）を書く。G5 の確認対象になる。
- `<h1>` は 1 つだけにし、section は `<h2>`、その下は `<h3>` と、階層を飛ばさない。

## First view

`#what` には lede、primary visualization 1 つ、takeaway を基本として置く。primary visualization は小さな Overview / System Context または変更理解に必要な短い flow とし、主要要素を絞る。AI 実装レビューでは [visualization-selection.md](visualization-selection.md) の該当する五つの問いに first view だけで答えられるか確認する。詳細な図、diff、file 一覧、全 component は後続 section へ置く。

## 変更前後の説明

既存コードの変更が主要な問いなら、`#change` に変更前 → 変更後 → 変わらないこと → 確認が必要なことを、該当する項目だけ置く。diff の行順ではなく、利用者が観測する振る舞いと条件を示す。たとえば「変更前: 認証の通信エラーを直ちに返す」「変更後: 一時的な通信エラーの場合だけ最大 3 回再試行する」「変わらないこと: 認証情報が不正な場合は再試行しない」。変更前・変更後の各 claim を別々の evidence と status に結び、旧版がなければ変更前を Unknown と表示する（[evidence-rules.md](evidence-rules.md)）。

## Overview と detail

Overview には Plan が選んだ少数の要素だけを置く。後続の section は目次から辿れる。主要 claim の badge から根拠一覧の `#source-<evidence-id>` へ、Unknown の badge から不明点の `#unknown-<unknown-id>` へ移れる。責務文には `data-responsibility` を付け、validator が複数 claim を警告できるようにする。Component Map には同じ `level` の要素だけを置く。

## Figure

```html
<figure class="view" id="view-refresh" data-question="access token の期限切れ時、どの順で refresh されるか">
  …図…
  <figcaption>access token の期限切れ時の refresh。矢印は呼ぶ側 → 呼ばれる側。</figcaption>
</figure>
```

- すべての `<figure>` に、空でない `data-question` と `<figcaption>` を付ける。
- 1 figure に 1 つの問いだけを書く（[visualization-selection.md](visualization-selection.md)）。

## Code linking

- 主要 claim には `a.code-ref`（`data-file`、`data-symbol`）を付ける（[evidence-rules.md](evidence-rules.md)）。
- 主要 concept の表示名には `data-concept` を付け、model の `glossary.concept` と対応させる（[explanation-model.md](explanation-model.md)）。Graph の node 名は SVG 内の `<title data-concept>` に保持する。HTML に別の用語表を作らない。code identifier は初出で preferred term に添える。
- Code Map の各セルには列見出しを `data-label` で付ける（`<td data-label="ファイル">`）。Code Map と Evidence Badge の参照は `#source-<evidence-id>` へ向ける。
- Code Map の source セルでは、file と symbol の意味の区切りの後にだけ `<wbr>` を入れる。file は `/` の後、symbol は `.`・`::` の後と、英数字に続く `_` の後。`<wbr>` は文字を足さないので、表示上の折り返し位置だけが変わり、コピー・検索・`data-symbol` の値には影響しない。

  ```html
  <td data-label="source"><span class="src-file">app/<wbr>auth/<wbr>session_store.py</span><span class="src-symbol">SessionStore.<wbr>rotate</span></td>
  ```
- リポジトリの Web URL が分かる場合は、Code Map の行に外部リンクを追加する。分からない場合は相対パスの文字列にとどめる。

## Known unknowns

`known_unknowns` view には、Explanation Model の `unknowns` を問い / 判断できない理由 / 解消方法のカードで置く。文書末尾の不明点一覧にはすべての `unknowns` を置き、本文の `unknown` badge からその行へリンクする。

## Responsive と interaction

- 本文の行長は約 72 文字幅に収め、図と表は横幅いっぱいまで使う。
- 狭い画面では目次を本文の上へ移す。表は `<div class="table-wrap">` か `figure.view` の中に置き、収まらない場合はその中で横スクロールさせる。SVG の幅は [visual-grammar.md](visual-grammar.md) の規則に従う。
- interaction を作る場合は、`<button>` か `<a>` を使い、keyboard で操作でき、focus が見えるようにする。`div` に click handler を付けない。
- `<details>` の中身は閉じたままでは印刷されない。印刷で読ませる必要がある情報は `<details>` の外に置く。

## Accessibility と usability の確認項目

- heading hierarchy
- 十分な文字コントラスト（theme の色を変更した場合は確認する）
- interaction がある箇所の keyboard 操作と focus の可視性
- SVG の `<title>` / `<desc>`、または `aria-label`
- 色だけで意味を区別しない（形・線種・文字ラベル）
- 読みやすい文字サイズと行長
- 画面幅を変えたときに崩れない
