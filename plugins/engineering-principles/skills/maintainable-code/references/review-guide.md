# Review / Improve の指針

Review / Improve mode で、Finding の採否、severity、範囲を判断する時に読む。

## Finding として報告する条件

次をすべて満たすものだけを報告する。

1. 対象コードで実際に起きている（file:line で示せる）。
2. 変更容易性、仕様表現、State correctness、Testability のいずれかへの具体的な影響を説明できる。
3. 依頼された範囲に含まれる。範囲外のものは「関連する改善候補」に分ける。

チェックリストの項目を一つずつ埋めるように報告しない。問題がない観点は報告に含めない。

## Severity

| Severity | 基準 | 例 |
| --- | --- | --- |
| High | 仕様との不一致、または不正な状態が表現可能で、現実の入力で不具合につながる | Test が仕様と逆の振る舞いを保証している。`loaded` と `failed` が同時に成立しうる |
| Medium | 次の仕様変更で、波及や分岐漏れが起きやすい構造 | nil が複数の意味を持つ。一つの型に異なる変更理由が混在している。Temporal coupling。README が旧 owner を案内している |
| Low | 具体的な保守コストはあるが、影響が小さい冗長性 | 同じ分岐を 2 つの Layer で検証しており、規則の変更時に両方を直す必要がある Test。読み手を誤らせる What コメント |

severity は Impact から判定する。Impact を具体的な仕様変更・状態追加・Test 保守の作業として説明できなければ、Low にもせず Finding 自体を出さない。style、好み、一般論、「より綺麗に見える」だけを理由にした Finding は出さない。

報告は severity 順、同じ severity 内では SKILL.md の Review の優先順位に従う。

## Evidence と Impact の書き方

- **Evidence** は観測事実に限る。file:line、該当するコードや Test の要約、呼び出し側での使われ方を示す。推測を含める場合は推測と明記する。
- **Impact** は、具体的な仕様変更や状態追加を想定して書く。「保守性が下がる」ではなく、「`suspended` 状態を追加すると、nil を判定している 4 箇所すべてを確認する必要がある」のように書く。

## False positive を避ける

次は指摘しない。

- 「Protocol にした方がきれい」「Clean Architecture に沿っていない」など、パターンへの準拠だけを理由にしたもの
- 将来の仮定だけを根拠にした抽象化の提案
- 変更理由が同じものを、ファイルやクラスが大きいという理由だけで分割する提案
- Domain 上の意味が 1 つしかない Optional や、独立した Domain Fact である Boolean
- 契約として必要な呼び出し回数の検証を、実装詳細 Test とみなすこと
- 外部制約・既知不具合・非自明な契約を説明しているコメントの削除
- プロジェクトの既存の規約に従っている箇所への style の指摘
- 「README を更新すると親切」程度の Documentation の追記。Repository coherence の Finding の条件は [repository-coherence.md](repository-coherence.md) にある

指摘する前に、そのコードがその形になっている理由（コメント、commit message、Test、呼び出し側の要求）を確認する。理由が妥当なら指摘しない。

## Scope control

- Review では変更しない。修正案は Direction として示すに留める。
- Improve で、依頼された範囲を超えて仕様または外部から観測可能な振る舞いを変える必要が生じた場合は、暗黙に変更しない。変更案として Finding に分けて提示し、ユーザーが明示的に許可している場合か、提示後に合意した場合だけ実施する。依頼自体に含まれる仕様変更は、この確認の対象外とする。
- 対象の変更と関係のない既存の問題は、依頼が既存コード全体のレビューでない限り「関連する改善候補」に入れる。Repository coherence も、変更箇所に意味的に依存する範囲に限って確認し、無関係な cleanup に広げない。
- Improve で Test を変える場合、変更前に「この Test は What を保証しているか」を判定する。実装詳細 Test は仕様 Test に変換してから構造を変え、変換後の Test が変更前後のコードの両方で通ることを確認する。
