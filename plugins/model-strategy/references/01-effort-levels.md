# effort パラメータの使い分け

> **典拠**: platform.claude.com — Effort Parameter / Model Migration Guide (claude-api skill 経由、2026-06-04 時点キャッシュ)。

## §1 effort とは

`output_config.effort` はモデルの「思考の深さと総トークン消費」を制御するパラメータ。**低い effort = ツール呼び出しが少なく統合され、前置きが減り、確認が簡潔になる** = output 課金が直接減る。

- 対応モデル: Fable 5 / Opus 4.5 以降 / Sonnet 4.6 (Haiku 4.5 は非対応)
- レベル: `low` / `medium` / `high` / `xhigh` (Opus 4.7+) / `max`
- API デフォルトは `high`。**Claude Code のデフォルトは xhigh** (Opus 4.7+)

## §2 レベル別ガイド

| Level | 用途 | コスト感 |
| --- | --- | --- |
| `max` | 正確性がコストより重要な最難関タスク。過剰思考のリスクあり、収穫逓減 | 最大 |
| `xhigh` | コーディング・エージェント的長時間タスクの本命 (Opus 4.7/4.8) | 大 |
| `high` | **品質とトークン効率のスイートスポット**。知的タスクの推奨最低ライン | 中 |
| `medium` | コスト重視で知性を少し妥協できる定常作業 | 小 |
| `low` | サブエージェント・単純タスク・レイテンシ重視 | 最小 |

## §3 モデル別の重要な知見 (典拠: Migration Guide)

### Opus 4.8
- 「反射的に xhigh」ではなく **`high` を起点に上下を試す**のが公式推奨
- **effort とコストの関係は単調ではない**: エージェント作業では高 effort が往復回数を減らし、総コストがむしろ下がることがある。逆に `medium` で同等品質がより短時間で出るタスクもある
- 自分のタスクで `medium` / `high` / `xhigh` をスイープして経路ごとに固定するのが正攻法

### Fable 5
- **`low` でも従来モデルの `xhigh`〜`max` を超える品質が出ることが多い**(公式記載)。Fable 5 を使うときほど effort を下げる余地がある
- 高 effort ではルーチン作業に対して過剰なコンテキスト収集・熟考をしがち。正しく完了するのに時間がかかりすぎる場合は effort を下げる

### Sonnet 4.6
- デフォルトが `high` なので、チャット的・定型的な用途では明示的に `low`/`medium` に下げないと過剰消費する

## §4 Claude Code での設定方法

- メインセッション: `/model` でモデルと effort を選択 (例: Opus (high))
- サブエージェント: agents 定義の frontmatter `model:` でモデル指定(effort はモデル既定に従う)
- 迷ったら: **メイン high、サブエージェント low〜medium** から始めて、品質不足を感じた経路だけ上げる
