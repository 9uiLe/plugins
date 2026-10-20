# Visual Grammar

同じ意味の要素は view と theme をまたいで同じ `data-kind`、`data-evidence`、`data-evidence-backed`、`data-impact` を持つ。表示は `src/components/architecture/` が決め、`src/components/ui/` の shadcn 由来 primitive は意味を決めない。CSS は `styles/globals.css` から build して HTML に inline する。

見た目は Claude Design で作られた仕様（Industry の線画: 無彩色の地、鋼青の強調 1 色、直角、細い罫線、四隅の「+」のトンボ）に従う。設計方針は次の 4 つ。

1. **縦線に統合する。** フロー図とカードを分けず、実行順の縦線（レール）の上に、手順・分岐・状態を 1 行ずつ置く。図と一覧を行き来させない。
2. **根拠はコードで見せる。** 根拠の折りたたみは置かず、説明の隣に実コードを表示する。同じ evidence の抜粋は文書で最初の 1 回だけ表示し、2 回目以降は、同じ抜粋をウィンドウに表示するボタンにする（「コードの抜粋」）。行ごとの注釈で、どの行が本文のどの主張を裏づけるかを示す。
3. **例外だけを目立たせる。** 確認済みの claim にはラベルを付けない。推論は破線、不明は点線の枠とラベルで示す。
4. **見出しは結論にする。** section に finding があれば h2 にその 1 文を置き、問いは小見出しに下げる。

## 要素と根拠

| 意味 | HTML / SVG | 見分け方 |
| --- | --- | --- |
| 対象 system | `data-kind="system"` | 直角の箱。図の中で唯一の強調（`--primary` の 2px の枠と四隅の「+」） |
| Component | `data-kind="component"` | 直角の箱。名前と `summary`（ない場合は `responsibility`） |
| External system | `data-kind="external"` | 破線（7 4）の枠。名前だけを置き、`interaction` は矢印のラベルにする |
| Actor | `data-kind="actor"` | 両端が半円の枠。名前だけを置き、`role` は矢印のラベルにする |
| Data | `data-kind="data"` | 上辺に二本目の線 |
| Observed Claim | `data-evidence="observed"` | ラベルを出さない（属性だけを持つ）。実線の枠 |
| Inferred Claim | `data-evidence="inferred"` | 「推論」の文字を破線の枠で囲む。カード・箱・番号の枠も破線（3 3） |
| Unknown Claim | `data-evidence="unknown"` | 「不明」の文字を点線の枠で囲む。カード・箱の枠も点線（1 3）。「解消方法を見る」へのリンク |
| 根拠付き構造要素 | `data-evidence-backed="true"` と `data-evidence-ids` | ラベルを出さない。根拠はコードの抜粋か、根拠の参照（`data-evidence-ref`）で示す |

色だけで意味を区別しない。状態は文字ラベルと線種（実線・破線・点線）で示す。要素の名前は `explanation-model.json` の glossary から取得し、`data-concept` を付ける。Graph の node 名は SVG の `<title data-concept>` に置く。

| 対象 | Model の分類 | HTML contract |
| --- | --- | --- |
| Component responsibility、purpose、runtime step、exceptional path、decision、finding | Claim | 行・カード・見出しに `data-evidence="observed|inferred|unknown"` |
| Data item、State transition、affected / unaffected impact | 非Claim構造要素 | 行・項目に `data-evidence-backed="true"` と解決可能な `data-evidence-ids` |

`data-evidence` は Source Truth に対する Claim の semantic status を示す。非Claimの Evidence は出所を示すだけで、Observed Claim を意味しない。Evidence が欠けた構造要素は model validation error として表示を拒否し、Unknown Claim へ変換しない。同じ要素に `data-evidence` と `data-evidence-backed` を併記しない。

## 関係

Graph edge の向きは、呼ぶ側 → 呼ばれる側、またはデータの出所 → 行き先。ラベルは model の `depends_on.meaning`、actor の `role`、external の `interaction`、または data の read / write に基づく。依存や通信などの抽象的な語だけにしない。ラベルの HTML / SVG には `.arrow-label` を付け、validator が抽象的なラベルを警告する。

