# Codex CLI (GPT 系モデル) のコスト最適化

> **典拠**: developers.openai.com — Codex Models / Codex Pricing / API Pricing / Prompt Caching / Config Reference、github.com/openai/codex（いずれも 2026-07-02 確認）。最新値は https://developers.openai.com/codex/models および https://developers.openai.com/api/docs/pricing を参照すること。
>
> 本書は `00`〜`04` の原則（高価なモデルは「判断」に、安価なモデルは「作業量」に。単価最適化と量制御は別レバー）を Codex CLI に写像する。原則そのものは環境非依存。

## §1 モデルと価格 (per 1M tokens, API 従量課金時)

| Model | 位置づけ | Input | Cached input | Output |
| --- | --- | --- | --- | --- |
| `gpt-5.5` | 公式推奨デフォルト（最難関・リサーチ） | $5.00 | $0.50 | $30.00 |
| `gpt-5.5` (long context) | 長大コンテキスト時 | $10.00 | $1.00 | $45.00 |
| `gpt-5.4` | プロフェッショナル用途のフラッグシップ | $2.50 | $0.25 | $15.00 |
| `gpt-5.4-mini` | **軽量タスク・サブエージェント用（公式推奨）** | $0.75 | $0.075 | $4.50 |
| `gpt-5.4-nano` | 最安・定型変換 | $0.20 | $0.02 | $1.25 |
| `gpt-5.3-codex-spark` | リアルタイム反復（research preview, Pro 限定） | — | — | — |

- gpt-5.2 / gpt-5.3-codex / gpt-5.1 系は ChatGPT サインインでは非推奨・段階廃止（API キーでは一部残存）
- **Claude 系との対応**（役割ベースの目安）: gpt-5.5 ≈ Opus/Fable 帯（判断）、gpt-5.4 ≈ Sonnet 帯（実装）、gpt-5.4-mini/nano ≈ Haiku 帯（探索・定型）

## §2 reasoning effort

`model_reasoning_effort` = `minimal | low | medium | high | xhigh`（config.toml / `/model` で設定。`xhigh` はモデル依存）。

- **デフォルトは全モデル `medium`**（Claude Code の `high`/`xhigh` デフォルトとは異なる。上げ忘れより下げ忘れに注意）
- 使い分けは `01-effort-levels.md` の考え方がそのまま通用する: 設計・監査は `high`〜`xhigh`、日常タスクは `medium`、探索・定型は `low`
- `xhigh` は「難問専用」であってデフォルト格上げ用ではない（レイテンシ非依存の難問のみ）

## §3 実行体制: Codex での委譲

Codex CLI にもマルチエージェント機構がある（`features.multi_agent`、デフォルト有効。`spawn_agent` / `wait_agent`、同時 6 スレッド・ネスト深さ 1）。委譲の鉄則（`02-decision-matrix.md` §3）はそのまま適用する。

| 手段 | 用途 |
| --- | --- |
| `agents.<name>.config_file` + `description` | 役割別エージェント定義。**安いモデル（gpt-5.4-mini）+ 低 effort の探索役／実装役**を定義しておくのが sonnet-implementer / haiku-scout 相当 |
| `/model`（対話中） | メインのモデル・effort を切替（設定は永続化される） |
| `codex exec -m <model>` | 非対話の一括処理を安いモデルの別実行に切り出す |
| `--profile <name>`（`$CODEX_HOME/<name>.config.toml`） | 「深い作業用 (gpt-5.5 + high)」「定型用 (gpt-5.4-mini + low)」等のプリセット切替 |

## §4 サブスクリプション制限 (ChatGPT プラン)

- Plus / Pro / Business / Enterprise の Codex 利用はプラン内クレジット制。**モデルが安いほど同じクレジットで多くこなせる**（例: 同一プランで gpt-5.4-mini は gpt-5.5 の約 4〜5 倍のタスク量）
- Pro は 5x / 20x ティアで枠が拡大。`gpt-5.3-codex-spark` は Pro 限定
- API キー認証での従量課金も可能（§1 の単価）。枠を使い切った際の逃がし先になる
- **含意**: 枠温存の構図は Claude サブスクと同じ。「gpt-5.5 は判断だけ、作業量は mini/nano へ」で消費速度を数分の一にできる

## §5 プロンプトキャッシュ

- cached input は **通常 input の 10%**（90% off）。自動・無料、明示の cache_control は不要
- 最小キャッシュ対象プレフィックス **1,024 トークン**、**完全プレフィックス一致**
- TTL: インメモリ 5〜10 分（最長 1h）。gpt-5.x / codex 系は `prompt_cache_retention: "24h"` で 24 時間保持（非 ZDR 組織はデフォルト）
- **含意**: `03-cost-levers.md` のキャッシュ温存規律（安定プレフィックスを先頭に・揮発情報を後ろに・ツール定義を不変に）は Codex でも同様に効く。AGENTS.md やシステム設定が安定プレフィックスを構成する

## §6 決定マトリックス (Codex 版クイックリファレンス)

| タスク種別 | モデル | reasoning effort |
| --- | --- | --- |
| アーキテクチャ設計・技術選定・監査 | gpt-5.5 | high〜xhigh |
| 最難関実装・大規模リファクタ | gpt-5.5 / gpt-5.4 | high〜xhigh |
| 仕様確定済みの実装 | gpt-5.4（委譲なら gpt-5.4-mini） | medium |
| コード探索・調査・grep 系 | gpt-5.4-mini | low |
| ドキュメント整形・定型変換 | gpt-5.4-mini / gpt-5.4-nano | minimal〜low |
| リアルタイムの高速反復（Pro） | gpt-5.3-codex-spark | — |
