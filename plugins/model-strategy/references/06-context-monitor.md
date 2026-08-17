# コンテキスト量の可視化

> **典拠**: statusLine の入力スキーマは Claude Code 公式ドキュメント (statusline.md) に従う。本書は `04-large-codebase.md` §1 の二次曲線を、セッション中に可視化して `/clear` の判断を促す仕組み。

`04` の量制御は「常駐コンテキストを平坦に保つ」のが要だが、**いま常駐量がどれだけ増えているかは人には見えない**。二次曲線に入ってから気づくと手遅れになる。statusLine に使用率を出して、タスク境界で `/clear` する判断材料にする。

## §1 同梱スクリプト

`scripts/context-statusline.sh` は statusLine の stdin JSON を読み、1 行で表示する。

```
Claude Opus 4.8 ⊙ ctx 78% ▓▓▓▓▓▓▓░░░ 156k/200k  $1.92  ⚠ /clear 推奨
```

- `ctx NN%` + 10 セグメントバー: コンテキストウィンドウ使用率 (`context_window.used_percentage`)
- `156k/200k`: 常駐 input トークン / ウィンドウサイズ
- `$1.92`: セッション推定コスト (`cost.total_cost_usd`)
- 色: 緑 <50% / 黄 50〜閾値 / 赤 ≧閾値 または 200k 超過 (`exceeds_200k_tokens`)
- 赤になると `⚠ /clear 推奨` を表示

## §2 配線 (ユーザー/プロジェクトの settings.json)

> **注意**: プラグインは statusLine を自動注入できない (Claude Code の仕様)。利用者が自分の `settings.json` に 1 度だけ配線する。
>
> さらに、`statusLine` は**プラグイン実行コンテキストの外**で動くため、`${CLAUDE_PLUGIN_ROOT}` は**展開されない**。必ずスクリプトの**絶対パス**を指定すること (`plugins/compact-plus` の statusline 配線と同じ制約)。

```json
{
  "statusLine": {
    "type": "command",
    "command": "/absolute/path/to/model-strategy/scripts/context-statusline.sh"
  }
}
```

絶対パスの決め方:

- **リポジトリ checkout がある場合 (推奨)**: checkout 内の `plugins/model-strategy/scripts/context-statusline.sh` を指す
- **marketplace インストールのみの場合**: 実体は `~/.claude/plugins/cache/<marketplace名>/model-strategy/<version>/scripts/context-statusline.sh` に展開されるが、**version 付きパスはプラグイン更新のたびに変わる**。更新後に statusline が壊れたらパスを貼り直すこと (この理由から checkout パスの直接指定が確実)

Codex でこのファイルを参照する場合は、この `references/` ディレクトリの 1 階層上をプラグインルートとして読み替える。

## §3 依存と設定

- **`jq`** が必要 (未インストールなら案内メッセージのみ表示し、セッションは妨げない)
- 警告閾値は環境変数 **`MODEL_STRATEGY_CTX_WARN`** (既定 `75` = 使用率%) で変更可。早めに区切りたいなら `60` 等に下げる

## §4 閾値の考え方 (04 との接続)

二次曲線の主因は「常駐量がセッション中に単調増加すること」(`04` §1)。使用率そのものより、**タスクが一区切りしたタイミングで赤に近ければ `/clear`** という運用が効く。閾値は「区切りで切る判断を促す」目安であって、ハード制限ではない。

- 黄 (50%〜): そろそろ次のタスクは新セッションを検討
- 赤 (≧閾値 / 200k 超過): 区切りがついたら `/clear`。続行するなら常駐を増やさない (探索は委譲・出力はファイルへ)

## §5 限界

- statusLine は**表示のみ**。自動で `/clear` はしない (判断は人 or メインセッション)
- hook ペイロードにはトークン量が無いため、hook での自動警告は実装できない (公式仕様)。可視化は statusLine が唯一の面
- 表示値は Claude Code が提供する推定値。厳密な課金額ではなく傾向把握に使う

## §6 関連

- 常駐量を増やさない具体策: `04-large-codebase.md` §3
- 探索委譲・コンテキスト衛生: `03-cost-levers.md` §2
- 組み込みの内訳確認: `/context` コマンド (どの要素が常駐量を食っているかの診断)

## §7 委譲の可視化 (subagentStatusLine)

`subagentStatusLine` は `statusLine` とは**別のトップレベルキー**で、委譲先タスク (サブエージェント) ごとの状態を表示できる。同梱スクリプト `scripts/subagent-statusline.sh` は stdin の `tasks[]` を読み、タスクごとに 1 行の NDJSON `{"id":"<task id>","content":"<row body>"}` を出力する。

配線 (ユーザー/プロジェクトの settings.json。`statusLine` とは別キーとして追加):

```json
{
  "subagentStatusLine": {
    "type": "command",
    "command": "/absolute/path/to/model-strategy/scripts/subagent-statusline.sh"
  }
}
```

絶対パスの制約は §2 と同じ (`statusLine` 同様、プラグイン実行コンテキストの外で動くため `${CLAUDE_PLUGIN_ROOT}` は展開されない。checkout パスの直接指定を推奨)。

バージョン要件: `tasks[].model` (解決済みモデル ID) は **v2.1.205+**、`tasks[].effort` は **v2.1.214+** のみ提供される (それ未満のバージョンではフィールド自体が存在しない)。

限界: プラグインは `agent` / `subagentStatusLine` の 2 キーのみをサポートする同梱 `settings.json` を提供できる (公式仕様上サポートされる) が、その内部で `command` 中の `${CLAUDE_PLUGIN_ROOT}` が展開されるかは未確認のため、確証が取れるまで本バージョンではプラグイン同梱によるデフォルト提供を見送り、ユーザー手動配線をベースラインとする。

## §8 実測手段と限界

- `/cost` は**セッション合算値**であり、委譲したサブエージェント分のコストも含む
- 通常の `statusLine` (§1〜§2) は**メインセッションの推定値のみ**を示す。サブエージェントの消費は `subagentStatusLine` 側の `tasks[]` でしか見えない
- モデル別の内訳は **OTel (OpenTelemetry) 連携でのみ**取得できる。ルール別 (R0〜R4) の実施状況を示す面は委譲マニフェストの実効記録のみ
- タスク構成 (作業量) を揃えないセッション前後比較では、ルーティングの効果と仕事量そのものの差を分離できない

上記は観測手段の**粒度の事実**であり、特定の比較プロトコル (何をいつ・どう比較すべきか) は本書では規定しない。
