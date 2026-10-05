# Presentation IR

`explanation-model.json` は claim、Evidence、Observed / Inferred / Unknown、用語の正本である。`presentation-ir.json` は Explanation Plan を実行可能にした表示指示で、semantic claim の本文を複製しない。

```text
Source Truth → Evidence → Explanation Model → Reader Questions → Explanation Plan
→ presentation-ir.json → TypeScript renderer → standalone HTML → TypeScript validator
```

## Schema

```json
{
  "version": 1,
  "template": "doc",
  "theme": "technical",
  "sections": [
    {
      "id": "what",
      "question": "これは何をする仕組みか",
      "type": "overview",
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
- `type`: 下表の値。TypeScript では discriminated union であり、`sources` が指す model 要素との適合も renderer が検査する。
- `sources`: Explanation Model の安定した ID の配列。`purpose` だけは固定 ID。`code_map` では evidence ID を source として選択できる。claim 本文、Evidence の内容、status、表示名を IR に書かない。表示順が必要な場合は配列順を使う。
- `density`: 省略時 `comfortable`、任意で `compact`。`emphasis`: 省略時 `normal`、任意で `strong`。CSS 上の高レベル hint で、claim の選択には影響しない。

Presentation IR は Explanation Plan を実行可能にした表示指示であり、audience policy engine ではない。audience から導出した「必要な問い」は Plan で決め、その結果だけを `sections` に記録する。IR に claim 本文、status、Evidence 本文、HTML、CSS、SVG 座標、audience ごとの必須 section 規則を複製しない。

| View | 主な Model source | Renderer の表現 |
| --- | --- | --- |
| `overview` | `purpose`、最大 3 つの actor / external / component、Plan で選んだ scenario / change | first view の lede、HTML card、takeaway |
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

`system_context` / `component_map` / `data_flow` の node と edge の座標は `@dagrejs/dagre` が計算する。日本語と code identifier の表示幅を `renderer/layout/text.ts` で見積もって折り返し、node 高さと edge label の寸法を Dagre に渡す。狭い画面では SVG の文字を縮小せず figure 内で横スクロールする。最初の小規模 Overview は HTML card を使う。

## 実行

```bash
dist/architecture-explainer render --model explanation-model.json --presentation presentation-ir.json --output index.html
dist/architecture-explainer validate index.html --model explanation-model.json --source-root /path/to/source
```

## 責務と検証範囲

| 段階 | 判断すること |
| --- | --- |
| Explanation Plan | audience に必要な reader question、view、first view の内容と省略理由 |
| Presentation IR | 選ばれた section の順序、question、view、model source ID、density、emphasis、theme |
| Renderer | IR の構造、参照、view と source kind の適合、描画可能性。HTML / CSS / SVG と layout を生成 |
| Validator | 生成後の HTML に対する standalone、heading、anchor、figure、code ref、用語、change evidence、accessibility、日本語 lint |
| Evaluation | Plan の十分性、first view の audience 適合、Source Truth と claim の一致、Evidence が claim を支えるか、Hard Gate |

Renderer は unknown model ID、重複 section ID、unknown view、view/source kind 不適合、sequence / runtime flow の複数 scenario、存在しない graph endpoint、不整合な component map の抽象度、必須 render data の欠落、解決できない evidence ID を拒否する。最初の section の `id: "what"`、`view: "overview"`、`purpose` 選択は HTML の構造契約として検査する。

Renderer は audience に必要な section の十分性、Plan の最適性、reviewer に対する first view の十分性、Source Truth の調査範囲、claim の真偽、Evidence が claim を実際に支えるかを判定しない。reviewer で runtime scenario や change impact を first view に含めるべきかは Plan / Evaluation で判断する。

IR を変更して section、順序、audience に対応する問い、theme を調整できる。audience と depth の変更は先に Explanation Plan と IR の source 選択へ反映し、必要な claim が model にない場合だけ Source Truth から Evidence を集め直す。section 単位の patch API と IR の HTML 内埋め込みは未実装であり、IR を編集してページ全体を再 render する。
