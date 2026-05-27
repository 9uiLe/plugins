# quality-architect

**ISO/IEC 25010 製品品質モデル**（8 特性・31 副特性）を共通言語として、
ソフトウェア／システムの**アーキテクチャ設計**と**コードレビュー**を行う Claude Code プラグインです。

各特性ごとに、定義・調査観点・設計タクティクス・レビューチェックリスト・計測指標・
**実在確認済みの学術論文／公式文書リファレンス**をまとめたライブラリを内蔵しています。

## 収録スキル

| Skill | 用途 |
| --- | --- |
| `quality-architecture` | 要件から品質特性を優先付けし、各特性のタクティクスでアーキテクチャを設計・評価（ATAM 的トレードオフ分析、根拠リファレンス付き）。 |
| `quality-review` | コード/差分を 8 特性 31 副特性で網羅レビュー。重大度付き指摘とスコアカードを出力し、各指摘に学術/公式リファレンスを引用。 |

## 使い方

```
品質特性を踏まえてこのサービスのアーキテクチャを設計して
このコードを ISO/IEC 25010 でレビューして
```

スキルは要求に応じて自動的に起動します。

## リファレンス・ライブラリ

`references/` 配下に、図（ISO/IEC 25010:2011 / JIS X 25010:2013）の 8 特性を 1 ファイルずつ収録:

```
references/
├── 00-overview.md                  ← モデル全体・SQuaRE・2011/2023 差分・一次リファレンス
├── 01-functional-suitability.md    機能適合性
├── 02-performance-efficiency.md    性能効率性
├── 03-compatibility.md             互換性
├── 04-usability.md                 使用性
├── 05-reliability.md               信頼性
├── 06-security.md                  セキュリティ
├── 07-maintainability.md           保守性
└── 08-portability.md               移植性
```

各ファイルの構成: **定義 → 副特性（調査観点・設計タクティクス・レビュー項目・計測指標）→ 横断戦略 → 重点チェックリスト → アンチパターン → リファレンス**。

## 静的評価レイヤー（AI の揺らぎ対策）

`quality-review` は、測れる指標を**実在の静的解析ツールに委譲して決定論的に確定**し（再現可能）、
LLM の判断は数値化できない残余に閉じ込めます。設計は 3 層:

- **① 何を測るか**（特性→指標）= `references/`（ISO/IEC 25010 由来・言語非依存・共通）
- **② どう測るか**（指標→ツール/しきい値）= [`quality-gates.yml`](./quality-gates.yml)（**言語プロファイル**。ここだけ言語依存）
- **③ 判定**= スキルが数値としきい値を機械的に突き合わせ

言語差は ② のプロファイルに閉じ込めるため、**スキルもリファレンスも言語ごとに分けません**。
新言語は `quality-gates.yml` に profile を 1 つ追記するだけ。現在は **Swift** プロファイルを同梱
（SwiftLint / lizard / Periphery / swift-format / Trivy）。方法論は [`references/09-static-evaluation.md`](./references/09-static-evaluation.md)。

## 対象とする品質モデル

- 骨格: **ISO/IEC 25010:2011（JIS X 25010:2013）** — 8 特性 31 副特性。
- 2023 改訂版（Safety 特性の追加、Usability → Interaction Capability への変更等）の差分は `00-overview.md` に記載。安全性が要求に絡むシステムでは 2023 版を併用してください。

## ライセンス

MIT
