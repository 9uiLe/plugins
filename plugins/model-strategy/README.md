# model-strategy

Claude Code / Codex で、タスク完了までの総利用量を抑えるためのプラグインです。モデル選択に加え、会話のコンテキスト量、やり取りの回数、サブエージェントへの委譲コストを考慮して実行方針を決めます。

次のような場合に使います。

- タスクに合うモデルと effort（推論に割く労力）を選びたい
- 長い会話や繰り返しの探索による利用量を抑えたい
- メインで実行する作業と、サブエージェントに任せる作業を決めたい
- 操作ごとの担当を記録し、監査可能な形で実行したい

## インストール

Claude Code の会話内:

```text
/plugin marketplace add 9uiLe/plugins
/plugin install model-strategy@9uile-plugins

```

Codex 用のターミナルコマンド:

```bash
codex plugin marketplace add 9uiLe/plugins
codex plugin add model-strategy@9uile-plugins
```

## 使い方

モデル選択や利用量、委譲方針を明示的に相談すると、`model-effort-guide` スキルが起動します。

```text
このタスクに最適なモデルと effort を選んで
利用上限を節約して、この機能を実装して
委譲方針を決めて
```

推奨を求めた場合は、モデル・effort・必要な委譲先、選択理由、会話を区切るタイミングを返します。実行も依頼した場合は、最初に方針を共有してから作業を進めます。

通常のコーディング依頼だけでは自動起動しません。同じ方針が続く間は繰り返し呼び出さず、セッション冒頭や方針変更時に使います。

## 実行方針

モデルを選ぶ前に、不要なコンテキストの蓄積と反復送信を抑えます。作業の区切りでは決定事項・検証結果・残作業を保存し、必要に応じて新規セッションや `/compact` を使います。開始時から入力が大きい場合は内訳を調べ、圧縮を繰り返しません。探索・検証は同じ目的の依頼にまとめ、待機には実行環境の完了通知や wait / monitor 機能を使います。

日常の作業は、次の区分で担当を決めます。

| 区分 | 作業 | 担当方針 |
| --- | --- | --- |
| P0 | 外部への書き込み、破壊的操作、履歴改変 | 実行権限を確認する |
| R0 | 既知ファイルの短い読み取り、単発の状態確認 | メインで直接実行する |
| R1 / R2 | 複数ファイルの探索、広域抽出、独立した検証 | 範囲を定めた探索・検証担当にまとめて依頼する |
| R3 | 対象、期待結果、変更範囲、検証方法が確定した実装 | 実装担当に委譲する |
| R4 | 設計、曖昧さの解消、デバッグ、レビューの統合 | メインで判断する |

ユーザー指定のモデル・effort・アドバイザー利用を優先します。指定のない追加委譲は、作業が独立し、最初の依頼だけで完結でき、起動や結果統合を含めても利用量が減る場合に行います。小さな既知操作は直接実行します。

### Orca アドバイザーを使う依頼例

作業内容に次を添えて使えます。Orca 公式 `orchestration` が起動・待機・完了手順を担い、`model-effort-guide` は相談範囲と終了条件を補います。

```text
model-effort-guide と orchestration スキルを利用し、Codex gpt-6-astra（effort: medium）をアドバイザーとして使ってください。
あなたが実装と最終判断を担当し、重要な設計判断・リスク・見落としをまとめて相談してください。

相談には目的・制約・検討案・具体的な質問・必要なファイルや差分を渡し、回答は重要な指摘・根拠・推奨案・未解決事項に絞ってください。
指摘は事実や検証結果に照らして採否を判断し、新しい証拠・重大な未解決点・結論に影響する変更がある場合だけ、差分をまとめて再相談してください。合意のためだけの往復は不要です。

待機は公式 orchestration の現行ガイドに従い、完了通知や待機機能を使ってください。sleep・端末読込・状態確認だけでモデルを繰り返し呼び出さず、待機中は独立した作業を進めてください。
最後に、採用・不採用にした重要な指摘と理由、残る未解決事項を簡潔に報告してください。
```

