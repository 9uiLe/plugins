# 設計品質×ビルド性能のトレードオフと分割・統合基準

> 対応章: ベース調査文書 §5〜§9 | 支配的ラベル: INFERENCE(公式仕様とビルドモデルから導いた設計推論。断定には対象プロジェクトの MEASURED が必要)

## 1. 両方に有利な性質

| 性質 | 設計への効果 | ビルドへの効果 |
|---|---|---|
| 高凝集 | 変更理由を局所化 | 再コンパイル範囲を限定しやすい |
| 一方向依存 | 循環と責務混在を防止 | DAG を単純化し並列化しやすい |
| Feature 独立 | チームと機能を分離 | Feature 間の変更波及を抑える |
| 小さい public API | 結合を減らす | module interface と下流影響を抑えやすい |
| 安定した低レイヤー | 依存先の信頼性 | 高 fan-in module の再ビルドを減らす |
| 明示的な依存 | 隠れた結合を防ぐ | 不要 import・推移依存を削減しやすい |
| 小さい Composition Root | 生成と接続を局所化 | App Target への実装集中を避ける |

## 2. 衝突する可能性がある性質

| 施策 | 得られるもの | 失う可能性があるもの |
|---|---|---|
| Target の大量分割 | 変更境界、並列性 | module 固定費、設定の単純さ |
| API/Implementation 分割 | 依存逆転、差し替え | Target 数、Protocol 過剰、追跡容易性 |
| Dynamic 化 | 反復リンクの短縮 | 起動時間、メモリ、埋め込み管理 |
| Binary 化 | ソースコンパイル削減 | デバッグ性、即時変更、配布運用 |
| 巨大 Target への統合 | module 固定費削減 | 変更波及、並列性、可視性境界 |
| 巨大 Common への共通化 | 重複削減 | 高 fan-in、高変更波及、責務混在 |
| 深い Clean Architecture Target | レイヤー境界 | 直列クリティカルパス |

## 3. 重要な推論(明示的に INFERENCE)

- **推論 A**: 「一緒に変わるものは一緒にビルドする」— 常に同時変更されるコードを別 Target に分けても、毎回両方が再ビルドされ境界固定費だけが増え得る。
- **推論 B**: 「高 fan-in × 高変更頻度」は最悪の組み合わせ — 設計上の不安定な中心であり、増分ビルドの広い無効化点。
- **推論 C**: Feature 数と Target 数を一致させる必要はない。
- **推論 D**: Package 境界(所有権・配布・バージョニング)と Target 境界(コンパイル・可視性・依存方向)を分けて考える。

## 4. 推奨依存アーキテクチャ(開始点であり唯一の正解ではない)

```text
App / Composition Root(DI, root navigation, lifecycle)
  → FeatureA / FeatureB / FeatureC(相互に直接依存しない)
    → Stable Contracts / Domain
      → NetworkAPI / StorageAPI / AnalyticsAPI
        ←(実装)NetworkLive / StorageLive / AnalyticsLive(App 側で注入)
```

ルール: Feature から別 Feature の実装を直接 import しない / 画面遷移は App Composition・Router 等で仲介 / Live 実装の生成は App 側 / Shared module を「どこからでも使える場所」にしない / TestSupport・PreviewSupport・Fixtures を Production graph へ入れない / public 宣言を最小化 / `@_exported import` は原則禁止または例外管理。

## 5. Target 分割の判断基準

**分割候補**(複数満たす場合に検討): 一部だけ変更頻度が高い / 独立して変更される領域がある / 多数の利用者が必要な API と重い実装が混在 / 実装詳細を隠したい / 単独でテスト・Preview したい / 別チーム所有 / Binary 化候補 / 依存禁止にコンパイラ境界が必要 / 別アプリ・Extension で再利用。

**統合候補**(複数満たす場合に検討): 常に一緒に変更される / 常に一緒に利用される / 一方が他方以外から使われない / 境界の public API が実装詳細の漏出になっている / 直列チェーンを形成 / 1 Target あたりのコードが非常に少なく固定費の方が大きい / API/Impl 分割に差し替え価値がない / Manifest 管理が主要コスト化。

**分割してはいけない理由**(これだけでは Target を作らない): ディレクトリを分けたい / レイヤー名が違う / Protocol が 1 つある / 画面が 1 つ増えた / ファイル数が閾値を超えた / 「マルチモジュールの方が良い」とされている / 将来使うかもしれない / 一覧が対称形になる。

## 6. API Target / Implementation Target

有効なケース(`NetworkingAPI` / `NetworkingLive` / `NetworkingMock`): 多数の Feature が API へ依存 / 実装のコンパイルコストが高い / 実装差し替えが現実に存在 / テストで Mock が必要 / API と実装の変更頻度が異なる / チーム所有権が異なる。

過剰なケース: すべての小さな責務を `FooAPI / FooImplementation / FooMocks / FooFixtures / FooPreviewSupport / FooTestSupport / FooResources` に分けると、module 固定費、public API 増加、Protocol/Factory 増加、依存宣言の追跡コスト、manifest 複雑化を招く。

判断スコア(**比較用ヒューリスティック。絶対評価に使わない**):

```text
Benefit = Fan-in + 実装コンパイルコスト + 差し替え必要性 + 所有権分離 + API 安定性 + Binary cache 可能性
Cost    = Target 固定費 + public API コスト + Protocol/Factory 複雑性 + デバッグコスト + Manifest 保守
```

Benefit が Cost を明確に上回る場合にだけ採用する。

## 7. Package 分割戦略

**Local Package** の用途: `.xcodeproj` からの Target 定義分離、project.pbxproj 競合削減、領域単位の所有権、独立テスト。注意: Local Package 化だけでは Target 内部のコンパイルは速くならない(F1)。

**Remote Package / 別リポジトリ** が適する: 複数プロダクトが本当に共有 / 独立リリースが必要 / API 互換性を契約として維持 / 別チームが独立所有。適さない: 単一アプリで常に同時変更 / Feature 開発に複数リポジトリ PR が必要になる / version 更新待ちが編集ループを妨げる。

**Monorepo 推奨**(INFERENCE、運用コストと変更容易性から): 大規模単一アプリでは原則 Monorepo 内の複数 Local Package から開始。原子的変更、同一 PR での Package 間変更、Binary 化前の変更頻度観測、依存グラフの横断解析が可能。
