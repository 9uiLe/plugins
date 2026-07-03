---
name: crystallize
description: "Crystallize session learnings into durable mechanisms such as lint, scripts, skills, ADRs, or project docs instead of leaving them in chat memory. Japanese triggers: 「ノウハウをスキル化して」「再発防止を仕組み化して」「知見を資産化して」「振り返りして仕組みに落として」."
---

# 知見の資産化

会話中に得た知見や矯正を、次回も発火する仕組みへ変換する。

この文書で `PLUGIN_ROOT` と書く場合は、Claude Code では `${CLAUDE_PLUGIN_ROOT}`、Codex ではこの `SKILL.md` の 2 階層上にある `agent-ops` プラグインルートを指す。リファレンスはすべて `PLUGIN_ROOT/references/` 配下。

## 0. 原則

**同じ矯正を二度受けない。同じ手作業を三度しない。**

知見は会話の中に置いたままにせず、発火する仕組み (lint・スクリプト・スキル) に変換する。置き場所は push (常駐コンテキストに足す) より pull (外部に置いてオンデマンド参照) を優先する。

## 1. トリガー

資産化を検討するのは、次の瞬間である。

- タスク完了時
- ユーザーから矯正・指摘を受けた時
- 同じ説明・作業を 2 回した時
- 「面倒だ」と感じる手作業に遭遇した時

## 2. フロー

1. 知見を 1 文で言語化する。
2. `PLUGIN_ROOT/references/20-crystallize-routing.md` のルーティング表で落とし先を決める。
3. 決めた資産を実装する。
4. **発火テスト**を行う。わざと違反・再実行して検知することを確認する。対照群のない再発防止策は信用しない。

## 3. 採用基準

スキル化する場合は、再利用可能 / 効果 (コスパ・アウトカム) が高い / 繰り返し発生、の 3 基準を満たすものだけを採用する。

1 回きりの知見は memory やプロジェクト docs に置く。

## 4. リファレンス

| ファイル | いつ読むか |
| --- | --- |
| `references/20-crystallize-routing.md` | 知見の落とし先を決めるとき |
| `references/21-crystallize-examples.md` | 過去の一般化例に照らして判断するとき |