System Context は現行 model contract に従って **actor → subject system**、**subject system → external system** とする。actor の `role` と external の `interaction` は必須で、renderer はラベル文字列から向きを推測しない。双方向の関係が必要になった場合は model schema に方向を明示してから renderer を拡張する。Component dependency は `depends_on.meaning` を必須とする。自己ループも描画し、重複 node ID は拒否する。

配置と線の経路は `elkjs`（ELK Layered、`renderer/layout/elk.ts`）が決める。線は縦と横の直角の経路で引き、同じ graph の箱は同じ幅と高さにそろえて行と列に並べる。`renderer/layout/text.ts` は日本語と Latin identifier の幅を見積もって折り返し、node と edge label の寸法を渡す。まず左から右（LR）に配置し、PC の本文幅（`renderer/layout/diagram.ts` の `frameWidth`、CSS の page・目次・figure の寸法から算出）を超える場合は上から下（TB）に配置し直して、狭いほうを使う。SVG は `components/architecture/graph.tsx` が所有する。`viewBox`、`width`、`role="img"`、`aria-labelledby`、`<title>`、`<desc>` を出力する。SVG は 1:1 で表示し、狭い画面では figure 内を横スクロールさせ、文字を縮小しない。

## 縦線（レール）

`components/architecture/rail.tsx`。各行は左の縦線の列（`--rail-w`）と本文の列からなる。縦線は行ごとの `border-left` で描き、最初の行は印の中心から、最後の行は印の中心まで引く。

| 行 | 縦線上の印 | 本文 |
| --- | --- | --- |
| 開始 | 小さな塗りの四角 | 「開始」と scenario の `trigger` |
| 手順（runtime step） | 番号の四角（`--mark-size`） | 設計図風のカード。上から見出し、参加者（`from → to`）・説明・status、コードの順に縦一列に並べ、コードはカードの幅いっぱいに表示する |
| 分岐（exceptional path） | 20px のひし形と、下向きの矢印 | 「分岐」と `condition`（問いの形）。「はい」は縦線から横へ出て終点のカード（`result`、status、例外のコード）へ入る。「いいえ ↓ 次へ」は次の行があるときだけ |
| 状態 | 塗りの四角 | 状態名の枠。glossary の読者向けの名前（太字）と、コード上の名前（等幅・小さく） |
| 遷移 | 下向きの三角を入れた四角 | カード。見出しは `action`（なければ `event`）。その上に、識別子の `event`（等幅）と、読者向けの名前での `from → to`。「条件」（`guard`）、コード。同じ遷移先への 2 つ目以降に「または」 |
| 構成要素（component map） | 番号の四角 | カード。責務、依存（`→ 依存先: meaning`）、コード |

- 推論・不明の行は、番号の四角とカードの枠を破線・点線にする。
- 行の `id` は `<section>-<番号>`（分岐は `<section>-<番号>x<例外の index>`）。`:target` の行は、カードに 2px の `--accent` の外枠（offset 6px）を付ける。
- 状態遷移は、最初の state から、さらに先へ続く遷移先をたどった本線を縦に並べる。本線から外れる遷移は「別の出口: from → to」の小見出しの下に、別の短い縦線として置く。
- 状態遷移の section では、縦線の上に「全体像」を置く。本線の状態を四角で横 1 列に並べ、間の矢印に操作（`action`）を書く。同じ矢印に操作が 2 つ以上あれば「または」で区切る。本線から外れる操作は、元の状態の下へ下向きの矢印と破線の四角（遷移先）で示す。状態と操作はそれぞれ該当の行へリンクする。幅 740px 以下では出さない。
- runtime の section で手順が 2 つ以上あるときは、縦線の上に「全体像」（手順・ひし形・終点を横 1 列に縮めた図）を置き、各箱から該当の行へリンクする。幅 740px 以下では出さない。

## コードの抜粋

`components/architecture/code.tsx`。Evidence の `line`〜`end_line` を render 時にソースから読み、行番号付きで highlight.js により言語別に色分けする（単色の階調: keyword と型は `--primary`、関数名は `--code-title`、文字列と数値は `--muted-foreground`、コメントは斜体）。

