# agent-ops

エージェント開発を「指示書・証拠・反復」で運用するための、Claude Code / Codex 対応プラグインです。

**原則: 委譲先の自己報告ではなく、検証可能な証拠だけを受け入れる。**

## 提供するもの

### Skills

| Skill | 役割 |
| --- | --- |
| `codex-handoff` | 指示書駆動で外部エージェントに実装を委譲し、証拠ベースで監査する |
| `first-touch-review` | 固定ルーブリックの初見ユーザー評価を実機またはシミュレータで反復する |
| `crystallize` | セッションで得た知見を lint / script / skill / ADR に資産化する |

トリガー例: 「Codex に作業させて」「初見ユーザーとして評価して」「ノウハウをスキル化して」

### References

| ファイル | 内容 |
| --- | --- |
| [00-handoff-template.md](./references/00-handoff-template.md) | 外部エージェントへ渡す指示書テンプレート |
| [01-audit-checklist.md](./references/01-audit-checklist.md) | 自己報告を信用しない懐疑的監査チェックリスト |
| [02-execution-codex.md](./references/02-execution-codex.md) | `headroom wrap codex` 経由の実行経路 |
| [10-first-touch-rubric.md](./references/10-first-touch-rubric.md) | 初見ユーザー評価の固定ルーブリック |
| [11-loop-protocol.md](./references/11-loop-protocol.md) | 同一条件で再評価する反復プロトコル |
| [12-quantify-visual.md](./references/12-quantify-visual.md) | スクリーンショット・録画による視覚定量化 |
| [20-crystallize-routing.md](./references/20-crystallize-routing.md) | 知見をどの資産へ落とすかのルーティング表 |
| [21-crystallize-examples.md](./references/21-crystallize-examples.md) | 一般化した資産化例 |

## 既存プラグインとの棲み分け

| Plugin | 担当 |
| --- | --- |
| `model-strategy` | モデル・effort・委譲先の選択。`agent-ops` は選択後の委譲運用を扱う |
| `quality-architect` | 静的なコード・設計レビュー。`agent-ops` の初見レビューは動的・体験的レビューとして補完する |

## インストール

```bash
# Claude Code
/plugin marketplace add 9uiLe/plugins
/plugin install agent-ops@9uile-plugins

# Codex
codex plugin marketplace add 9uiLe/plugins
codex plugin add agent-ops@9uile-plugins
```