### 同梱サブエージェント

Claude Code 向けに、モデルを固定した次のエージェント定義を同梱しています。Codex では、利用可能なモデルと委譲機能に応じて担当を読み替えます。

| Agent | モデル | 用途 |
| --- | --- | --- |
| `haiku-scout` | Haiku | 探索・独立検証 |
| `sonnet-implementer` | Sonnet | 仕様が確定した、まとまりのある実装 |
| `judge` | Opus | 高保証モードでの独立判定 |
| `judge-fable` | Fable 5 | 高保証モードで、難しい判断や Opus judge の失敗後に使う独立判定 |

モデル価格、effort の対応、選択条件は[価格資料](./references/00-pricing.md)、[effort 資料](./references/01-effort-levels.md)、[Codex 向け資料](./references/07-codex.md)にまとめています。各資料の確認日と公式リンクを参照してください。

## 任意機能

### 監査と独立判定

監査可能なルーティングや独立判定を明示的に求めた場合は、高保証モード（conductor mode）を使います。操作ごとの割当をマニフェストに記録し、変更可能な範囲を基準線として保存し、必要に応じて judge に判定を委譲します。

[`scripts/route-policy.mjs`](./scripts/route-policy.mjs) が詳細な振り分けルールの正本です。`route` サブコマンドで操作を判定し、`audit` で割当マニフェストを監査します。詳細は[ルーティング規則](./references/02-decision-matrix.md)と[高保証モードの手順](./references/08-conductor-mode.md)を参照してください。

### 警告 hook

Claude Code 向けの hook は、対応する環境変数を設定した場合に有効になります。

| Hook | 有効化条件と動作 |
| --- | --- |
| [`route-warn.mjs`](./hooks/route-warn.mjs) | `MODEL_STRATEGY_ROUTE_WARN=1` で、メインが探索担当に相当する操作を直接実行すると委譲検討を促します。状態を保存できる場合、セッション・ツール名ごとに最初の 1 回に抑えます。 |
| [`scope-guard.mjs`](./hooks/scope-guard.mjs) | `MODEL_STRATEGY_MODE=conductor` と基準線ファイルがある場合に、`Edit` / `Write` / `NotebookEdit` の書き込み先が範囲外なら警告します。 |

警告は操作をブロックしません。`scope-guard` は Bash 経由の書き込みを検出できません。

### 使用状況の表示

[`context-statusline.sh`](./scripts/context-statusline.sh) はメインセッションのコンテキスト使用率を、[`subagent-statusline.sh`](./scripts/subagent-statusline.sh) は委譲先タスクの状態を表示するスクリプトです。設定方法と測定上の限界は[コンテキスト監視の資料](./references/06-context-monitor.md)を参照してください。

## 参照資料

| 資料 | 内容 |
| --- | --- |
| [価格](./references/00-pricing.md) | モデル価格、キャッシュ・バッチ価格、確認日と公式リンク |
| [effort](./references/01-effort-levels.md) | 推論労力の選び方とモデル別の対応 |
| [ルーティング規則](./references/02-decision-matrix.md) | 操作の分類、git 操作、委譲時に渡す情報 |
| [利用量を抑える方法](./references/03-cost-levers.md) | キャッシュ、コンテキスト管理、避けたい運用 |
| [大規模コードベース](./references/04-large-codebase.md) | 探索とコンテキスト量の制御 |
| [リポジトリ索引](./references/05-repo-index.md) | 必要な情報を引き出す索引の設計 |
| [コンテキスト監視](./references/06-context-monitor.md) | 状態表示の設定と測定方法 |
| [Codex](./references/07-codex.md) | モデル、reasoning effort、委譲の読み替え |
| [高保証モード](./references/08-conductor-mode.md) | マニフェスト、独立判定、範囲警告、運用上の限界 |
