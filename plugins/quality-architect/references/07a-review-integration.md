# 07a review integration

`quality-review` が結合の深掘り (07a) シグナルを扱う時だけ読む補足。07a は EXPERIMENTAL で既定オフ。未検出/未選択ならこのファイルは読まない。

## 1. 適用条件

以下のいずれかの場合だけ適用する。

- `coupling-gate-result.json` が検出され、artifact freshness / commit / target の採否理由を書ける。
- ユーザー確認または事前許可の上で `$PLUGIN_ROOT/scripts/coupling-gate-swift.sh` など coupling wrapper を実行した。

適用しない場合、報告には `07a: 未適用` とだけ書く。決定論パート表に 07a 行を追加しない。

## 2. Merge Contract

- **dedup key**: `(path:line, finding_kind)`。同じ保守性/柔軟性 finding に 07/08 由来と 07a 由来の補足がある場合は 1 件に統合する。
- **precedence**: 07/08 の deterministic gate が PASS/FAIL の確定権を持つ。07a は考察パートの SIGNAL attach に閉じる。
- **no upward severity**: 07a だけで severity を上げない。verdict を fail/pass に反転しない。
- **downward only**: 既存の High/Medium が単純な結合度・サイズ・複雑度だけに基づく場合、07a が低リスクを示すときに最大 1 段だけ下方修正できる。

下方修正できる典型条件:

- `intrusive_hits=0`
- distance が `intra-method` / `intra-object` / `intra-namespace`
- volatility proxy が stable または low
- BALANCE の FAIL 反証が無い
- 対象 finding の主要リスクが結合の強さ/距離/変動性に限定される

`intrusive_hits>0`、cross-service/cross-system、hot-spot、または BALANCE FAIL がある場合は下方修正しない。必要なら補足コメントとして付けるが、severity 上方修正の根拠にはしない。

## 3. Attach Format

指摘の末尾に 1 行で付ける。

```text
- 07a 補足: SIGNAL（推測; module_unit=spm-target; --since=6.months; intrusive_hits=0; distance=intra-namespace; volatility=stable）。severity High→Medium に下方修正。
```

module unit、観測ウィンドウ、proxy であることを必ず書く。`module_unit` が未宣言なら distance を確定値にせず、`distance path-depth fallback` と書く。

## 4. 引用と禁則

Khononov または 07a を引用する前に `$PLUGIN_ROOT/references/07a-coupling-deep-dive.md` §9 を読む。同節がカノン。

禁則:

- Pain 式を精密な連続メトリクスとして扱わない。
- Martin の Instability を Integration Strength の代理にしない。
- aggregate score を単独 verdict にしない。
- Strength ラダー段を共有要素 `symbol/type/contract path` なしに断定しない。
- 動的 connascence を静的シグナルだけで断定しない。

## 5. 削減アクション

07a シグナルを採用しない場合でも、結合、凝集、複雑度、モジュール境界の指摘では `07a-coupling-deep-dive.md` §6.3.1 の catalog から削減アクションを選んでよい。アクションは推奨を具体化するためのもので、verdict や severity を直接変えない。
