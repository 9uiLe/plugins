# Repository coherence

Workflow Step 7 と、Review で Code・Test・Documentation の整合性を判断する時に読む。

## 想定読者と目標

読者は常に、この作業の会話を一切知らない新規参加者である。その読者が Repository だけを読んで、現在の仕様、Domain State と Invariant、主要な設計意図、責務と ownership、public contract、利用方法、setup / configuration、非自明な制約、正本となる Documentation の場所を理解できる状態を保つ。

目標は Documentation を増やすことではない。知識を適切な場所に一つずつ置き、重複・矛盾・会話への依存を残さないことである。Documentation の変更が不要なら、変更しないことが正しい結果である。

## 知識の置き場所

| 置き場所 | 表すもの | 置かないもの |
| --- | --- | --- |
| Test | What: 仕様、制約、状態遷移、境界条件、観測可能な振る舞い | 実装手順、private な構造 |
| Code | How: 型、名前、API、制御構造、データ構造、Module boundary | 型や名前で表せる情報の言い換えコメント |
| Comment | 将来この箇所を変える人が知らないと判断を誤る情報 | 処理内容の言い換え、変更履歴 |
| Documentation | Context: Code と Test から合理的に復元できない、現在必要な情報 | 関数内部の How、Test から明確に分かる個別仕様 |
| Example / Configuration | 実際に動く利用方法と設定 | 実装と異なる、動かない例 |

Documentation に置く情報の例: Component / Module の責務境界、Domain State の owner、public な使い方、setup と configuration、Architecture 上の重要な制約、外部サービスや OS / SDK の非自明な制約、一見不要に見える設計を維持する理由、Repository 内の source of truth の場所、将来の変更判断に必要な設計意図。

## Changed surface

確認するのは、今回変更した箇所と、その仕様・状態・責務・使い方・public contract・設計意図に意味的に依存する箇所に限る。候補は Test、Code comment、README、Architecture / Design doc、API doc、usage example、configuration example、manifest、public API の説明、directory / module の責務の説明である。

探し方: 変更したシンボル名・概念名・設定キー・旧名で Repository を検索し、該当箇所がその変更の意味を説明・利用しているかを確認する。

次は範囲外とし、必要なら「関連する改善候補」として報告する: 無関係な refactoring、style の統一、整合している Documentation の書き直し、新しい architecture の導入、新しい仕様の追加、Documentation を充実させること自体を目的とした追記、Test 数の増減自体を目的とした変更。

## Conversation context

会話で得た情報（ユーザーが確定した仕様、採用した設計、却下した案、途中で修正された前提、実装中に判明した制約、用語や責務の変更）は、作業中の evidence として使ってよい。ただし、完成した Repository がその会話を必要としてはならない。

```text
Conversation context
  → 現在も有効な仕様・制約・設計判断だけを抽出する
  → Code / Test / Comment / Documentation の適切な場所へ反映する
  → 会話への依存を取り除く
```

会話にない仕様を作らない。会話でも Repository でも決まっていない点は、仮定として報告するか質問する。

## Session-context leakage

「今回の修正」「以前の案」「先ほど決めた」「上記のケース」「相談した結果」「ユーザーの要望により」「暫定対応」「とりあえず」「前の実装」のような表現があれば、会話への依存が残っていないかを確認する。文字列を機械的に禁止せず、この会話を知らない新規参加者が、その意味・理由・参照先を Repository だけから理解できるかで判断する。理解できなければ、現在の仕様・制約・設計理由を直接書く表現に直す。

```text
悪い例: 今回 B を採用した。
良い例: B を使用する。A では offline 時に〈この invariant〉を保証できないため使用しない。
```

採用しなかった案は、それを知らないと将来同じ誤りをする場合だけ、現在の制約として残す。それ以外の意思決定の経緯は残さない（経緯は commit message や PR に置く）。

## Source of truth の判断

Code と Documentation が食い違う場合、現在動いている implementation を自動的に正本にしない。Test も implementation から書かれていることがあるため、Code と Test が一致しているだけでは Documentation を stale と判定しない。SKILL.md 必須制約 3 の順で evidence を確認し、食い違いを次のどれかに分類する。

