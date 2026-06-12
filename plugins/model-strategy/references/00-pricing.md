# モデル価格とコスト構造

> **典拠**: platform.claude.com — Models Overview / Pricing (claude-api skill 経由、2026-06-04 時点キャッシュ)。最新値は `https://platform.claude.com/docs/en/pricing.md` を参照すること。
>
> **前提に関する注記**: 「Claude Code がサブスクリプションから従量課金制に移行する」という点について、本書執筆時点で公式発表の確認は取れていない(=未確認の前提)。本書は API 従量課金の価格体系をベースに「移行した場合でも合理的な運用」を設計するものである。

## §1 価格表 (per 1M tokens)

| Model | Model ID | Context | Input | Output | Output 単価比 (Haiku=1) |
| --- | --- | --- | --- | --- | --- |
| Claude Fable 5 | `claude-fable-5` | 1M | $10.00 | $50.00 | 10x |
| Claude Opus 4.8 | `claude-opus-4-8` | 1M | $5.00 | $25.00 | 5x |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | 1M | $3.00 | $15.00 | 3x |
| Claude Haiku 4.5 | `claude-haiku-4-5` | 200K | $1.00 | $5.00 | 1x |

### Fable 5 の実効コストに関する注意

Fable 5 は新トークナイザを採用しており、**同一コンテンツが Opus 系比で約 30% 多くトークン化される**(典拠: Model Migration Guide「Migrating to Claude Fable 5 — New tokenizer」)。名目 $10/$50 だが、Opus 系と同じ仕事量で比較すると実効 **約 $13/$65 相当**。Opus 4.8 比で実効 **約 2.6 倍**のコストになる。

## §2 コスト構造の直感

エージェント的な作業(コーディング・調査)では **output トークンが支配的**。thinking トークンも output として課金される。つまり:

- 「考える量・書く量」が多い作業ほどモデル単価差がそのまま効く
- 同じ実装作業を Opus → Sonnet に委譲すると output 課金が 25→15 で **40% 減**、Haiku なら **80% 減**
- input 側はプロンプトキャッシュで **読み取り約 0.1 倍**まで圧縮できる(→ `03-cost-levers.md`)

### 概算例: output 100万トークン分の作業

| 担当 | コスト |
| --- | --- |
| Fable 5 (実効) | 約 $65 |
| Opus 4.8 | $25 |
| Sonnet 4.6 | $15 |
| Haiku 4.5 | $5 |

## §3 キャッシュ・バッチの価格 (典拠: Prompt Caching / Batch docs)

| 項目 | 価格 |
| --- | --- |
| キャッシュ読み取り | base input の約 0.1 倍 |
| キャッシュ書き込み (5分 TTL) | base input の 1.25 倍 |
| キャッシュ書き込み (1時間 TTL) | base input の 2 倍 |
| Batches API | 全トークン 50% off (非対話・最大24h、API 直叩きのみ) |
