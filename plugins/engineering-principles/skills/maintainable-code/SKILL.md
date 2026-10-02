---
name: maintainable-code
description: Design, review, or improve code, tests, and docs for long-term maintainability - tests express What, code expresses How, docs carry Context, and the repository alone explains the current spec. Use for implementing, refactoring, or reviewing code involving state modeling (Optional / Boolean / enum), test responsibility across unit / integration / UI, redundant comments or tests, separation of concerns, coupling, public API / component boundary contracts, or code-test-doc coherence after a change (stale docs, conversation-only assumptions). Japanese triggers - maintainable-code を使って実装・レビュー・改善して, 責務分離を確認して, 状態の持ち方を見直して, Test の保証責任を整理して, 公開 API や component 境界の設計を確認して, 保守性の観点でレビューして, コードとドキュメントの整合性も確認して, 実装と設計ドキュメントの齟齬を直して, この変更を新規参加者が理解できる状態にして, 会話にしか残っていない前提がないか確認して, このリポジトリだけで現在仕様を理解できるようにして. Do not use for syntax questions, isolated bug explanations, formatting, proofreading, general doc writing, README wording-only edits, correctness-only diff review, or architecture explainer documents.
---

# Maintainable Code

> **Test で What を、Code で How を、Documentation で Context を表現する。Domain State と Responsibility を正しい場所に置き、Repository だけから現在の仕様・設計意図・使い方を理解できる状態を保つ。**

目標はコードをきれいにすることではなく、仕様変更に対して安全かつ局所的に変更できるソフトウェアにすることである。想定する読者は常に、この作業の会話を一切知らない新規参加者である。

## 必須制約

1. **数や形式を改善とみなさない。** Test を増やす、型や abstraction を増やす、コメントを消す、Architecture Pattern に準拠させる、のいずれもそれ自体は改善ではない。
2. **判断は次の 6 問で行う。** What が明確か / How が読み取れるか / State が正しいか / 責務を所有すべき場所に知識があるか / 変更影響が局所化されているか / 会話を知らない新規参加者が Repository だけで現在の仕様を理解できるか。
3. **現在の実装だけを仕様とみなさない。** What の根拠は、明示された要求 → 既存 Test → Domain Model / Invariant → Public API / public contract → Documentation → 呼び出し側 → 実装の順に優先する。会話にない仕様を作らない。Code と Test が一致しているだけでは Documentation を古いと判定せず、どちらが古いかの証拠がなければ食い違いを提示する。
4. **好みを指摘・変更しない。** 変更容易性、仕様表現、Testability への具体的な影響を示せないものは扱わない。複数の妥当な設計がある場合、一つを絶対的な正解として扱わない。
5. **依頼の範囲を守る。** 原則の適用を理由にタスクを広げない。範囲外の問題は「関連する改善候補」として分けて報告する。

## Mode を判定する

依頼から判定し、明示指定を必須にしない。

| Mode | 判定の手がかり | 成果物 |
| --- | --- | --- |
| Implement | 新しい機能・変更の実装を依頼されている | 実装と、その What を保証する Test |
| Review | 既存実装や PR の分析・評価を依頼され、変更は依頼されていない | Finding の一覧（下記形式） |
| Improve | 動作を維持した構造の改善・リファクタリングを依頼されている | 改善後のコードと Test、変更理由 |

## Workflow

必要な範囲だけを順に確認する。各 Step の判断基準と例は [principles.md](references/principles.md) が正本。

1. **What** — このコードが何を保証する必要があるかを、必須制約 3 の根拠順で特定する。
2. **State** — 有効な状態、無効な状態、状態遷移、Invariant を洗い出す。Optional・Boolean・nullable field に状態が隠れていないか確認する。
3. **Test responsibility** — 各仕様を保証する最も小さい適切な Test Layer を決める。重複は整理し、不足している場合だけ追加する。
4. **Responsibility** — 各型・関数・モジュールが何を知り、何を決め、何が変わると変更されるかを確認する。異なる変更理由が混在していれば分離を検討する。
5. **Coupling** — import だけでなく、状態・順序・内部表現・仕様知識・Test の結合を見て、その知識を本来どこが所有すべきかを考える。
6. **API boundary** — 別の利用者・component が依存する contract を追加・変更する場合だけ確認する。consumer が依存するものが必要な capability に限られ、call site・failure・cost が contract として表されているかを見る。[api-design.md](references/api-design.md) を読んでから行う。
7. **How** — コメントで補う前に、型・名前・API・State・制御構造・境界で How を表現する。
8. **Repository coherence** — 変更箇所と、その仕様・状態・責務・使い方・public contract・設計意図に意味的に依存する Test・Comment・Documentation・Example・Configuration を確認し、矛盾・stale・重複・会話への依存を直す。省略可能な後処理ではない。Documentation の変更が不要なら変更しない。[repository-coherence.md](references/repository-coherence.md) を読んでから行う。
9. **Simplification & validation** — 不要な abstraction、comment、重複 Test、state、branch、dependency を取り除き、Test と既存の検証を実行する。

