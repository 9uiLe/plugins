# 用語境界とビルド時間の分解モデル

> 対応章: ベース調査文書 §3・§4 | 本ファイルの支配的ラベル: INFERENCE(F1〜F4 に基づく設計推論。対象プロジェクトで MEASURED になるまで断定しない)

## 1. 用語と境界

| 単位 | 主な責務 | 注意 |
|---|---|---|
| **Package** | Manifest による Target/Product 定義、外部依存の宣言と解決、配布・再利用・バージョニング、所有権の境界 | Package へ切り出すこと自体はコンパイル粒度を小さくしない(F1) |
| **Target** | ソースと Resource の所属、Swift module の生成、直接依存の宣言、build setting の適用単位 | ビルド性能と依存設計を考える中心単位 |
| **Module** | `import` 可能な名前空間、public/internal の可視性境界、他 module への依存 edge | SPM Target と多くの場合対応するが Product/Framework と混同しない |
| **Product** | Package 外から利用可能な artifact をまとめる単位(1 つ以上の Target) | Package 間依存は Product 経由になる |
| **Framework / Library** | linkage と配布形式の単位 | モジュール設計の境界と常に一致させる必要はない |
| **Binary Target** | ビルド済み artifact を利用する Target | ソースコンパイルを外せるが運用コストを別の場所へ移す |

## 2. ビルド時間の分解モデル

ビルド時間を単一の数値として扱わない。

```text
Developer Feedback Time
  = Dependency resolution + Build graph evaluation
  + Module scanning + Module emission / compilation
  + Swift source compilation + C/ObjC compilation
  + Resource processing + Code generation / Build Scripts
  + Static linking + Dynamic framework embedding
  + Code signing + Install + App / Preview launch
  + Test discovery and execution
```

概念的には:

```text
Build Duration ≈ Critical Path of Build DAG
  + Non-parallelizable Work + Cache Miss Cost
  + Process / Module Fixed Overhead + Link and Packaging Cost
```

これは厳密な数式ではなく、調査項目を漏らさないためのモデルである。

## 3. グラフ特性

### クリティカルパス

並列実行できる総仕事量が多くても、最も長い依存チェーンが全体時間を決める(F2)。レイヤーごとの Target 分割(App → Feature → Presentation → Application → Domain → Data → Infrastructure → Common)は設計図として整っていても、ビルドグラフでは深い直列チェーンになる。

### Fan-in(被依存数)

高 fan-in module の例: DomainPrimitives、DesignTokens、LoggingAPI、NetworkingAPI、SharedModel、Common。高 fan-in module が頻繁に変わると影響範囲が広い。**fan-in × 変更頻度が高い module は増分ビルドの広い無効化点**(最重要指標)。

### Fan-out(依存数)

1 Target が多数の Target へ依存する度合い。module emission、依存解決、認知負荷が増えやすい。Feature Target が多数の基盤・他 Feature・Utility を直接 import する構成を疑う。

### Module の固定費

Target を分けると変更範囲を狭められる一方、module scan / emission、interface 読み込み、build setting 評価、process 調整、Test Target、Resource Bundle、リンク・埋め込み、Manifest 管理の固定費が増える。**分割粒度には最適点があり、無限に細かくするのは逆効果になり得る。**

## 4. 依存グラフ評価指標

構造指標: Target 数 / Package 数 / Product 数 / direct・transitive edge 数 / 最大・平均深さ / critical path 上の Target / fan-in・fan-out 上位 / 循環 / Feature-to-Feature edge 数 / public symbol 数 / import module 数 / module variant 数。

変更指標(Git 履歴から): Target 別変更頻度 / Target 間 co-change 率 / public API 変更頻度 / 高 fan-in module の変更頻度 / Binary 候補の安定期間。

組み合わせ指標(**比較用ヒューリスティック。単位・正規化・重みを持たない概念式であり、絶対スコアやプロジェクト間比較に使わない。順位付けの HYPOTHESIS 生成にのみ使う**):

```text
Instability Risk(module) = FanIn × ChangeFrequency        # 高いほど多数へ頻繁に影響
Split Waste(A, B) = CoChangeRate × 排他性欠如 × 境界固定費   # 常に一緒に変わる Target は統合候補
Binary Suitability = CompileCost × APIStability × ReuseCount × DebugIndependence ÷ ChangeFrequency
```
