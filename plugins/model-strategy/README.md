# model-strategy

Claude Code を従量課金前提でコスパよく運用するための、Claude Code / Codex 対応モデル・effort 使い分けプラグインです。

**原則: 高価なモデルは「判断」に、安価なモデルは「作業量」に使う。**

## 提供するもの

### Skill

| Skill | 役割 |
| --- | --- |
| `model-effort-guide` | タスクを分類し、最適なモデル(Fable/Opus/Sonnet/Haiku)・effort・実行体制(メイン or 委譲)を推奨/実行する |

トリガー例: 「このタスクに最適なモデルは」「コスパよく実行して」「安く済ませて」

### Subagents

| Agent | Model | 役割 |
| --- | --- | --- |
| `sonnet-implementer` | Sonnet | 仕様が固まった実装タスク (メイン比で output 課金 40% 減) |
| `haiku-scout` | Haiku | 探索・調査・定型作業 (同 80% 減) |

### References

| ファイル | 内容 |
| --- | --- |
| [00-pricing.md](./references/00-pricing.md) | モデル価格表・Fable 5 の実効コスト・キャッシュ/バッチ価格 |
| [01-effort-levels.md](./references/01-effort-levels.md) | effort 5 段階 (low〜max) の使い分けとモデル別知見 |
| [02-decision-matrix.md](./references/02-decision-matrix.md) | タスク分類 × モデル/effort 決定マトリックス・委譲判定基準 |
| [03-cost-levers.md](./references/03-cost-levers.md) | プロンプトキャッシュ温存・コンテキスト衛生・アンチパターン |
| [04-large-codebase.md](./references/04-large-codebase.md) | 大規模コードベースの量制御・常駐コンテキストを平坦に保つ規定 |
| [05-repo-index.md](./references/05-repo-index.md) | ナビゲーション索引 (pull 優先)・外部 queryable 索引を第一に薄い CLAUDE.md 地図はフォールバック |
| [06-context-monitor.md](./references/06-context-monitor.md) | コンテキスト量を statusLine で可視化する同梱スクリプトと配線手順 |
| [07-codex.md](./references/07-codex.md) | Codex CLI (GPT 系モデル) の価格・reasoning effort・委譲代替の決定基準 |

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
