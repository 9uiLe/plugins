# Common / Shared module の扱いとアンチパターン

> 対応章: ベース調査文書 §11・§19 | 支配的ラベル: INFERENCE(既知の失敗パターン。個別プロジェクトへの適用は依存グラフと変更履歴の確認後)

## 1. 巨大 Common の問題

`Common`(Extensions / Models / Networking / Analytics / UI / Logging / Persistence / FeatureUtilities が同居)は、高 fan-in × 高変更頻度 × public API 肥大 × 変更理由複数 × 広い再ビルド範囲、の複合問題になる。

改善: 「共通だからまとめる」ではなく安定性と責務で分ける — `DomainPrimitives` / `DesignTokens` / `LoggingAPI` / `AnalyticsAPI` / `FoundationExtensions` 等。ただし細分化しすぎない。`FoundationExtensions` のような module は無制限に拡張を受け入れない。

共通化の導入条件: 2 箇所で似ているだけでは共通化しない / 変更理由と意味が同じか確認 / 共通化後の fan-in と変更頻度を予測 / Feature 固有概念を汎用名へ偽装しない / SharedUI は利用実績が出てから抽出。

## 2. アンチパターン集

### Package-per-Target
Manifest 増加、Product 経由依存の増加、Target 再配置の負担。**コンパイル単位自体は変わらない場合が多い**(F1)。

### Layer-per-Target
`FeaturePresentation / FeatureApplication / FeatureDomain / FeatureData / FeatureInfrastructure` — 深い直列グラフ、public API 増加、Feature 変更が全レイヤーを跨ぐ、常に一緒に変わる Target の固定費。

### Feature-to-Feature import
Feature 独立性の喪失、横方向 edge の増加、循環回避のための Common 化、App Composition の責務不明。

### 巨大 SharedModel
全 Feature が同じ model へ依存し、API レスポンス変更が UI へ波及。改善: Transport model / Domain model / Feature presentation model を必要な境界で変換する。ただし全レイヤーを必ず別 Target にしない。

### Umbrella / Re-export
import が簡単になる代わりに実依存が隠れ、Emit Module が扱う依存が増え(F5)、unused dependency の除去が困難になる。

### すべて Dynamic
ソースコンパイル問題を解決しない(F7)。起動とメモリへコスト移転、埋め込み・署名・Bundle lookup の複雑化。

### すべて Binary
Feature 開発の変更待ち、Source/Binary 不一致、デバッグ不能、Xcode/Swift 更新対応、CI artifact 生成が新しい critical path になる。

### 毎回 Clean Build
増分ビルドの問題を隠し、開発者の通常体験を悪化させ、cache を捨てる。**Clean Build は baseline 計測としてのみ使い、日常運用の解決策として提案しない。**

## 3. Import 最適化の確認項目

- 各ファイルが本当に必要な module だけを import しているか
- Umbrella module が大量の module を re-export していないか / `@_exported import` を利用していないか
- Test Target がアプリ全体を `@testable import` していないか
- Feature が Live 実装を直接 import していないか
- Utility のためだけに巨大 module へ依存していないか
- ObjC bridging header が広すぎないか / module map・header search path が Target ごとに不統一でないか

公開 API で抑える対象: public class/struct/protocol、public generic type、public Result Builder、`@inlinable`、`@usableFromInline`、implementation type の露出、concrete dependency の公開、public extension。

> **注意**: 「public API を小さくすると必ず何秒短縮する」という一般則はない。効果は module、import graph、コンパイラ version に依存するため計測する(HYPOTHESIS + EXPERIMENT)。
