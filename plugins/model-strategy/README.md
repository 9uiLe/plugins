# model-strategy

Claude Code を従量課金前提でコスパよく運用するための、Claude Code / Codex 対応モデル・effort 使い分けプラグインです。

**原則: 高価なモデルは「判断」に、安価なモデルは「作業量」に使う。**

タスクは操作列に分解し、`P0`(対象外ゲート)→`R0`(単発直接実行)→`R1`(取得・列挙・抽出)→`R2`(既知検証手順の実行)→`R3`(構造化契約付き変更)→`R4`(デフォルト) の順に先勝ちでルーティングする。正本は [`scripts/route-policy.mjs`](./scripts/route-policy.mjs)、解説は [`references/02-decision-matrix.md`](./references/02-decision-matrix.md)。

## 提供するもの

### Skill

| Skill | 役割 |
| --- | --- |
| `model-effort-guide` | タスクを操作列に分解し、`route-policy.mjs` のルール (P0〜R4) に従って最適なモデル(Fable/Opus/Sonnet/Haiku)・effort・実行体制(メイン or 委譲)を推奨/実行する |

トリガー例: 「このタスクに最適なモデルは」「コスパよく実行して」「安く済ませて」「委譲して」「操作をルーティングして」

### Scripts

| スクリプト | 役割 |
| --- | --- |
| [`scripts/route-policy.mjs`](./scripts/route-policy.mjs) | ルーティングルール (P0〜R4) の正本。`route`/`audit` サブコマンドで操作の判定・委譲マニフェストの監査を行う CLI |
| [`scripts/context-statusline.sh`](./scripts/context-statusline.sh) | メインセッションの常駐コンテキスト使用率を `statusLine` に表示する同梱スクリプト |
| [`scripts/subagent-statusline.sh`](./scripts/subagent-statusline.sh) | 委譲先タスクの状態を `subagentStatusLine` に表示する同梱スクリプト |

### Hooks (opt-in)

| Hook | 役割 |
| --- | --- |
| [`hooks/route-warn.mjs`](./hooks/route-warn.mjs) | `MODEL_STRATEGY_ROUTE_WARN=1` 設定時のみ、メインセッションが R1 相当の操作を直接実行しようとした最初の 1 回に委譲検討の警告を注入する (既定不活性) |
| [`hooks/scope-guard.mjs`](./hooks/scope-guard.mjs) | `MODEL_STRATEGY_MODE=conductor` かつ基準線ファイルが存在する場合のみ、`Edit`/`Write`/`NotebookEdit` が基準線の範囲外に書き込もうとした際に警告を注入する (warn-only・fail-open。Bash 経由の書き込みは検出不可。v0.3.0) |

### Subagents

| Agent | Model | 役割 |
| --- | --- | --- |
| `sonnet-implementer` | Sonnet | R3 (構造化契約付き変更): 仕様が固まった実装タスク (メイン比で output 課金 40% 減) |
| `haiku-scout` | Haiku | R1/R2 (取得・列挙・抽出、既知検証手順の実行): 探索・調査・定型作業 (同 80% 減) |
| `judge` | Opus | conductor mode (v0.3.0) の R4a (判断パケット完結型) 判定担当。ファイル証拠は自分で読む。実装・編集は行わない |
| `judge-fable` | Fable 5 | `judge` と同一プロトコルの Fable 5 版 (静的な別定義)。Opus judge で 2 回失敗した R4a、または最難関判断限定 (v0.3.0) |

### References

| ファイル | 内容 |
| --- | --- |
| [00-pricing.md](./references/00-pricing.md) | モデル価格表・Fable 5 の実効コスト・キャッシュ/バッチ価格 |
| [01-effort-levels.md](./references/01-effort-levels.md) | effort 5 段階 (low〜max) の使い分けとモデル別知見 |
| [02-decision-matrix.md](./references/02-decision-matrix.md) | 操作ルーティング (P0〜R4) の解説・git 割り当て表・R3 の 4 フィールド・Codex 読み替え (ルールの正本は `scripts/route-policy.mjs`) |
| [03-cost-levers.md](./references/03-cost-levers.md) | プロンプトキャッシュ温存・コンテキスト衛生・アンチパターン |
| [04-large-codebase.md](./references/04-large-codebase.md) | 大規模コードベースの量制御・常駐コンテキストを平坦に保つ規定 |
| [05-repo-index.md](./references/05-repo-index.md) | ナビゲーション索引 (pull 優先)・外部 queryable 索引を第一に薄い CLAUDE.md 地図はフォールバック |
| [06-context-monitor.md](./references/06-context-monitor.md) | コンテキスト量・委譲の可視化を statusLine/subagentStatusLine で行う同梱スクリプトと配線手順、実測手段と限界 |
| [07-codex.md](./references/07-codex.md) | Codex CLI (GPT 系モデル) の価格・reasoning effort・委譲代替の決定基準 |
| [08-conductor-mode.md](./references/08-conductor-mode.md) | conductor mode (v0.3.0): R4 サブタイプ (R4-ctx/R4a/R4b)・judge 委譲・失敗シグナル分類・scope-guard・限界の明記 |

## 戦略の要約

| タスク | 担当 | effort |
| --- | --- | --- |
| 設計・技術選定・監査・レビュー | メインセッション (Opus 4.8) | high〜xhigh |
| 最難関実装・大規模リファクタ | メインセッション | xhigh |
| 仕様確定済みの実装 | sonnet-implementer | — |
| 探索・調査・定型作業 | haiku-scout | — |
| 大量の機械的一括処理 | Batches API (API 直叩き、50% off) | — |

Fable 5 は Opus 4.8 比で約 2 倍のコスト（トークナイザは同一）。サブスクでも従量クレジット制（$10/$50。同梱期間は 2026-07-07 で終了）のため、「長時間自律実行」「Opus で失敗を繰り返すタスク」「Fable でしか差が出ない判断タスク」に限定します（詳細: [00-pricing.md §4](./references/00-pricing.md)）。

## インストール

```bash
# Claude Code
/plugin marketplace add 9uiLe/plugins
/plugin install model-strategy@9uile-plugins

# Codex
codex plugin marketplace add 9uiLe/plugins
codex plugin add model-strategy@9uile-plugins
```

## 典拠

価格・effort の仕様は platform.claude.com / developers.openai.com の公式ドキュメントに基づきます（価格表と Codex モデル表は 2026-07-23 に公式ページで再照合、effort 仕様の基礎は 2026-06-04 時点キャッシュ + 2026-07-23 の CLI 実機確認)。最新値は各リファレンス冒頭のリンクから確認してください。
