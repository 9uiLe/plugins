---
name: model-effort-guide
description: "Route tasks to the cost-optimal Claude model (Fable/Opus/Sonnet/Haiku) and effort level using a first-match operation-routing policy (P0 approval-gate / R0 direct / R1 scout / R2 verify / R3 delegate / R4 main), and delegate to cheap subagents (sonnet-implementer / haiku-scout) when appropriate. Japanese triggers: 「このタスクに最適なモデルは」「コスパよく実行して」「モデルと effort を選んで」「安く済ませて」「委譲して」「操作をルーティングして」."
---

# モデル/effort 使い分けガイド

与えられたタスクを操作列に分解し、操作ごとにコスト最適な担当 (メイン実行 or サブエージェント委譲) とモデル・effort を決定して実行する。

この文書で `PLUGIN_ROOT` と書く場合は、Claude Code では `${CLAUDE_PLUGIN_ROOT}`、Codex ではこの `SKILL.md` の 2 階層上にある `model-strategy` プラグインルートを指す。リファレンスはすべて `PLUGIN_ROOT/references/` 配下。

## 0. 原則

**高価なモデルは「判断」に、安価なモデルは「作業量」に使う。** メインセッションは設計・監査・レビュー・最難関実装に専念し、それ以外は委譲する。

## 0.5 実行環境の判定(最初に 1 回だけ)

- **Claude Code で実行中**: サブエージェント(`sonnet-implementer` / `haiku-scout` / Explore)への委譲が使える。以降の手順をそのまま適用する。`hooks/route-warn.mjs` による opt-in warn は Claude Code のみで動作する(§5)
- **Codex CLI で実行中**: モデル体系(GPT 系)・価格・reasoning effort・委譲手段が異なるため、判断基準は `references/07-codex.md` を読む。原則(§0)と委譲の鉄則(`02-decision-matrix.md` §8)はそのまま適用し、担当モデルだけ読み替える:
  1. **委譲**: Codex のマルチエージェント(`spawn_agent` / `agents.<name>`)で安いモデル(gpt-5.6-luna / gpt-5.4-mini 等)+ 低 effort の役割へ出す。使えない場合は `codex exec -m <model>` の別実行で代替
  2. **モデル/effort 切替**: 対話中は `/model`、プリセットは `--profile`
  3. 本プラグインの `sonnet-implementer` / `haiku-scout` エージェント定義は Claude Code 専用。Codex では同等の役割を `agents.<name>` に定義して使う

## 1. ルーティング手順

1. タスクを**操作列**に分解する(例: 「所在特定」「実装」「テスト実行」「レビュー統合」)
2. 各操作に **P0 → R0 → R1 → R2 → R3 → R4** を先勝ちで適用する。判定は述語 Y/N のみで行い、重要度・難易度の主観評価を挟まない(正本は `references/02-decision-matrix.md` §1、ルール定義そのものは `scripts/route-policy.mjs` の `RULES`)
3. Node.js が使える環境では、操作記述子 JSON を `scripts/route-policy.mjs route` に渡して判定できる(正本はこのルール表そのもの):
   ```bash
   echo '{"description":"grep for TODO","kind":"search","producesDiff":false}' \
     | node "PLUGIN_ROOT/scripts/route-policy.mjs" route
   ```
   Node.js が使えない環境では、§2 の表を同じ順序で手で辿る
4. 委譲する場合は §3 のマニフェスト規定に従って予定担当を記録し、`references/02-decision-matrix.md` §8「委譲時の鉄則」に従って実行する: 仕様・制約・受け入れ条件を**最初に全部**渡し、戻り値は「結論 + 根拠の要点」のみ要求する。独立タスクは 1 メッセージで並列に投げる
5. **コードベースが大きい場合**(`04-large-codebase.md` §4 の目安に該当)は、単価最適化とは別に**量制御**が支配的になる。R1/R2 は常時デフォルトで委譲する(同ファイル §3)
6. ユーザーがモデル選択の理由や価格を尋ねた場合のみ、`00-pricing.md` / `01-effort-levels.md` を読んで根拠付きで説明する