- 見出し行: 種類（コード / テスト / 文書 / 設定など）、ファイルパス（ディレクトリは薄く、ファイル名は太字）、行範囲、シンボル（下線）。見出しは `a.code-ref` で、`data-file`、`data-symbol`、`data-line`、`data-end-line` を持つ。
- `note` は見出しの下に 1 行。
- `annotations` がある場合: 注釈の行に `--accent` 13% の帯と左の 3px の線、注釈の最初の行の行番号の左に番号の四角。注釈の説明（行範囲と本文）は、その注釈の最後の行のすぐ下に、同じ帯のまま区切らずに続けて置く。番号は注釈の最初の行の 1 か所だけに付ける。説明の行は選択できないようにし、コードをコピーしたときに説明が混ざらないようにする。注釈の前後 1 行より外の行は「⋯ 上（間・下）の N 行を表示（L a–b）」の `<details>` に折りたたむ（隠れる行が 2 行以下なら折りたたまない）。注釈がない抜粋は全行を表示する。
- 長い行は抜粋の中で折り返す。続きの行は、その行の先頭の字下げに 2 文字を足した位置から始める（行番号は最初の行にそろえる）。幅 740px 以下では、深い字下げだけでコードの列を超えるため、続きの行は一律に 2 文字下げる。行末の空白も折り返す（`white-space: break-spaces`）。先頭の空白は文字として残すので、コピーしたコードは字下げを保つ。フローの section（縦線）には縦・横のスクロール領域を作らない。
- 公式ドキュメントは抜粋の直下に「公式ドキュメント タイトル ─ 読む箇所」の 1 行。
- 文書全体で、同じ evidence の抜粋は最初の 1 回だけ表示する。2 回目以降は破線の枠の「同じコード: パス:行 シンボル ─ <section 番号> の <場所>で説明」ボタンにする。ボタンはページを移動せず、同じ抜粋をウィンドウ（`popover`）に表示する。読者は今の手順の説明を見たまま、コードを読める。ウィンドウはクリックした位置のすぐ下（収まらなければすぐ上）に、画面からはみ出さないように出す。上下どちらにも収まらない場合は、押したボタンを覆わないよう、空きの大きいほうに合わせてウィンドウを低くする。幅は PC 幅で画面の 46% まで（最大 600px）、740px 以下では画面幅いっぱい。上端の「⠿ 同じコード …」をドラッグするか、そこにフォーカスして矢印キーを押すと移動できる。上端には「説明の場所へ移動」のリンクと「閉じる」ボタンも置く。script が動かない環境では、PC 幅で画面の右上、740px 以下で画面の下に出る。抜粋には `id="code-<evidence id>"` を付ける。
- 根拠の一覧（付録）は置かない。文書のどこにも抜粋がない evidence への参照は、リンクにせずファイル名と行だけを表示する。

## ページ

- ヘッダー: 等幅の小見出し（`ARCHITECTURE EXPLAINER ／ 読者 ／ 根拠: <revision>`）、タイトル（`--text-2xl`）、対象の問い、読み方の枠（「縦線は処理の順序」「コードは説明の隣」「例外だけが目立つ」の 3 つ。固定の文言）。
- 目次: 「QUESTIONS」の下に番号（01、02…、付録は「付」）と問い。PC 幅で左に固定表示（210px）。ページの最大幅は設けない。
- section の見出し: 番号と問いの小見出し、h2（finding の文。ない場合は問いで、小見出しは番号だけ）、finding の根拠へのリンク（「結論の根拠」）、view の種類ごとの読み方の 1 文。
- 幅 740px 以下: 目次を本文の上に移し、読み方の枠は 1 列、縦線の列を 34px、番号の四角を 30px にし、カードを 1 列にする。

## View

| 問いの型 | 表示 |
| --- | --- |
| 概要と責務 | lede、目的の文、設計図風の小さなカード。first view には figure を一つ置く |
| System Context / Data Flow | ELK 配置の SVG と凡例、下に要素の一覧（説明・status・根拠へのリンク） |
| Component Map | ELK 配置の SVG と凡例、下に構成要素の縦線（責務・依存・コード） |
| Sequence / Runtime Flow | 全体像と縦線（開始 → 手順 → 分岐） |
| Annotated Code | 全体像のない縦線 |
| State Transition | 全体像（状態の四角と操作の矢印）、状態と遷移の縦線、別の出口 |
| Decision | 判断ごとの設計図風のカード。「前提 → 判断 → 理由 → 失うもの（→ 代替案）」を、ラベルの列と内容の列の表で示し、判断と理由の欄にコードを置く |
| Before-After | 変更前・変更後のカードを左右に並べ、それぞれにコード |
| Change Impact | `data-impact` と文字ラベルを持つ一覧。不変条件は規則のカード |
| Callout / Takeaway | 設計図風の強調カード。不変条件は「強制しているもの」とコードを添える |
| Known Unknowns | 点線の枠のカード（「不明」、問い、理由、解消方法） |
| References / Code Map | 列見出しと `data-label` を持つ HTML table |

