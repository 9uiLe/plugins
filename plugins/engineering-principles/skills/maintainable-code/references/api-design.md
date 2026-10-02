# API と component boundary

別の利用者・component が依存する contract boundary を追加・変更・レビューする時に読む。boundary を変えない内部の状態設計や Test の整理では読まない。

## 対象と判断の単位

対象は、package / module の public API や export、component 間の interface、library API、domain / service boundary、application 内部の module 間 API、framework / SDK API など、別の利用者（以下 consumer）が依存する contract boundary 全般である。

contract を変えるコストは、言語の可視性修飾子や、Repository 内で現在見つかる caller の数では判断しない。独立した consumer がいるか、producer と consumer の変更を協調できるかで判断する。

- consumer set は既知で、閉じているか
- producer と consumer を同じ変更・release 単位で更新できるか
- 外部の consumer や、独立に release される consumer が存在しうるか

consumer set が閉じていて同じ変更で更新できるなら、public でも互換性のコストは比較的小さい。外部へ配布した API は、Repository 内の caller が現在一つでも、把握できない consumer がいるため互換性のコストが高い。internal でも、独立に変更・release される複数の module が依存していれば contract として慎重に扱う。

## 目標

[principles.md](principles.md) の「公開した How は What になる」を boundary で具体化する。目標は、implementation を変えても consumer を変えずに済むことである。

consumer が依存できるものはすべて contract になる: 名前と signature、公開された型とその representation、引数と戻り値の意味、failure、実行コストと side effect、consumer へ伝播する dependency。以下の各節は、このうち何を contract に含め、どう表すかの判断基準である。

## 設計の順序: Client API first

実装を作ってから外へ露出するのではなく、consumer から見た call site を先に考え、declaration と implementation をそこから逆算する。

- この API を使うコードはどう見えるべきか
- consumer は何を知る必要があるか
- consumer が知らなくてよい情報は何か

新しい capability は、新しい public な型・関数・abstraction を必要とするとは限らない。surface を追加する前に、また Review では追加された surface について、次を確認する。

- 本当に新しい public capability か
- 既存 contract の組み合わせや既存の型の再利用で、自然に表現できないか
- この implementation detail を caller が知る必要があるか

既存 contract を再利用すると一つの API が意味の異なる用途を兼ねる、引数の組み合わせで振る舞いが切り替わる、など責務が曖昧になるなら、新しい contract を作る。

**判断基準:** 追加する surface が、既存 contract では表せない capability に対応しているか。

## Consumer が依存するものを必要な capability に限る

### Public surface

公開した symbol・export・interface・具体型は、consumer が依存した時点で、互換性を壊さずには取り除けなくなる。判断するのは symbol の数ではなく、consumer が依存しなければならない contract の量と、その変更コストである。必要な capability を不自然に隠す、または一つの万能 API に押し込めることも、consumer が意味の異なる引数や option を理解する必要を生み、同じく変更コストを上げる。

### Representation を contract にしない

次の layer が必要とする capability だけを公開し、具体型、内部データ構造、storage representation、外部ライブラリの型は、consumer が知る必要がなければ boundary を越えて露出させない。手段は言語によって opaque type、interface、抽象型、value object、export の制御などがあるが、目的は手段の導入ではなく、implementation を consumer に影響させずに変えられることである。boundary の内側の Representation coupling は [principles.md](principles.md) の「結合を知識で見る」で扱う。

consumer が具体型を必要とする場合（その型自体が Domain contract である、consumer がその型の機能を直接使う必要がある）は隠さない。

**判断基準:** その representation を変えた時、consumer の変更が必要になるか。必要になるなら、consumer はその representation に依存する必要があるか。

### Dependency を consumer へ伝播させない

public API が依存ライブラリの型を signature に含めると、consumer もそのライブラリに結合される。transitive dependency、version constraint、build / bundle size、supply-chain exposure、依存先の breaking change が consumer へ伝播し、依存を置き換える時に consumer の変更が必要になる。implementation のための dependency は、boundary の内側に閉じ込められないかを確認する。