| 分類 | 判断の手がかり | 対応 |
| --- | --- | --- |
| Implementation が古い・誤り | Test、public contract、Documentation が一致し、implementation だけが異なる | Implementation 側の問題として扱う。Documentation を implementation に合わせない |
| Test が古い | 要求・public contract・Documentation と Test が食い違い、Test だけが旧仕様を保証している | Test を現在の仕様に合わせる |
| Documentation が stale | Documentation が以前の状態を指している積極的な証拠がある: 存在しないシンボル・ファイル・設定、改名前の名前、今回の変更で変わった値、移行済みの owner | Documentation を現在の状態に合わせる |
| public contract と implementation の不一致 | 公開された型・API doc と実際の振る舞いが異なる | 利用者への影響を Finding として示し、どちらを直すか判断できなければ確認する |
| source of truth の競合 | 同じ知識を複数の場所が持ち、互いに食い違っている | 正本を一つに決め、他方は削除するか正本への参照にする |
| 仕様自体が不明確 | evidence が割れていて、どれが現在の要求か判断できない。仕様書などの Documentation と Code・Test が食い違うだけで、どちらが古いかを示す証拠がない場合もここに入る | どちらにも合わせず、食い違いを提示して質問する。回答に依存しない作業は進める |

ユーザーがこのセッションで仕様や設計を明示的に確定している場合は、それを最上位の evidence として使ってよい。

Implement / Improve で、依頼の範囲を超えて仕様や外部から観測可能な振る舞いを変えることになる場合は、SKILL.md の Improve の規則に従い、変更案として分けて提示する。

## Code ↔ Documentation の双方向検証

**Code を変更した場合:** 仕様、public API、状態モデル、責務と ownership、setup、configuration、使い方、Architecture、運用上の制約が変わったかを確認する。変わったものを既存の Documentation・Example・Configuration が説明していれば、その記述を現在の状態に合わせる。

**Documentation を変更した場合:** 記述が Code、Test、public API、Configuration、manifest、directory 構成、実際の使い方と一致するかを確認する。コマンド例・パス・設定キー・API 名は、実在するか、実行できるかを確かめる。

## Stale と重複

関連範囲で次を確認し、不要なら削除・更新・統合する。

- 試行錯誤の残骸、不要になった不採用案の説明
- 古い仕様、stale な Test・README・Design doc・Example
- 同じ知識の重複した説明
- 最終状態と異なる用語・命名、古い責務の説明、古い参照先
- Code と重複するコメント
- Code・Test・Documentation の間で矛盾する振る舞いの説明

「古い」という理由だけで消さない。現在仕様と履歴を区別し、次の durable knowledge は必要に応じて保持する: ADR、migration 情報、互換性の制約、deprecation 情報、release / change history（CHANGELOG など）、現在も必要な workaround の根拠、将来変更すると事故になる非自明な制約。これらは「履歴」や「移行」として明示された場所に置き、現在仕様の説明と混ぜない。

## Documentation の変更判断

| 判断 | 条件 |
| --- | --- |
| 追加 | 変更によって、Code と Test から復元できない Context（新しい owner、setup、制約など）が生じ、それを説明する場所が Repository にない |
| 更新 | 既存の記述が、変更後の仕様・責務・使い方・制約と食い違う |
| 削除・統合 | 記述が stale、会話依存、または Code・Test・別の Documentation と重複し、二重管理になっている |
| 変更しない | public behavior、責務、使い方、制約が変わっておらず、既存の記述が正しい |

How を Documentation に複製しない。README が内部の処理手順を詳しく再現している場合は、新しい説明を足すのではなく、Context・使い方・制約に絞る。

## Review の Finding

Repository coherence の Finding は、次のような具体的な Impact を説明できる場合だけ出す: 誤った実装につながる、誤った使い方につながる、責務が再び分散する、仕様の判断を誤らせる、変更箇所の判断を誤らせる、同じ知識の二重管理で stale になりやすい。「README を更新すると親切」程度のものは Finding にしない。

```text
Finding:   README が、セッションの有効期限判定の owner を旧 SessionStore と説明している。
Evidence:  README.md:42 は SessionStore.isExpired を案内している。auth/session_policy.py:18 の
           SessionPolicy.is_expired が判定し、tests/test_session_policy.py が境界を保証している。
           SessionStore には該当メソッドがない。
Impact:    新規参加者が有効期限の仕様変更を SessionStore に実装し、判定が 2 か所に分散する。
Direction: README の owner の説明を SessionPolicy に更新し、旧名への言及を削除する。
```
