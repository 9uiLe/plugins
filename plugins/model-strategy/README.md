# model-strategy

Claude Code を従量課金前提でコスパよく運用するための、モデル・effort 使い分けプラグインです。

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

## 戦略の要約

| タスク | 担当 | effort |
| --- | --- | --- |
| 設計・技術選定・監査・レビュー | メインセッション (Opus 4.8) | high〜xhigh |
| 最難関実装・大規模リファクタ | メインセッション | xhigh |
| 仕様確定済みの実装 | sonnet-implementer | — |
| 探索・調査・定型作業 | haiku-scout | — |
| 大量の機械的一括処理 | Batches API (API 直叩き、50% off) | — |

Fable 5 は新トークナイザにより実効コストが Opus 4.8 の約 2.6 倍のため、長時間自律実行や Opus で失敗を繰り返すタスクに限定します。

## インストール

```
/plugin install model-strategy@9uile-plugins
```

## 典拠

価格・effort の仕様は platform.claude.com の公式ドキュメント (2026-06-04 時点) に基づきます。最新値は各リファレンス冒頭のリンクから確認してください。
