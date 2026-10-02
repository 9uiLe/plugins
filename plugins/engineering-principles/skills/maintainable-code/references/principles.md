# 原則

Workflow の各 Step で使う判断基準。Test Layer の詳細は [testing-boundaries.md](testing-boundaries.md)、状態の表現は [state-modeling.md](state-modeling.md)、API と component boundary は [api-design.md](api-design.md)、Code・Test・Documentation の整合性は [repository-coherence.md](repository-coherence.md) が正本。

知識はそれを最もよく表せる一か所に置く。Test は What、Code は How、Documentation は Code と Test から復元できない Context、Comment は将来の変更で事故を防ぐ情報を受け持つ。Repository は作業時の会話に依存せず、会話を知らない新規参加者が現在の仕様・設計意図・使い方を理解できる状態に保つ。

## Test は What を表す

Test は、システムが何を満たすべきかを表す。Test を読めば、要件、仕様、制約、状態遷移、境界条件、観測可能な振る舞いが分かる状態を目指す。

Test に実装手順を書かない。本質的な仕様が「未取得の場合はサーバーから値を取得する」なら、「`repository.fetch()` が 1 回呼ばれる」ではなく前者を Test の関心にする。ただし、呼び出し回数そのものが契約である場合（課金される API、rate limit、冪等性の保証など）は例外とする。

**判断基準:** Test が実装の変更だけで壊れるなら、その Test は仕様ではなく How を検証していないかを確認する。

## Code は How を表す

Code は、仕様をどのように実現しているかを表す。コメントで処理の意味を補うのではなく、型、名前、API、制御構造、データ構造、モジュール境界で表現する。

```swift
// ユーザーが有効か確認する
if user.status == .active {
```

より、コード自体から意図を読み取れる形を優先する。

```swift
if user.isEligibleForReward {
```

コメントを書く前に、コードで表現できないかを考える。

## コメントは例外とする

コメントを禁止はしないが、コードから読み取れる情報を重複させない。

残さないもの:

- **What コメント** — `// ユーザーを取得する` のように、コードと同じ内容を言い換えたもの。
- **実装履歴** — 「以前は A を使っていたが B に変更した」のように、現在のコードの理解に不要なもの。履歴は commit message に置く。
- **差のない選択の記録** — 選択肢に本質的な差がなく、将来の変更判断に影響せず、制約でもない「A と B のどちらでもよかったが A にした」という記録。

残してよいもの: 外部システムの制約、OS / SDK の既知不具合、API の非自明な契約、セキュリティ上の制約、一見不要に見える処理を削除してはいけない理由、意図的に通常と異なる設計にしている理由。

**判断基準:** 「なぜこう書いたか」ではなく、「将来このコードを変更する人が知らなければ事故になる情報か」で判断する。

## Documentation は Context を表す

Documentation には、Code と Test から合理的に復元できない、現在必要な情報（責務境界、Domain State の owner、使い方、setup、非自明な制約、source of truth の場所など）を置く。関数内部の How や、Test から明確に分かる個別仕様を複製しない。複製は Code・Test との二重管理になり、変更のたびに stale になる。

会話で決まった仕様や制約は、作業の evidence として使ってよいが、完成した Repository がその会話を必要としてはならない。現在も有効なものだけを Code・Test・Comment・Documentation に反映し、「今回」「先ほど決めた」のような会話への依存を残さない。Documentation を増やすこと自体は改善ではなく、変更が不要なら変更しない。

Documentation と Comment は、技術的な意味を比喩・擬人化・評価語に置き換えず、何をするか・なぜ必要かを直接書く。読者が比喩を解釈しないと責務や理由が分からない文章は、Context を正確に伝えない。判断基準と例外は [repository-coherence.md](repository-coherence.md) にある。

## Test の数を品質としない

同じ仕様を複数の Layer で重複して検証せず、各 Layer に保証責任を持たせる。新しい Test を書く前に「この仕様を保証する最も小さい適切な Test Layer はどこか」を判断する。削除・統合の基準は [testing-boundaries.md](testing-boundaries.md) にある。

## 状態を明示する

状態を実装上の偶然として扱わない。状態に意味があるなら Domain Model として表現できるかを検討し、存在してはいけない状態を表現できないようにする。Optional・Boolean・enum の使い分けは [state-modeling.md](state-modeling.md) にある。

## 責務は変更理由で分ける

責務の分離を「ファイルを小さくすること」と考えない。異なる変更理由を持つ関心が一つに閉じ込められていないかを確認する。

一つの型が API Request、JSON Decode、Cache、Domain Rule、UI State、Analytics を同時に扱っているなら、それぞれが何によって変わるかを確認する。変更理由が同じなら一緒に置いてよい。評価するのはクラスの数ではなく、ある仕様変更がどこまで波及するかである。

各型・関数・モジュールについて次を問う。

- 何を知っているか
- 何を決定しているか
- 何が変わると変更されるか

## 結合を知識で見る

import や依存の数だけを結合度とみなさない。次の knowledge coupling も確認する。

| 種類 | 兆候 |
| --- | --- |
| State coupling | 複数のコンポーネントが同じ状態遷移を知っている |
| Temporal coupling | 「A を呼んだら必ず B、その後 C」という暗黙の順序依存がある |
| Representation coupling | Domain Model の内部表現を外部のコンポーネントが知っている |
| Change coupling | 一つの仕様変更で、無関係に見える複数箇所を同時に変える必要がある |
| Test coupling | production code の private な構造を Test が知りすぎている |

検出したら、その知識を本来どのコンポーネントが所有すべきかを考える。Temporal coupling は、順序を型や API で強制する（前段の戻り値を後段の引数にする、状態ごとに呼べる操作を変える）ことで解消できる場合が多い。

## 公開した How は What になる

Component の内部の How（具体型、データ構造、依存ライブラリ、error の形）を boundary の外へ公開すると、consumer はそれに依存でき、以後は consumer にとっての What、つまり contract になる。内部では自由に変えられた implementation が、公開した後は consumer の変更なしには変えられなくなる。

そのため boundary では、consumer が必要とする capability だけを公開する。評価するのは公開している symbol の数ではなく、consumer が依存しなければならない contract の量と、それを変える時に consumer 側で必要になる変更である。判断基準は [api-design.md](api-design.md) にある。

## Overengineering を避ける

この Skill は抽象化を増やすためのものではない。次の理由だけで abstraction を追加しない。

- 将来使うかもしれない
- 一般的に Clean Architecture だから
- SOLID に見えるから
- Protocol / Interface にできるから
- Class が少し大きいから

抽象化するのは、異なる変更理由が存在する、異なる実装が実際に存在する、Domain Boundary を守る必要がある、Test Boundary として価値がある、変更影響を局所化できる、といった具体的な利益を確認できる場合に限る。評価するのは「分離されていること」ではなく「変更しやすくなっていること」である。

## 非目標

次を目的としない: 特定 Architecture の強制、SOLID 原則の機械的適用、Clean Architecture の導入、Protocol / Interface の増加、public symbol 数の最小化、Test coverage の最大化、コメント・Optional・Boolean の完全禁止、具体型・dependency・String・getter の禁止、独自 error type の強制、特定言語の API design guideline の移植、ファイルサイズの最小化、Class 数の増加、DRY の機械的適用、Documentation の充実そのもの。

評価軸は Specification clarity、State correctness、Responsibility ownership、Change locality、Repository self-containedness の 5 つである。Change locality には、implementation を変えた時に boundary の外の consumer まで変更が波及しないことを含む。
