# Presentation IR

`explanation-model.json` は claim、Evidence、Observed / Inferred / Unknown、用語の正本である。`presentation-ir.json` は Explanation Plan を実行可能にした表示指示で、semantic claim の本文を複製しない。

```text
Source Truth → Evidence → Explanation Model → Reader Questions → Explanation Plan
→ presentation-ir.json → render_explainer.py → standalone HTML → validate_explainer.py
```

## Schema

```json
{
  "template": "doc",
  "theme": "technical",
  "sections": [
    {
      "id": "what",
      "question": "これは何をする仕組みか",
      "view": "overview",
      "sources": ["purpose", "cmp-auth", "rt-refresh"],
      "density": "comfortable",
      "emphasis": "normal"
    }
  ]
}
```

- `template`: `doc`。線形説明と目次を持つ。`sheet` は未実装。
- `theme`: `technical` または `cards`。変更しても claim、status、Evidence、section 選択は変わらない。
- `sections`: 表示順。各 section は独立した reader question を一つ持つ。`id` は小文字・数字・ハイフンの anchor。最初の section は `id: "what"`, `view: "overview"` とし、`sources` に `purpose` を含める。
- `question`: figure の `data-question` と caption、section heading の原文。
- `view`: 下表の値。`sources` が指す model 要素との適合を renderer が検査する。
- `sources`: Explanation Model の安定した ID の配列。`purpose` だけは固定 ID。`code_map` では evidence ID を source として選択できる。claim 本文、Evidence の内容、status、表示名を IR に書かない。表示順が必要な場合は配列順を使う。
- `density`: 省略時 `comfortable`、任意で `compact`。`emphasis`: 省略時 `normal`、任意で `strong`。CSS 上の高レベル hint で、claim の選択には影響しない。

| View | 主な Model source | Renderer の表現 |
| --- | --- | --- |
| `overview` | `purpose`、最大 3 つの actor / external / component、必要な scenario / change | first view の lede、HTML card、takeaway。reviewer では model に runtime / change があれば該当 source を選ぶ |
| `system_context` | actor、external | 対象 system と接点の SVG graph |
| `component_map` | 同一 level の component | 責務と意味付き依存の SVG graph |
| `sequence` | scenario 1 つ | actor → action → target の順序付き HTML |
| `runtime_flow` | scenario 1 つ | 番号付き HTML step と例外経路 |
| `state_transition` | state | event、guard、遷移先の表 |
| `data_flow` | data | 書き手、data、読み手の SVG graph |
| `decision` | decision | 判断、理由、trade-off と個別の Evidence status |
| `before_after` | change | 変更前と変更後を別 claim として表示 |
| `change_impact` | change、invariant | 影響あり / なし / 要確認と不変条件 |
| `code_map` | component、evidence | file と symbol の表 |
| `known_unknowns` | unknown | 問い、判断できない理由、解消方法の表 |
| `callout` / `takeaway` | purpose、component、decision、invariant、change、unknown の適合要素 | 強調カード |

`system_context` / `component_map` / `data_flow` の node と edge の座標は renderer の `graph_layout.py` が計算する。日本語と code identifier の表示幅を見積もって折り返し、node 高さを決める。edge label は node 間の lane に置く。狭い画面では SVG の文字を縮小せず figure 内で横スクロールする。最初の小規模 Overview は HTML card を使う。

## 実行

```bash
python3 scripts/render_explainer.py presentation-ir.json --model explanation-model.json -o index.html
python3 scripts/validate_explainer.py index.html --model explanation-model.json --source-root /path/to/source
```

renderer は入力 ID、view との適合、抽象度、Evidence の存在を検査してから HTML を出す。validator は独立に HTML の standalone、見出し、anchor、figure contract、code ref、用語、change evidence、accessibility、日本語の明確さを検査する。Source Truth に照らした claim の真偽と根拠の十分性は人が Review / Hard Gate で判断する。

IR を変更して section、順序、audience に対応する問い、theme を調整できる。audience と depth の変更は先に Explanation Plan と IR の source 選択へ反映し、必要な claim が model にない場合だけ Source Truth から Evidence を集め直す。section 単位の patch API と IR の HTML 内埋め込みは未実装であり、IR を編集してページ全体を再 render する。