| Impact | 表示 |
| --- | --- |
| `affected` | 「影響あり」の文字と、左に 3px の実線 |
| `unaffected` | 「影響なし」の文字と、左に 1px の実線 |
| `verify` | 「要確認」の文字と、左に 3px の破線（破線は「確証がない」の意味で推論・不明と共通） |

すべての figure は reader question を `data-question` に、`<figcaption>` を持つ（キャプションは見出しと重なるため視覚的には隠し、支援技術には残す）。

## 図の様式

- 枠と線は `--diagram-line`（#7a7a7d、地に対し 3.8:1）、線幅 1.25。箱は地と同じ塗りで、角は直角（利用者だけ半円）。同じ種類の箱は同じ大きさ。
- 線は縦横の直角だけで通し、箱や文字を横切らない。矢印は線と同色の塗りの三角（9px）。ラベルは線から 8px 以上離し、水平な線では上、垂直な線では右に置く。
- 強調は対象 system の 1 つだけ。種類は色ではなく形と線種で区別し、使用した種類だけを形の見本つきの凡例に出す。
- 文字: 名前 14px・700、説明 12.5px（`--diagram-body`）、ラベル 12px。文字幅の見積もり（`renderer/layout/diagram.ts`）と連動する。
- SVG は等倍で表示する。まず左から右（LR）に配置し、本文の列（1280px 幅の基準で `frameWidth`）を超える場合は上から下（TB）に組み直して、狭いほうを使う。それでも収まらなければ図の中だけ横スクロールする。

## デザイントークン

`styles/globals.css` の `:root` に置き、部品の CSS はトークンだけを参照する。書体は外部から読み込まず、システムフォント（日本語はヒラギノ / 游ゴシック、コードは ui-monospace / Menlo）を使う。

| 種類 | トークンと値 |
| --- | --- |
| 面 | `--background` / `--surface` #f2f2f3、`--surface-sunken` #e7e7ea（コードの見出し・行番号）、`--code-bg` #f5f5f8、`--muted` #e9e9ea |
| 文字 | `--foreground` #1d1f20（地に対し 14.8:1）、`--muted-foreground` #5d5d60（5.9:1）、`--text-secondary` #424244 |
| 境界 | `--border` rgba(29,31,32,.16)、`--border-subtle` rgba(29,31,32,.08)、`--diagram-line` #7a7a7d |
| 強調 | `--primary` #416180（文字・線・番号の塗り。白文字 6.5:1）、`--accent` #5980a6（線・帯だけ。文字には使わない）、`--accent-soft` #d6ebff、`--accent-foreground` #1d2d3d |
| 根拠・影響 | `--evidence-*`、`--impact-*` はすべて #1d1f20。区別は線種と文字ラベルで行う |
| コード | `--code-keyword` / `--code-type` #416180、`--code-title` #2c455d、`--code-string` / `--code-number` #5d5d60、`--code-comment` #424244 |
| 余白 | `--space-1`〜`--space-7`（4、8、12、16、24、32、48px） |
| 文字サイズ | `--text-xs` / `-sm` / `-base` / `-lg` / `-xl`（12、14、16、20、32px）、`--text-2xl`（clamp(42px, 5.3vw, 68px)）、`--leading-tight` / `-body` / `-code`（1.35 / 1.8 / 1.65） |
| 形 | `--radius-*` 0（`--radius-pill` 999px は利用者だけ）、`--line` 1px、`--rule` 1.25px、`--rail-w` 72px / `--mark-size` 38px（740px 以下で 34 / 30px） |
| focus | `--focus-ring` 2px solid #5980a6、offset 2px |

theme（`cards`）は色のトークンだけを上書きし、余白・文字・形は変えない。
