---
name: first-touch-review
description: "Run fixed-rubric first-touch UX review loops on a real device or simulator, complementing static code/design review with evidence from actual operation. Japanese triggers: 「初見ユーザーとして評価して」「実機で触って評価して」「シミュレータで操作して評価」「UX を初見で評価」."
---

# 初見ユーザー評価ループ

実機またはシミュレータでアプリを初めて触るユーザーとして操作し、固定ルーブリックで評価と修正を反復する。

この文書で `PLUGIN_ROOT` と書く場合は、Claude Code では `${CLAUDE_PLUGIN_ROOT}`、Codex ではこの `SKILL.md` の 2 階層上にある `agent-ops` プラグインルートを指す。リファレンスはすべて `PLUGIN_ROOT/references/` 配下。

## 0. 原則

静的レビューと動的レビューは両輪である。静的レビュー (コードレビュー・`quality-review`) だけでは体験上の致命バグは検出できない。

実績上、並列 5 エージェントの静的レビューをすり抜けた進捗喪失バグを、実機操作のみが発見した。1 周で完了を期待せず、収束まで 3〜4 周を見込む。

## 1. 既存プラグインとの境界

`quality-architect` は静的なコード・設計レビュー (ISO 25010) を担当する。`first-touch-review` は動的・体験的レビュー (実機操作) として並走し、静的レビューを補完する。

## 2. フロー

1. **起動する**: 対象アプリを実機またはシミュレータで起動する。
2. **初見で評価する**: `PLUGIN_ROOT/references/10-first-touch-rubric.md` の固定ルーブリックで操作・評価する。
3. **重大度順に修正する**: 致命、重大、軽微の順に指摘を整理し、再現手順と期待挙動を添える。
4. **同一条件で再評価する**: 同一ルーブリック・同一手順で、致命・重大ゼロまで反復する。詳細は `PLUGIN_ROOT/references/11-loop-protocol.md`。

## 3. 定量化

「感じ」の報告で終わらせない。スクリーンショットや録画から、知覚可能性や before/after 差分を数値化する。手法は `PLUGIN_ROOT/references/12-quantify-visual.md` を参照する。

## 4. リファレンス

| ファイル | いつ読むか |
| --- | --- |
| `references/10-first-touch-rubric.md` | 評価観点と出力形式を固定するとき |
| `references/11-loop-protocol.md` | 修正後の再評価条件を固定するとき |
| `references/12-quantify-visual.md` | 視覚・操作結果を数値化するとき |
