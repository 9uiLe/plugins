---
name: model-effort-guide
description: "Recommend the cost-optimal Claude model (Fable/Opus/Sonnet/Haiku) and effort level for a given task, and delegate to cheap subagents (sonnet-implementer / haiku-scout) when appropriate. Japanese triggers: 「このタスクに最適なモデルは」「コスパよく実行して」「モデルと effort を選んで」「安く済ませて」「委譲して」."
---

# モデル/effort 使い分けガイド

与えられたタスクを分類し、コスト最適なモデル・effort・実行体制(メイン実行 or サブエージェント委譲)を決定して実行する。

## 0. 原則

**高価なモデルは「判断」に、安価なモデルは「作業量」に使う。** メインセッションは設計・監査・レビュー・最難関実装に専念し、それ以外は委譲する。

## 1. 判定フロー

1. タスクを分類する: 設計判断 / 実装 / レビュー / 探索・調査 / 定型作業 / 大量一括処理
2. `${CLAUDE_PLUGIN_ROOT}/references/02-decision-matrix.md` のマトリックスで担当と effort を決定する
3. 委譲判定基準(同ファイル §2)を確認する:
   - 仕様が文章で書き切れる実装 → **sonnet-implementer** に委譲
   - 結論だけ欲しい探索・定型 → **haiku-scout** に委譲
   - 新しい設計判断を含む → メインセッションで実行
4. 委譲する場合は §3 の鉄則に従う: 仕様・制約・受け入れ条件を**最初に全部**渡し、戻り値は「結論 + 根拠の要点」のみ要求する。独立タスクは 1 メッセージで並列に投げる
5. **コードベースが大きい場合** (`04-large-codebase.md` §4 の目安に該当) は、単価最適化とは別に**量制御**が支配的になる。探索を無条件委譲し (context firewall)、メインの常駐コンテキストを平坦に保つ。同ファイル §3 の規定をデフォルトとして適用する
6. ユーザーがモデル選択の理由や価格を尋ねた場合のみ、`00-pricing.md` / `01-effort-levels.md` を読んで根拠付きで説明する

## 2. クイックリファレンス

| タスク | 担当 | effort |
| --- | --- | --- |
| 設計・技術選定・監査 | メインセッション | high〜xhigh |
| 最難関実装・大規模リファクタ | メインセッション | xhigh |
| 仕様確定済みの実装 | sonnet-implementer | (委譲) |
| 探索・調査・定型作業 | haiku-scout | (委譲) |
| レビューの個別検証 fan-out | Sonnet サブエージェント並列 | (委譲) |

## 3. リファレンス

| ファイル | 内容 |
| --- | --- |
| `references/00-pricing.md` | 価格表・Fable 5 の実効コスト・キャッシュ/バッチ価格 |
| `references/01-effort-levels.md` | effort 5 段階の使い分けとモデル別知見 |
| `references/02-decision-matrix.md` | タスク分類マトリックスと委譲判定基準 |
| `references/03-cost-levers.md` | キャッシュ温存・コンテキスト衛生・アンチパターン |
| `references/04-large-codebase.md` | 大規模コードベースの量制御 (常駐コンテキストを平坦に保つ規定) |
| `references/05-repo-index.md` | リポジトリ索引コンベンション (CLAUDE.md テンプレ・安価な生成手順) |

## 4. 出力形式(推奨のみ求められた場合)

```
推奨: <担当> / effort <level>
理由: <1-2 文。コストと品質のトレードオフ>
委譲する場合のプロンプト案: <仕様・制約・受け入れ条件を含む>
```
