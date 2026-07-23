# Forward-test フィクスチャ

`fixtures/` の 3 ファイルは、Issue #71 で要求されたリリース前検証(README「リリース前検証」参照)用の forward-test 入力である。

## 実行方法

各フィクスチャの「入力」セクションを、本スキルが有効なフレッシュセッションにそのまま貼り付け、出力を「アサーション」チェックリストで判定する。全項目が成立すれば PASS。

自動化の制約: このリポジトリの CI(version 検証のみ)には LLM を起動する経路がないため、現時点では手動またはエージェント実行の forward test として運用する。CI へ組み込む場合は `claude -p` / `codex exec` を呼べるワークフローの追加が別途必要。

| フィクスチャ | 検証対象 |
|---|---|
| `fixtures/no-data.md` | 計測なし入力 → 計測計画モードへの強制フォールバック |
| `fixtures/measured-data.md` | ログのみ(Timeline なし)の SwiftCompile / Run Script 診断が正しい分岐に到達すること |
| `fixtures/greenfield.md` | 未実装の設計評価で MEASURED が出現せず CANDIDATE 止まりであること |
