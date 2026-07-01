# quality-architect

**ISO/IEC 25010:2023 製品品質モデル**（9 特性・40 副特性）を共通言語として、
ソフトウェア／システムの**アーキテクチャ設計**と**コードレビュー**を行う Claude Code / Codex プラグインです。

各特性ごとに、定義・調査観点・設計タクティクス・レビューチェックリスト・計測指標・
**実在確認済みの学術論文／公式文書リファレンス**をまとめたライブラリを内蔵しています。

## 収録スキル

| Skill | 用途 |
| --- | --- |
| `quality-architecture` | 要件から品質特性を優先付けし、各特性のタクティクスでアーキテクチャを設計・評価（ATAM 的トレードオフ分析、根拠リファレンス付き）。**まだコードが無い設計**が対象。 |
| `quality-review` | コード/差分を 9 特性 40 副特性で網羅レビュー。重大度付き指摘とスコアカードを出力し、各指摘に学術/公式リファレンスを引用。**既存コードの設計が妥当かの「設計レビュー」もこちら**（§1 step 2.5 設計妥当性トリアージ）。 |

> **使い分けの軸は「対象が既に在るか」。**「設計の妥当性を見る＝architecture」ではありません。既存コードの設計評価は `quality-review` の step 2.5 が担い、欠陥チェックの前にトップダウンで設計判断の妥当性を評価します。review が「設計を作り直すべき」と結論し、置換アーキの新規設計に進む場合のみ `quality-architecture` へ前方ハンドオフします。

## 使い方

```
品質特性を踏まえてこのサービスのアーキテクチャを設計して
このコードを ISO/IEC 25010 でレビューして
```

スキルは要求に応じて自動的に起動します。

## インストール

```bash
# Claude Code
/plugin marketplace add 9uiLe/plugins
/plugin install quality-architect@9uile-plugins

# Codex
codex plugin marketplace add 9uiLe/plugins
codex plugin add quality-architect@9uile-plugins
```

## リファレンス・ライブラリ

`references/` 配下に、ISO/IEC 25010:2023 の 9 特性を 1 ファイルずつ収録:

```
references/
├── 00-overview.md                  ← モデル全体・SQuaRE・2011→2023 差分・一次リファレンス
├── 01-functional-suitability.md    機能適合性
├── 02-performance-efficiency.md    性能効率性
├── 03-compatibility.md             互換性
├── 04-interaction-capability.md    相互作用性（旧: 使用性）
├── 05-reliability.md               信頼性
├── 06-security.md                  セキュリティ
├── 07-maintainability.md           保守性
├── 07a-coupling-deep-dive.md       結合の深掘り補論（Khononov 2024 — Integration Strength × Distance × Volatility / BALANCE / §6.3.1 削減アクション・カタログ）
├── 08-flexibility.md               柔軟性（旧: 移植性）
├── 09-safety.md                    安全性（2023 で新設）
└── static-evaluation.md            静的評価レイヤーの方法論
```

各ファイルの構成: **定義 → 副特性（調査観点・設計タクティクス・レビュー項目・計測指標）→ 横断戦略 → 重点チェックリスト → アンチパターン → リファレンス**。

## 静的評価レイヤー（AI の揺らぎ対策）

`quality-review` は、測れる指標を**実在の静的解析ツールに委譲して決定論的に確定**し（再現可能）、
LLM の判断は数値化できない残余に閉じ込めます。設計は 3 層:

- **① 何を測るか**（特性→指標）= `references/`（ISO/IEC 25010:2023 由来・言語非依存・共通）
- **② どう測るか**（指標→ツール/しきい値）= [`quality-gates.yml`](./quality-gates.yml)（**言語プロファイル**。ここだけ言語依存）
- **③ 判定**= スキルが数値としきい値を機械的に突き合わせ

言語差は ② のプロファイルに閉じ込めるため、**スキルもリファレンスも言語ごとに分けません**。
新言語は `quality-gates.yml` に profile を 1 つ追記するだけ。現在は **Swift** プロファイルを同梱
（SwiftLint / lizard / Periphery / swift-format / Trivy）。方法論は [`references/static-evaluation.md`](./references/static-evaluation.md)。

完全に決定論化したい場合は、ツール実行〜しきい値判定〜JSON 出力を行うラッパースクリプトを使う:

- [`scripts/quality-gate-swift.sh`](./scripts/quality-gate-swift.sh) — `quality-gate-result.json` を出力。スキルは数値を読むだけ。
- [`examples/ci/github-actions-swift-quality.yml`](./examples/ci/github-actions-swift-quality.yml) — CI でツールを走らせ結果を artifact 化（ローカルにツールが無くても揺らぎを排除）。

`quality-review` は CI 結果 JSON があれば最優先で採用し、無ければスクリプト、それも無ければ個別コマンドの順にフォールバックします。

### ツール導入とサプライチェーン

本プラグインは **静的解析ツールを自動インストールしません**。`quality-gates.yml` の `required_tools` は依存ツールの一覧であり、推奨インストール経路ではない点に注意してください。

- **未導入時の挙動**: 該当ツールが見つからない指標は `skipped` として報告され、判定はそのまま継続します（数値を捏造しません）。
- **third-party tap / 外部 formula**: `peripheryapp/periphery` のように homebrew-core 外のものは、tap の追加が formula 供給源を恒久的に増やすため、組織のセキュリティ方針に従って個別に承認してから導入してください。
- **CI で導入する場合**: バージョン pin・SHA 検証・キャッシュを推奨します。`examples/ci/` の YAML はあくまでサンプルで、本番では監査済みの導入方法に置き換えてください。
- **代替**: ローカル/CI で導入できない場合も、CI 側で JSON 結果のみを artifact として渡せばスキルは数値を読むだけで判定できます。

## 対象とする品質モデル

- 正典: **ISO/IEC 25010:2023（第2版）** — 9 特性 40 副特性（Safety 新設、Usability → Interaction Capability、Portability → Flexibility 等）。
- 旧 **2011 版（JIS X 25010:2013、8 特性）** との差分は各ファイルの注記と `00-overview.md` に記載。JIS 準拠が要件の場合は 2011 版構成を併用してください。

## ライセンス

MIT
