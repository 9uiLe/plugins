# Evaluation Rubric

Create / Review / Improve で共通に使う評価モデル。見た目の良さは判定の最後に扱う。総合点は出さず、Hard Gate、次元別の判定、修正優先順位で評価する。

## 評価の入力

1. 対象 HTML
2. HTML から逆算した Explanation Model と、claim 単位の照合結果（`verified` / `contradicted` / `unsupported` / `not-checkable`。[explanation-model.md](explanation-model.md)）
3. Source Truth から作った Explanation Model
4. `architecture-explainer validate` の結果（構造・リンク・standalone・簡易 accessibility・限定的な language lint）

script は構造と、明示された用語・一部の曖昧表現だけを検出する。claim の正しさ、抽象度、問いと view の対応、文意は Source Truth を読んで判断する。

## Hard Gates

1 つでも違反があれば、見た目や他の次元の判定に関係なく「受け入れ不可」とする。

| Gate | 条件 | 違反の例 | 確認方法 |
| --- | --- | --- | --- |
| G1 Fact integrity | コード・資料から確認できないことを事実として断定していない | 存在しない component、未記載の導入理由や性能要件を断定 | `contradicted` / `unsupported` の claim が `observed` 表示または無印になっていないか |
| G2 Claim evidence | 重要な architecture claim に根拠がある | 主要 component の責務や主要な依存に evidence がない | 主要 claim から evidence → file → symbol を辿る |
| G3 View question | primary visualization が「何を理解させる図か」明確である | 1 枚の図に構成・runtime・DB・deployment が同居 | `data-question` と caption が 1 つの問いを述べ、図の内容と一致するか |
| G4 Abstraction | 異なる抽象度を無意味に混在させていない | actor、app、class、table が同じ図に同じ形で並ぶ | view 内の要素の `level` がそろっているか |
| G5 Orientation | 説明対象・scope・audience が判断できる | 何の説明か first view から分からない | first view と header から subject / scope / audience を言えるか |
| G6 Traceability | 説明と実装の対応関係が壊れていない | 存在しない file・symbol への参照、改名後の古い名前 | validator の `--source-root` 検査と、主要 claim の読み合わせ |
| G7 Terminology Integrity | 主要 concept の名称の不一致によって別の component・概念だと誤認させない | 同じ保存先を本文では「セッションストア」、図では別の独立した「セッション管理サービス」と表示 | model の `glossary`、本文、図、表、caption を照合する。明示した alias、無害な短縮、単なる表記揺れは違反にしない |

「重要な claim」は、それを誤解すると読者の mental model や変更判断が変わるものを指す。装飾的な文や一般論は含めない。

## Quality dimensions

各次元を `pass` / `weak` / `fail` で判定し、判定ごとに根拠（HTML の箇所と、照合した file / symbol）を書く。根拠を書けない判定は出さない。

| 次元 | 問い | 対応する Gate | Improve 優先度 |
| --- | --- | --- | --- |
| Accuracy | コード・設計資料と一致しているか | G1, G6 | 1 |
| Evidence Integrity | Observed / Inferred / Unknown が分離され、推測が事実として書かれていないか | G1, G2 | 2 |
| Orientation | 最初に何の説明か分かるか | G5 | 3 |
| Structure | 責務・境界・依存関係が理解できるか | — | 3 |
| Rationale | 重要な設計判断と理由が説明されているか。根拠のない理由を作っていないか | G1（理由の捏造） | 3（捏造は 2） |
| Abstraction | 抽象度が不必要に混在していないか | G4 | 4 |
| Visual Cognitive Load | 1 view の問いが 1 つで、一度に読む量が制御されているか | G3 | 5（配色・余白などは 9） |
| Linguistic Cognitive Load | 同じ concept が同じ語か。主要 claim、actor、条件、結果、指示先が明確か。不要な synonym やコードの逐語的な読み上げがないか。図と本文の語が一致するか | G7（重大な誤認のみ） | 5 |
| Runtime | 主要な実行時の振る舞いが理解できるか | — | 6 |
| Code Traceability | 説明から実コードへ辿れるか | G2, G6 | 7 |
| Change Understanding | 変更時の影響範囲と invariant が理解できるか | — | 8 |

Rationale は、根拠がない理由を「Unknown」と明示していれば `pass` にできる。理由を作るより、Unknown と解消方法を示す方を高く評価する。

audience が必要としない次元（newcomer 向け資料の Change Understanding など）は `n/a` とし、理由を書く。

Linguistic Cognitive Load は `pass` / `weak` / `fail` で判定する。`weak` は追えるが再読や頭の中での名称変換が要る状態、`fail` は主要フローや条件を読み違える状態とする。validator の LANG warning の数だけで判定しない。用語不一致が mental model を壊す場合だけ G7 blocker とし、それ以外はこの次元の改善点にする。

AI 実装の Orientation では、Source Truth に該当情報がある場合、first view だけで「実装・変更内容」「解く問題」「主要 runtime flow」「behavior の主要な変化」「reviewer の最初の確認点」を答えられるか確認する。約 30 秒は設計目標で、時間の機械的な gate ではない。詳細な file 一覧や全 component を first view に足して合格にしない。必要な詳細は後続 section へ置く。

この audience 固有の判定は Explanation Plan と生成物の Evaluation で行う。Renderer が IR を描画できることや Validator が HTML の構造検査を通すことは、必要な問いに答えている証明にはならない。

## Severity

| Severity | 意味 |
| --- | --- |
| blocker | Hard Gate 違反 |
| major | Gate 違反ではないが、読者の mental model を誤らせる、または主要な問いに答えられない |
| minor | 理解に余分な労力がかかるが、誤解は生まない |
| polish | 見た目・表記の改善 |

## 修正優先順位

内容 → 説明構造 → 可視化 → 見た目の順に直す。同じ severity の中では次の順にする。

```text
1. Accuracy
2. Evidence integrity
3. Information architecture（Orientation / Structure / Rationale）
4. Abstraction / scope
5. Visualization selection / linguistic clarity
6. Runtime clarity
7. Code traceability
8. Change understanding
9. Visual design
10. Decorative polish
```

## 完了条件

Create と Improve の自己評価ループは、次をすべて満たした時点で終える。

- Hard Gate 違反がない
- Accuracy に major 以上の問題がない
- Explanation Plan の主要な問いすべてに、対応する view が答えている
- 問いに必要のない section、view、要素がない
- AI 実装の説明では、該当する Orientation の五つの問いに first view だけから答えられる（該当しない問いは Explanation Plan に理由がある）

繰り返しは 3 iteration を目安とする。そこで条件を満たさない場合は、残った問題を severity つきで報告して止めるか、続ける価値がある具体的な理由（次の修正で解消する blocker が特定できている）を示して続ける。

## Review report の形式

```markdown
# Review: <対象 HTML>

## 判定
受け入れ可 / 受け入れ不可（Hard Gate 違反: G1, G4）。一文で理由。

## 対象の理解
subject / scope / audience（資料が明示しているもの、逆算したもの）

## Hard Gates
| Gate | 結果 | 根拠（HTML 箇所 → file:symbol） |

## Claim 照合
| Claim（HTML 箇所） | 結果 | Source Truth |
verified / contradicted / unsupported / not-checkable

## 次元別評価
| 次元 | 判定 | 根拠 |

## 修正優先順位
1. [blocker] … → 直し方
2. [major] …

## Validator
errors / warnings の要約
```