## 2. ルーティング表(概要。詳細・根拠は `references/02-decision-matrix.md`)

| ルール | 内容 | 担当 (Claude Code) | 担当 (Codex) |
| --- | --- | --- | --- |
| P0 | 対象外ゲート(push / PR / rebase / reset / clean 等) | approval-gate(要ユーザー承認) | approval-gate(要ユーザー承認) |
| R0 | 単発直接実行(diff なし・許可リスト内・単発読み取り) | main-direct | main-direct |
| R1 | 取得・列挙・抽出(grep・ファイル所在・依存列挙) | haiku-scout | luna-mini (+ low) |
| R2 | 既知検証手順の実行(テスト・lint・ビルド) | haiku-scout | luna-mini (+ low) |
| R3 | 構造化契約付き変更(仕様 4 フィールド完備) | sonnet-implementer | terra (+ medium) |
| R4 | デフォルト(設計・曖昧さの解消・デバッグ・レビュー統合) | main | sol |

## 3. 委譲マニフェスト(表示規定)

ルーティング確定後・実行開始前に割り当てを表示し、完了時に実効担当を突合して再掲する。表示形式は委譲対象(R1〜R3 に割り当てた操作)の件数で決まる:

- **委譲対象が 0 件**: 1 行サマリ + どの条件で全て R4/R0 になったかを添える
- **1 件**: `割当: [R1] 構成調査 → haiku-scout (Haiku) ｜ [R4] 設計・受入 → メイン (<セッションの実モデル>)` の 1 行形式
- **2 件以上**: 表(列: 作業 / ルール / 予定担当 / 実効担当 / 状態)。完了時は実効担当と差し戻しを反映して再掲する(最頻の逸脱 =「計画は R1 なのにメインが直接実行した」を可視化する)

モデル名は固定で書かず、セッションの実モデル名を記入する。

## 4. 出口検証

タスク完了時、マニフェストを JSON 化して `scripts/route-policy.mjs audit` に通し、findings があれば報告に含める(Node 不能環境では手動突合)。

```bash
cat manifest.json | node "PLUGIN_ROOT/scripts/route-policy.mjs" audit
```

## 5. opt-in 強制(warn hook)

`hooks/route-warn.mjs` は既定で不活性(何もしない)。`MODEL_STRATEGY_ROUTE_WARN=1` を環境変数として設定した場合のみ、メインセッションが R1 相当の操作を直接実行しようとした最初の 1 回に 1 行の委譲検討メッセージを注入する。既定不活性である理由: スキルが発動していないセッションにまで常時介入すると、警告が慢性化して読み飛ばされる懸念があるため(warn の慢性化対策)。

## 6. リファレンス

| ファイル | 内容 |
| --- | --- |
| `references/00-pricing.md` | 価格表・Fable 5 の実効コスト・キャッシュ/バッチ価格 |
| `references/01-effort-levels.md` | effort 5 段階の使い分けとモデル別知見 |
| `references/02-decision-matrix.md` | ルール定義の正本 (解説)・git 割り当て表・R3 の 4 フィールド・Codex 読み替え |
| `references/03-cost-levers.md` | キャッシュ温存・コンテキスト衛生・アンチパターン |
| `references/04-large-codebase.md` | 大規模コードベースの量制御 (常駐コンテキストを平坦に保つ規定) |
| `references/05-repo-index.md` | ナビゲーション索引 (pull 優先: 外部 queryable 索引を第一に、薄い CLAUDE.md 地図はフォールバック) |
| `references/06-context-monitor.md` | コンテキスト量・委譲の可視化を statusLine で行う同梱スクリプトと配線手順、実測手段と限界 |
| `references/07-codex.md` | Codex CLI (GPT 系モデル) の価格・reasoning effort・委譲代替の決定基準 |

## 7. 出力形式(推奨のみ求められた場合)

```
推奨: <担当> / effort <level>
理由: <1-2 文。コストと品質のトレードオフ>
委譲する場合のプロンプト案: <仕様・制約・受け入れ条件を含む>
```
