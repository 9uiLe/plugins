# quality-architect

ISO/IEC 25010:2023 の製品品質モデルを使って、ソフトウェアのアーキテクチャ設計と既存コードのレビューを行う Claude Code / Codex プラグインです。

9 特性・40 副特性を共通言語として、設計案のトレードオフやコードの品質上の問題を整理します。特性ごとの調査観点、設計手法、計測指標、学術論文・公式文書への参照を同梱しています。

## インストール

Claude Code の会話内:

```text
/plugin marketplace add 9uiLe/plugins
/plugin install quality-architect@9uile-plugins

```

Codex 用のターミナルコマンド:

```bash
codex plugin marketplace add 9uiLe/plugins
codex plugin add quality-architect@9uile-plugins
```

## 使い方

依頼の対象に応じて、次のスキルが起動します。

| Skill | 対象と成果 |
| --- | --- |
| `quality-architecture` | 新規・提案中の設計。要件から重点品質特性を選び、設計案、トレードオフ、検証計画を根拠付きでまとめます。 |
| `quality-review` | 既存コード、差分、PR、リポジトリ。設計の妥当性と実装上の問題を評価し、測定結果、重大度付き指摘、品質スコアカードを出力します。 |

```text
品質特性を踏まえて、このサービスのアーキテクチャを設計して
このコードを ISO/IEC 25010 でレビューして
この PR の設計は妥当か評価して
```

既存コードの「設計レビュー」は `quality-review` が担当します。その結果、置換アーキテクチャの新規設計が必要になった場合は `quality-architecture` につなぎます。

## 設計の進め方

`quality-architecture` は、対象と制約を確認し、要件に応じて品質特性を優先付けします。重点特性に対応する資料から設計手法を選び、候補案の利点とトレードオフを比較します。

成果物には、推奨する構成、判断の根拠、検証方法、未決事項を含めます。モジュールやサービスの境界を新しく定義する場合は、依存の強さ・距離・変化の頻度も検討します。設計段階の文献値は参考値として扱い、対象コードの実測値とは区別します。

## レビューの進め方

`quality-review` は、対象未指定なら現在の差分を対象にします。対象言語と利用可能な解析資産を確認し、個別の欠陥に先立って設計判断、境界、依存方向、制約との整合を評価します。

品質モデルの 9 特性を「精査対象」または「該当薄」に分類し、必要な特性・副特性を詳しく調べます。実行に影響しない文書や typo などの軽微な差分には軽量フォーマットを使えます。

指摘には、重大度、設計上の問題か実装上の問題か、箇所、推奨、根拠リファレンスを付けます。差分・PR レビューでは、リポジトリ全体の測定で見つかった問題にも「差分起因」「既存」「不明」の帰属を示します。

### 静的解析と判定

測れる指標は先に静的解析ツールで測定し、測定値・しきい値・判定を、数値化できない考察と分けて報告します。設定は [`quality-gates.yml`](./quality-gates.yml)、方法論は[静的評価の資料](./references/static-evaluation.md)にあります。

解析結果は次の優先順で利用します。

1. 既存の `quality-gate-result.json`。鮮度・commit・対象範囲を確認して採否を決めます。
2. 対象言語のラッパースクリプト。
3. 利用可能な解析ツールの個別実行。

対象プロジェクトにしきい値の設定があれば、同梱の既定値より優先します。対応する言語プロファイルが無い場合は、利用可能な言語横断ツールの実測値を `measured-only` として報告し、未定義のしきい値で合否を作りません。実行できない指標は `skipped`、全指標が未実行なら総合判定は `inconclusive`（判定不能）になります。

### Swift 向けの解析資産

Swift プロファイルには SwiftLint、lizard、Periphery、swift-format、Swift のテストカバレッジ、Trivy の設定を同梱しています。新しい言語の指標・ツール・しきい値は `quality-gates.yml` のプロファイルに追加できます。

- [`quality-gate-swift.sh`](./scripts/quality-gate-swift.sh): ツールを実行し、しきい値判定を含む `quality-gate-result.json` を出力します。
- [GitHub Actions のサンプル](./examples/ci/github-actions-swift-quality.yml): CI で解析を実行し、結果を artifact として保存します。

プラグインは解析ツールを自動インストールしません。`quality-gates.yml` の `required_tools` は依存ツールの一覧です。外部 Homebrew tap などの導入は組織の方針に従い、CI のサンプルも本番環境に合う導入方法へ調整してください。ビルド・テスト・ネットワーク利用を伴う実行は、既存の許可または実行確認に基づいて進めます。

### 任意の結合シグナル解析

[`coupling-gate-swift.sh`](./scripts/coupling-gate-swift.sh) は、モジュール間の結合を調べる実験的な機能です。既定では無効で、`coupling-gate-result.json` を採用するか、明示的にスクリプトを実行した場合に使います。

結果は考察への補足として扱い、既存の合否を反転したり、重大度を上げたりしません。適用条件と統合方法は[結合シグナルのレビュー統合](./references/07a-review-integration.md)を参照してください。

## 参照資料

| 資料 | 内容 |
| --- | --- |
| [品質モデルの概要](./references/00-overview.md) | 特性一覧、版の違い、共通規律、一次資料 |
| [機能適合性](./references/01-functional-suitability.md) | 要求する機能の完全性、正確性、適切性 |
| [性能効率性](./references/02-performance-efficiency.md) | 応答時間、資源利用、容量 |
| [互換性](./references/03-compatibility.md) | 共存と相互運用 |
| [相互作用性](./references/04-interaction-capability.md) | 利用者とシステムのやり取り |
| [信頼性](./references/05-reliability.md) | 可用性、障害への耐性、回復 |
| [セキュリティ](./references/06-security.md) | 情報とアクセスの保護 |
| [保守性](./references/07-maintainability.md) | 解析、変更、テストのしやすさ |
| [結合の深掘り](./references/07a-coupling-deep-dive.md) | 依存の強さ・距離・変化の頻度、境界設計、削減手法 |
| [結合シグナルのレビュー統合](./references/07a-review-integration.md) | 実験的な解析結果の適用条件と扱い |
| [柔軟性](./references/08-flexibility.md) | 適応、拡張、導入、置換 |
| [安全性](./references/09-safety.md) | 危害につながるリスクの低減 |
| [静的評価](./references/static-evaluation.md) | 指標、ツール、しきい値、判定の分離 |

基本モデルは ISO/IEC 25010:2023 です。2011 版（JIS X 25010:2013）を要件とする場合は依頼で明示してください。版の差異は概要と各特性の資料に記載しています。

## ライセンス

MIT
