# model-strategy

Claude Code / Codex の総利用量を、モデル選択だけでなく送信コンテキスト量・turn 数・委譲回数まで含めて抑えるプラグインです。

**原則: まず巨大コンテキストの反復送信を止め、その後で高価なモデルを「判断」に、安価なモデルを量のある定型作業に使う。**

通常は P0・R0〜R4 の軽量ルーティングを使う。監査可能な厳密モードでは、タスクを操作列に分解し、`P0`→`R0`→`R1`→`R2`→`R3`→`R4` の順に先勝ちで判定する。正本は [`scripts/route-policy.mjs`](./scripts/route-policy.mjs)、解説は [`references/02-decision-matrix.md`](./references/02-decision-matrix.md)。

## 提供するもの

### Skill

| Skill | 役割 |
| --- | --- |
| `model-effort-guide` | セッション単位でモデル・effort・有界な委譲方針を決める。通常は軽量ルーティングを使い、厳密なマニフェスト監査は明示 opt-in に限定する |

トリガー例: 「このタスクに最適なモデルは」「コスパよく実行して」「利用上限を節約して」「委譲方針を決めて」「操作をルーティングして」。通常の coding task では自動起動せず、セッション冒頭または方針変更時に 1 回だけ使います。

毎回の手動起動をなくしたい場合は、プロジェクトの `CLAUDE.md` に次の軽量 capsule だけを置きます。スキル全文や UserPromptSubmit ごとの自動注入は、毎 turn のコンテキストを増やすため推奨しません。

```md
## 利用量の原則
- 小さい既知操作はメインが直接実行する。広域探索はモデル固定の cheap scout、仕様確定済みのまとまった実装だけ implementer へ委譲する。
- 高価な親モデルを継承する Explore/general-purpose/fork をコスト削減目的で使わない。同目的の委譲は 1 回にまとめる。
- PR/Phase 完了時は /clear、約 150k tokens 超では状態退避後に /compact。sleep ポーリングは禁止。
- model-effort-guide はモデル方針を変更するとき、または厳密な routing audit が必要なときだけ呼ぶ。
```

### Scripts

| スクリプト | 役割 |
| --- | --- |
| [`scripts/route-policy.mjs`](./scripts/route-policy.mjs) | ルーティングルール (P0〜R4) の正本。`route`/`audit` サブコマンドで操作の判定・委譲マニフェストの監査を行う CLI |
| [`scripts/context-statusline.sh`](./scripts/context-statusline.sh) | メインセッションの常駐コンテキスト使用率を `statusLine` に表示する同梱スクリプト |
| [`scripts/subagent-statusline.sh`](./scripts/subagent-statusline.sh) | 委譲先タスクの状態を `subagentStatusLine` に表示する同梱スクリプト |

### Hooks (opt-in)

| Hook | 役割 |
| --- | --- |
| [`hooks/route-warn.mjs`](./hooks/route-warn.mjs) | `MODEL_STRATEGY_ROUTE_WARN=1` 設定時のみ、メインセッションが R1 相当の操作を直接実行しようとした際に委譲検討の警告を注入する。状態を保存できる場合はセッション・ツール名ごとに最初の 1 回に抑える (既定不活性) |
| [`hooks/scope-guard.mjs`](./hooks/scope-guard.mjs) | `MODEL_STRATEGY_MODE=conductor` かつ基準線ファイルが存在する場合のみ、`Edit`/`Write`/`NotebookEdit` が基準線の範囲外に書き込もうとした際に警告を注入する (warn-only・fail-open。Bash 経由の書き込みは検出不可。v0.3.0) |

### Subagents

| Agent | Model | 役割 |
| --- | --- | --- |
| `sonnet-implementer` | Sonnet | R3: 仕様が固まった、起動コストを正当化できるまとまりのある実装 |
| `haiku-scout` | Haiku | R1/R2: 複数ファイルの探索や独立検証を 1 回の有界な依頼で処理 |
| `judge` | Opus | 明示 opt-in の高保証 conductor mode で R4a を判定する。通常モードの日常レビューには使わない |
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

モデル選択前の既定動作:

- PR / Phase の完了時は `/clear`、約 150k tokens 超または途中状態を保つ必要がある場合は状態退避後に `/compact`
- `sleep` + メッセージのポーリングを避け、runtime / Orca の wait・monitor を使う
- 単発 Read や 1 コマンドにサブエージェントを起動しない。同目的の探索・検証は 1 回にまとめる
- Explore / general-purpose / fork のように高価な親モデルを継承する役割を、コスト削減目的で使わない
- 並列実行は所要時間短縮が必要な場合だけ。通常はキューして同時稼働を抑える

| タスク | 担当 | effort |
| --- | --- | --- |
| 設計・技術選定・監査・レビュー | メインセッション (Opus 級) | medium〜high |
| 最難関実装・大規模リファクタ | メインセッション | xhigh |
| 仕様確定済みの実装 | sonnet-implementer | — |
| 複数ファイルの探索・独立検証 | haiku-scout | — |
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