### Implement

- 巨大な設計文書を先に作らない。What・State・Test responsibility・Responsibility を必要な範囲だけ確認してから書く。
- 既存コードの問題を見つけても、今回の変更に必要でなければ直さず「関連する改善候補」として報告する。
- 新しい capability を新しい public な型・関数・abstraction と同一視しない。boundary に surface を追加する前に、既存 contract の組み合わせで表せないかを Step 6 で確認する。
- Code と Test が終わった時点を完了にしない。Step 8 を行ってから Step 9 へ進む。

### Review

- チェックリストを機械的に報告せず、実際に問題になっている箇所だけを報告する。
- Repository coherence も確認する。指摘のみの依頼なら修正せず、category `Repository coherence` の Finding として報告する。
- Category と優先順位: 仕様との不一致 → 不正な状態 → Test responsibility → 責務の混在 → 強い coupling → API boundary → Repository coherence → 冗長性 → style。

### Improve

- 依頼された範囲を超えて仕様または外部から観測可能な振る舞いを変える必要が生じたら、暗黙に変更しない。変更案として分けて提示し、ユーザーが明示的に許可している場合か、提示後に合意した場合だけ実施する。public contract（signature、公開された型、failure の表現など）の変更もこれに含む。依頼自体が仕様変更を含む場合は、その範囲の変更をそのまま行う。
- 既存 Test を現在の実装に合わせて書き換えない。先に Test が What を保証しているか確認し、実装詳細 Test であれば仕様 Test へ変換してから構造を変える。
- Test を削除・統合する場合は、その仕様の保証責任をどの Test が持つかを示す。
- Implement と同じく、Step 8 を行ってから完了にする。

### Implement / Improve の完了条件

この作業の会話履歴を失っても、Repository に残った Code・Test・Comment・Documentation から、変更後の現在仕様を正しく理解・利用・変更できること。

## Finding の形式

Review と Improve の指摘は次の形式で書く。具体的な変更が明らかな場合は修正案を添えてよい。

```text
Severity:  review-guide.md の Severity 表の値
Category:  Review の「Category と優先順位」の項目のうち一つ
Finding:   何が問題か
Evidence:  file:line と、問題を示す観測事実
Impact:    仕様変更・状態追加・implementation の変更・Test 保守・consumer の利用で何が起きるか
Direction: 改善の方向（妥当な案が複数あれば併記）
```

## Reference を読む条件

| Reference | 読む条件 |
| --- | --- |
| [principles.md](references/principles.md) | すべての mode。Workflow の各 Step の判断基準が必要な時 |
| [testing-boundaries.md](references/testing-boundaries.md) | Test を追加・削除・統合する時。Test Layer の割り当てを決める時 |
| [state-modeling.md](references/state-modeling.md) | Optional・Boolean・enum・状態遷移など、状態の表現が判断に関わる時 |
| [api-design.md](references/api-design.md) | 別の利用者・component が依存する contract（public API、module の export、component 間 interface、library API、domain / service boundary）を追加・変更・レビューし、公開範囲、dependency の露出、failure の contract、call site の使いやすさ、cost semantics が判断に関わる時。boundary を変えない変更では読まない |
| [review-guide.md](references/review-guide.md) | Review / Improve mode。Finding の採否、severity、範囲の判断時 |
| [repository-coherence.md](references/repository-coherence.md) | すべての mode の Step 8。Code・Test・Documentation の食い違い、source of truth、会話への依存を判断する時 |

## 報告

- Mode と、対象にした What（根拠の種類つき）
- Implement / Improve: 変更箇所、追加・削除・統合した Test とその保証責任、実行した検証と結果
- Repository coherence: 確認した関連 artifact と、更新・削除した内容。変更不要と判断した場合はその理由
- Review: severity 順の Finding
- 関連する改善候補（範囲外として扱わなかったもの）
- 成果に影響する仮定
