# Visual Grammar

同じ意味の要素は view と theme をまたいで同じ `data-kind`、`data-evidence`、`data-evidence-backed`、`data-impact` を持つ。表示は `src/components/architecture/` が決め、`src/components/ui/` の shadcn 由来 primitive は意味を決めない。CSS は `styles/globals.css` から build して HTML に inline する。

UI token（`--background`、`--card`、`--primary` など）と architecture の意味 token（`--architecture-system`、`--architecture-component`、`--evidence-observed`、`--evidence-backed`、`--impact-affected` など）は分ける。`--evidence-observed` は Claim、`--evidence-backed` は非Claimの表示に使う。theme は UI の色を変えても、要素・根拠・影響の意味を変えない。

## 要素と根拠

| 意味 | HTML / SVG | 見分け方 |
| --- | --- | --- |
| 対象 system | `data-kind="system"` | 角丸矩形、system 色 |
| Component | `data-kind="component"` | 角丸矩形、component 色 |
| External system | `data-kind="external"` | 破線の枠、external 色 |
| Actor | `data-kind="actor"` | 丸みの強い枠、actor 色 |
| Data | `data-kind="data"` | 上辺に二本目の線、data 色 |
| Observed Claim | `data-evidence="observed"` | 「確認済み」badge と根拠へのリンク |
| Inferred Claim | `data-evidence="inferred"` | 「推論」badge、graph node は点線 |
| Unknown Claim | `data-evidence="unknown"` | 「不明」badge、解消方法へのリンク、graph node は点線と `?` |
| 根拠付き構造要素 | `data-evidence-backed="true"` と `data-evidence-ids` | 「根拠あり」marker と根拠へのリンク。Data の SVG node にも可視ラベルを置く |

色だけで意味を区別しない。status は badge と文字で表示する。要素の名前は `explanation-model.json` の glossary から取得し、`data-concept` を付ける。Graph の node 名は SVG の `<title data-concept>` に置く。

| 対象 | Model の分類 | HTML contract |
| --- | --- | --- |
| Component responsibility、purpose、runtime step | Claim | `data-evidence="observed|inferred|unknown"` |
| Data item、State transition、affected / unaffected impact | 非Claim構造要素 | `data-evidence-backed="true"` と解決可能な `data-evidence-ids` |

`data-evidence` は Source Truth に対する Claim の semantic status を示す。非Claimの Evidence は出所を示すだけで、Observed Claim を意味しない。Evidence が欠けた構造要素は model validation error として表示を拒否し、Unknown Claim へ変換しない。HTML の `EvidenceBadge` と `EvidenceMarker` は別 component とし、SVG の Data node も `data-evidence` を持たない。

## 関係

Graph edge の向きは、呼ぶ側 → 呼ばれる側、またはデータの出所 → 行き先。ラベルは model の `depends_on.meaning`、actor の `role`、external の `interaction`、または data の read / write に基づく。依存や通信などの抽象的な語だけにしない。ラベルの HTML / SVG には `.arrow-label` を付け、validator が抽象的なラベルを警告する。

System Context は現行 model contract に従って **actor → subject system**、**subject system → external system** とする。actor の `role` と external の `interaction` は必須で、renderer はラベル文字列から向きを推測しない。双方向の関係が必要になった場合は model schema に方向を明示してから renderer を拡張する。Component dependency は `depends_on.meaning` を必須とする。Dagre は self-loop を描画し、重複 node ID は拒否する。

`@dagrejs/dagre` は配置だけを決める。`renderer/layout/text.ts` は日本語と Latin identifier の幅を見積もって折り返し、node と edge label の寸法を渡す。SVG は `components/architecture/graph.tsx` が所有する。`viewBox`、`width`、`role="img"`、`aria-labelledby`、`<title>`、`<desc>` を出力する。狭い画面では figure 内を横スクロールさせ、文字を縮小しない。

## View

| 問いの型 | 表示 |
| --- | --- |
| 概要と責務 | Card を使う HTML の Overview。first view には figure を一つ置く |
| System Context / Component Map / Data Flow | Dagre 配置の SVG、下に根拠付き要素一覧 |
| Sequence / Runtime Flow | Actor → action → target を追える番号付き HTML |
| State Transition / Code Map | 列見出しと `data-label` を持つ HTML table |
| Decision / Trade-off / Before-After | 判断・理由・前後を別 claim として示す Card |
| Change Impact | `data-impact="affected|unaffected|verify"` と文字ラベルを持つ一覧 |
| Known Unknowns / Callout / Takeaway | Alert または強調 Card |

| Impact | 表示と根拠 |
| --- | --- |
| `affected` | 「影響あり」と affected token。reason と Evidence を表示 |
| `unaffected` | 「影響なし」と unaffected token。reason と Evidence を表示 |
| `verify` | 「要確認」と verify token。確認対象と理由を表示 |

Graph の複数 kind は、その図で使用した kind だけを凡例に出す。すべての figure は reader question を `data-question` に、説明を `<figcaption>` に持つ。
