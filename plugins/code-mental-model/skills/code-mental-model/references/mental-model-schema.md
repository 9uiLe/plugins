# Canonical Mental Model schema v1

Agent はリポジトリを調査して **analysis draft JSON** だけを書く。`index.html`、SVG 座標、CSS、JavaScript、ID は書かない。`build_model.py` が draft を検証・正規化し、`.mental-model/mental-model.json` と `metadata.json` を作る。`render_html.py` は canonical model と同梱 assets だけを読む。

## Draft input

UTF-8 JSON。未知の field、列挙値、絶対パス、`..` を含む path は拒否する。source の path は repository root 相対、行番号は 1 起点。`key` は draft 内だけの node 参照で、表示 ID ではない。`summaryCode` と `roleCode` は既定句の選択子であり、自由文を避ける。確認できないものは `unknown` とし、推測を confirmed にしない。

locale は CLI で `ja-JP` または `en-US` を指定し、指定がなければ `ja-JP` とする。どちらも固定 UI copy を renderer assets から選ぶ。

```json
{
  "title": "Checkout",
  "summaryCode": "cached-result-skips-side-effect",
  "nodes": [
    {
      "key": "CheckoutService",
      "label": "CheckoutService",
      "kind": "service",
      "layer": "application",
      "status": "confirmed",
      "state": "stateless",
      "roleCode": "coordinator",
      "source": {"path": "service.py", "startLine": 10, "endLine": 22}
    }
  ],
  "edges": [
    {
      "from": "CheckoutService",
      "to": "Orders",
      "kind": "reads",
      "label": "find(orderId)",
      "data": "orderId",
      "condition": "always",
      "change": "added",
      "status": "confirmed",
      "source": {"path": "service.py", "startLine": 16, "endLine": 16},
      "execution": {"first": 2, "repeat": 2}
    }
  ]
}
```

`source`、`data`、`execution` は確認できない場合に省略する。`source` がない node / edge に Code Lens を作らない。`execution` は scenario 名から正の順番への map。各 scenario は一つの条件集合で成立する経路を表し、共通の edge は複数の scenario に含められる。分岐した経路を同じ scenario に同時記載しない。scenario 名は経路切替にも表示されるため、成立条件を区別できる簡潔な名前にする。`first` は「初回」、`repeat` は「再要求」として表示され、その他は指定した名前を表示する。既定 scenario は `first`、次に `repeat`、その後は辞書順。Execution mode は選択した scenario の node・edge と順番だけを表示し、番号を選ぶと動作と条件の説明を示す。scenario がない場合は Execution mode を表示しない。source の代表行から Code Lens を機械的に `前2行・後3行` で抽出し、ファイル端で切る。対象 source 範囲が25行を超える場合は、より狭い source を選び直す。生成した lens は model に保存するため renderer は repository を読まない。

## Controlled vocabulary

| Field | Values |
| --- | --- |
| `node.kind` | `caller`, `ui`, `controller`, `view-model`, `use-case`, `service`, `repository`, `data-source`, `storage`, `external-system`, `entity`, `value`, `unknown` |
| `node.layer` | `entry`, `application`, `data`, `external`, `value` |
| `node.state` | `stateless`, `owned`, `persistent`, `external`, `transient`, `unknown` |
| `edge.kind` | `calls`, `reads`, `writes`, `returns`, `creates`, `owns`, `depends-on`, `implements`, `emits`, `observes`, `transforms`, `persists`, `fetches`, `injects`, `delegates-to` |
| `status` | `confirmed`, `inferred`, `unknown` |
| `change` | `existing`, `added`, `removed`, `changed` |
| `condition` | `always`, `on-hit`, `on-miss`, `unknown` |
| `summaryCode` | `unknown`, `cached-result-skips-side-effect` |
| `roleCode` | `entry`, `coordinator`, `state-holder`, `side-effect-boundary`, `data-value`, `unknown` |

`calls / invokes / executes / triggers` のような類義語は `calls` へ正規化する。違いが意味上必要なときだけ vocabulary の更新を version 変更とともに行う。

## Stable identity and order

node ID は `slug(label)`。衝突時は `slug(label)--<SHA-256(path + ':' + label) の先頭12桁>`。path がない場合は `kind + ':' + label` を使う。slug は Unicode NFKC → 小文字の直前にある camel-case 境界へ `-` を挿入 → 小文字化 → ASCII 英数字以外を `-` に置換 → 前後の `-` を除去し、空なら `node`。edge ID は `from-id--kind--to-id--slug(label)`。衝突時は `edge-id--<SHA-256(path + ':' + startLine + ':' + label) の先頭12桁>`。さらに同一なら draft が重複しているので拒否する。

node sort key: `(layer order, kind, normalized source path, source startLine, id)`。layer order は上の表の順。edge sort key: `(from node index, to node index, kind, source path, source startLine, id)`。配列はこの順で保存する。JSON key は Unicode 順の `sort_keys=True`、UTF-8 / LF / 最終改行 / 2 spaces とする。renderer の HTML も UTF-8 / LF / 最終改行で固定する。

## Reproducibility levels

- **A / required:** 同じ canonical model と同じ renderer assets → byte-for-byte 同じ HTML。
- **B / target:** 同じ source と設定 → 同じ canonical model。fingerprint 一致時は既存 model を再利用して解析の差を遮断する。
- **C / limited:** 異なる LLM の新規意味解析の一致。自由推論を許す限り完全保証できない。HTML に反映する意味は controlled code と根拠付き node / edge に局所化する。

timestamp、session ID、agent 名、hostname、絶対パスは canonical model と HTML に入れない。renderer は model の field を自由作文で補完せず、未定義の情報を表示しない。
