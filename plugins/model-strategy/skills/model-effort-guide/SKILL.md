---
name: model-effort-guide
description: "Choose a cost-effective main model, effort, and bounded delegation plan for Claude Code or Codex when the user explicitly asks about model choice, usage cost, delegation, or operation routing. Do not invoke for routine coding merely because a task could be delegated. Japanese triggers: 「このタスクに最適なモデルは」「コスパよく実行して」「モデルと effort を選んで」「利用上限を節約して」「委譲方針を決めて」「操作をルーティングして」."
---

# モデル / effort 使い分けガイド

目的はモデル単価ではなく、タスク完了までの**総利用量**を下げること。概算は次で考える。

`総利用量 ≈ 各 turn の送信コンテキスト量の合計 + サブエージェントの全リクエスト`

高価なモデルを判断に、安価なモデルを量のある定型作業に使う。ただし、巨大コンテキストの反復送信や過剰なサブエージェント起動は、モデル差より高くつく。

`PLUGIN_ROOT` は Claude Code では `${CLAUDE_PLUGIN_ROOT}`、Codex ではこの `SKILL.md` の 2 階層上にある `model-strategy` ディレクトリを指す。

## 1. まずセッションを軽く保つ

モデル選択より先に次を適用する。

- このスキルは**セッション冒頭または方針変更時に 1 回**使う。同じ方針のままタスクごとに再実行しない
- PR 1 本、Phase 1 つなど作業単位が終わったら `/clear`。継続情報が必要なら作業状態をファイルに保存してから `/compact`
- コンテキストが約 150k tokens を超えた、または探索結果やログが累積したら、新しい探索・委譲を増やす前に `/compact` を優先する
- 待機は runtime の wait / monitor / wakeup、または Orca の wait 系機能を使う。`sleep` とメッセージ送信を繰り返すポーリングは禁止
- 同じ権限拒否・存在しない tool・壊れた wrapper を再試行しない。原因となる設定か呼び出し方を直してから 1 回だけ再試行する
- 生ログ、全文、巨大 diff は会話へ戻さず、必要箇所・結論・ファイル参照だけを残す

詳細なコンテキスト対策が必要な場合だけ `references/03-cost-levers.md` を読む。大規模リポジトリで探索範囲を制御するときだけ `references/04-large-codebase.md` を読む。

## 2. 軽量ルーティング

日常利用では、タスク全体を細かな操作列へ分解してマニフェスト化しない。次の表で、意味のある作業塊ごとに最初に該当する行を選ぶ。

| 区分 | 条件 | Claude Code | Codex |
| --- | --- | --- | --- |
| P0 | 外向き・破壊的・履歴改変操作 | 実行直前の権限確認 | 実行直前の権限確認 |
| R0 | 既知パスの短い Read、単発 status、短い既知コマンド | main-direct | main-direct |
| R1/R2 | 複数ファイルの探索、広域抽出、独立した既知検証 | `haiku-scout` | cheap scout + low |
| R3 | 対象・結果・変更範囲・検証方法が確定した、まとまりのある実装 | `sonnet-implementer` | implementation model + medium |
| R4 | 設計、曖昧さ解消、デバッグ、レビュー統合 | main | capable main model |

R0 は、委譲の起動と結果統合より直接実行の方が短い場合に使う。R1/R2 も 1 コマンドずつ別エージェントにせず、同じ目的の探索・検証を 1 回の有界な依頼へまとめる。

厳密な述語、git 操作、R3 の契約が必要な場合だけ `references/02-decision-matrix.md` を読み、必要なら `scripts/route-policy.mjs route` を使う。

## 3. 委譲の損益分岐

次を全て満たすときだけ委譲する。

1. 作業が独立しており、戻り値を短くできる
2. 仕様・制約・受け入れ条件・対象範囲を最初の依頼に書き切れる
3. 起動・親文脈の複製・結果統合を含めても、メインで直接行うより利用量が減る

追加規則:

- `haiku-scout` / `sonnet-implementer` のようにモデルを固定した役割を使う。高価な親モデルを継承する Explore、general-purpose、fork 型はコスト削減目的では使わない
- R1/R2 は対象ディレクトリ、検索語、コマンド、打ち切り条件を指定する。結果は結論と `file:line` 程度に制限する
- R3 は対象、観測可能な結果、変更可能範囲、検証方法を 1 回で渡す。対象ファイルが広い、または設計判断を残す依頼は R4 に戻す
- 並列実行は壁時計短縮が必要な独立タスクだけ。通常はキューし、同時稼働セッションを増やさない
- 委譲後の追加質問を常態化させない。情報不足ならメインで契約を固め直し、1 回だけ再依頼する

## 4. メインモデルと effort

- 短い運用作業、既知手順、定型 PR 作成は Sonnet 級から始める
- 通常の設計・レビュー・デバッグは Opus 級の medium〜high を基本にする
- Fable と xhigh/max は、アーキテクチャ級の判断、長時間自律実行、または下位モデルでの実証済み失敗が再実行コストを上回る場合に限定する
- セッションが既に巨大なら、モデルを切り替えて同じ文脈を引きずる前に compact / clear を選ぶ

価格や effort の根拠をユーザーが求めた場合だけ `references/00-pricing.md` と `references/01-effort-levels.md` を読む。Codex 固有のモデル対応が必要な場合だけ `references/07-codex.md` を読む。

## 5. 高保証モードは明示 opt-in

通常タスクでは割当マニフェスト、完了監査、judge を使わない。ユーザーが監査可能なルーティング、独立判定、conductor mode を明示的に求めた場合だけ `references/08-conductor-mode.md` を読み、マニフェスト表示・baseline・`route-policy.mjs audit` を適用する。

`judge` / `judge-fable` はコスト削減用の既定経路ではない。高影響な判断に独立レビューが必要な場合だけ使い、日常の diff 受け入れには起動しない。

## 6. 出力

推奨だけを求められた場合は、詳細な操作表を作らず次の 3 行で答える。

```text
推奨: <メインモデル / effort / 必要なら委譲先>
理由: <総コンテキスト・turn 数・品質のトレードオフを 1〜2 文>
区切り: <clear / compact の時点、または不要>
```

実行も求められた場合は、この方針を作業開始時に 1 回だけ共有し、その後は通常の作業報告に戻る。
