# Engineering Principles

コード・テスト・ドメインモデル・責務境界を、長期的な変更容易性の観点から設計・レビュー・改善する Claude Code / Codex 用プラグインです。中心となる原則は「What は Test に、How は Code に、Context は Documentation に表現する」です。目標はコードをきれいにすることではなく、仕様変更に対して安全かつ局所的に変更でき、作業時の会話を知らない新規参加者も Repository だけで現在の仕様・設計意図・使い方を理解できるソフトウェアにすることです。

## インストール

```text
/plugin marketplace add 9uiLe/plugins
/plugin install engineering-principles@9uile-plugins
```

```bash
codex plugin marketplace add 9uiLe/plugins
codex plugin add engineering-principles@9uile-plugins
```

## 依頼する

収録スキルは `maintainable-code` です。Mode は依頼から判定するため、明示する必要はありません。

| Mode | 依頼例 | 成果物 |
| --- | --- | --- |
| Implement | 「maintainable-code を使ってこの機能を実装して」 | 実装と、その仕様を保証する Test、変更に依存する Documentation 等の整合。範囲外の問題は改善候補として報告 |
| Review | 「maintainable-code の観点でこの変更をレビューして」 | Finding / Evidence / Impact / Direction 形式の指摘（コードは変更しない） |
| Improve | 「maintainable-code を使ってこの実装を改善して」 | 動作を維持した構造の改善、Test の保証責任の整理、変更に依存する Documentation 等の整合 |

「コードとドキュメントの整合性も確認して」「会話にしか残っていない前提がないか確認して」のように、変更後の Repository の整合性を確かめる依頼にも使います。

次の依頼には使いません。構文の質問、単独の不具合の説明、フォーマットだけの変更、文章の校正、一般的な Documentation の作成、README の文言修正だけの作業、diff の正しさだけを確認するレビュー、アーキテクチャの説明資料の作成です。

## 判断の観点

次の順に、必要な範囲だけを確認します。

1. **What** — コードが何を保証する必要があるか。現在の実装だけを仕様とみなさず、要求・既存 Test・Domain Model・Public API・呼び出し側を優先します。
2. **State** — 有効な状態と無効な状態、状態遷移、Invariant。Optional や Boolean の組み合わせに隠れた状態を探します。
3. **Test responsibility** — 各仕様を Unit / Integration / UI のどの Layer が保証するか。重複を整理し、不足だけを補います。
4. **Responsibility** — 異なる変更理由を持つ関心が混在していないか。
5. **Coupling** — 状態・順序・内部表現・仕様知識・Test による結合。
6. **How** — コメントの前に、型・名前・API・制御構造でコードの意図を表せるか。
7. **Repository coherence** — 変更に意味的に依存する Test・コメント・Documentation・Example・Configuration に、矛盾、古い記述、重複、会話への依存が残っていないか。Code と Documentation が食い違うとき、実装を自動的に正本とはしません。
8. **Simplification & validation** — 不要な abstraction、コメント、重複 Test、状態、分岐、依存の除去と、Test・既存の検証の実行。

Implement と Improve は、作業の会話履歴を失っても Repository から変更後の現在仕様を正しく理解・利用・変更できる状態を完了条件にします。Documentation の変更が不要なら変更しません。

Test の数、型や abstraction の数、コメントの削除、Documentation の量、Architecture Pattern への準拠は、それ自体を改善とみなしません。好みだけを理由にした指摘もしません。

## 構成

以下のパスは `skills/maintainable-code/` 内にあります。

| ファイル | 責務 |
| --- | --- |
| `SKILL.md` | 必須制約、mode 判定、workflow、Finding の形式、報告内容 |
| `references/principles.md` | What / How の分離、コメント、責務、結合、overengineering の判断基準 |
| `references/testing-boundaries.md` | Test Layer の責務、Contract Test、実装詳細 Test、削除・統合の基準 |
| `references/state-modeling.md` | Optional・Boolean・enum による状態表現、状態遷移、Invariant |
| `references/review-guide.md` | Finding の採否、severity、false positive の回避、範囲の制御 |
| `references/repository-coherence.md` | Code・Test・Documentation の役割、会話への依存の除去、source of truth の判断、Documentation の変更判断 |

## 検証

```bash
bash scripts/verify-versions.sh
```

スクリプトを同梱しないため、自動テストはありません。Skill の変更は、ローカルに導入して各 mode の依頼例を実行し、出力を確認します。ローカル導入は [コントリビューションガイド](../../CONTRIBUTING.md#ローカルで検証する) を参照してください。