dependency の存在自体は問題ではない。その library の型を consumer と共有すること自体が API の目的である（相互運用のための標準的な表現など）場合は露出してよい。

小さな重複を除くためだけに、大きな dependency や boundary をまたぐ共有 abstraction を導入しない。consumer へ伝播する dependency を避けるために、少しの重複を受け入れる方が変更コストが小さい場合がある。

**判断基準:** その dependency は、boundary の内側の implementation のためのものか、consumer と共有すべき contract の一部か。

## Call site を最適化する

declaration を単純にすることより、consumer が call site で domain intent を明確に表現できることを優先する。必要なら declaration 側が複雑さを引き受けてよい。ただし、call site が少し短くなるだけのために内部を大きく複雑化しない。評価するのは文字数ではなく次である。

- consumer が正しい使い方を自然に選べるか
- call site から domain intent を読み取れるか
- 無効な組み合わせを作りにくいか
- implementation detail を consumer に漏らしていないか

### Progressive disclosure

基本的な利用は単純にし、option、configuration、extension point は必要になった時に見つけられるようにする。

```text
common path → optional configuration → advanced extension
```

overload や abstraction を増やすこと自体は progressive disclosure ではない。

**判断基準:** 単純な use case の consumer が、advanced use case の complexity（理解すべき引数・型・設定）を支払わずに済むか。

### Stringly-typed API

String が state、identifier の種類、option、command、mode、field 名、protocol discriminator など、有限または構造化された domain concept を暗黙に表している場合、補完が効かず、typo が runtime まで検出されず、有効値を発見できず、rename も難しい。

```text
setMode("premium")      // 有効値が "free" / "premium" だけなら型で表せる
setMode(Plan.PREMIUM)
```

enum、value object、identifier type、sealed type、literal union など、その言語で使える型表現を検討する。その値が状態を表す場合の型の選び方は [state-modeling.md](state-modeling.md) にある。

name、message、URL、user input、free-form text のように、本質的に文字列である domain value は String のままでよい。

**判断基準:** その String が取りうる値は、domain 上有限または構造化されているか。

## Failure も contract である

成功時の戻り値だけでなく、failure も consumer が依存する contract である。consumer が知る必要があるのは次である。

- どの failure が起こりうるか
- recovery や retry が可能か
- caller が分岐すべき failure か
- domain の failure か、infrastructure の detail か

内部ライブラリや transport の error をそのまま外へ出すと、consumer はその implementation detail に結合され、依存の置き換えで error handling も変わる。一方、すべての error に独自の wrapper を作る必要はない。consumer が区別して扱う failure だけを contract として表し、区別しない failure のために型を増やさない。failure の表現を boundary の両側で固定する Test は [testing-boundaries.md](testing-boundaries.md) の Contract Test にあたる。

**判断基準:** consumer はその failure を区別して扱う必要があるか。必要なら、implementation detail に依存せずに区別できるか。

## Cost semantics を API の形に表す

property や getter に見える API が、network / database / filesystem I/O、高コストな計算、blocking、同期、観測可能な side effect を隠していると、consumer は cost model を誤り、ループの中や UI thread から呼ぶ。API の形から、重要な実行コストと side effect を推測できるようにする。

「getter は軽く、method は重い」を言語共通の規則にしない。言語・framework の convention（非同期の表現、例外の宣言、命名規約など）の上で、consumer に誤った cost の期待を与えていないかで判断する。形で表しきれない非自明なコストは API documentation に残す。

**判断基準:** consumer が API の形から想定するコストと、実際のコスト・side effect が一致しているか。

## 既存 contract を変える

public contract の変更は、外部から観測可能な変更になりうる。Improve では SKILL.md の Improve の規則に従い、behavioral compatibility、API compatibility、consumer の migration impact を確認する。依頼されていない breaking change を、きれいになるという理由だけで行わない。必要なら変更案として分けて提示する。

## 過剰適用を避ける

この reference の観点は、boundary の外の consumer に具体的な影響がある場合だけ使う。目的としないものは [principles.md](principles.md) の「非目標」、Review で Finding にしないものは [review-guide.md](review-guide.md) にある。
