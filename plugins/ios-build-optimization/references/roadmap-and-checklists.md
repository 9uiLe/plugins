# 改善ロードマップ・推奨デフォルト・レビューチェックリスト

> 対応章: ベース調査文書 §20〜§22・§27 | 支配的ラベル: INFERENCE(推奨順序・開始点。個別の適用は計測とゲート充足が前提)

## 1. 意思決定の優先順位

1. 何が遅いかを特定
2. 不要な仕事を除去
3. 依存 edge を減らす
4. critical path を浅くする
5. Target を統合または分割
6. 設定を統一して module reuse を増やす
7. ソースコンパイルを最適化
8. linkage を変える
9. Binary 化する
10. 分散ビルド・大規模キャッシュ基盤を導入

**高コストな基盤導入より先に、グラフと不要処理を直す。**

## 2. 改善ロードマップ

- **Phase 0 — Baseline 固定**: Xcode/Swift/マシン/設定を記録、代表シナリオ計測、Build Timeline 保存、Target dependency graph 抽出、Git co-change 集計
- **Phase 1 — 無駄な仕事を削減**: 毎回実行 Script の修正、input/output 定義、不要 import 削除、Umbrella/re-export 削減、Test/Preview dependency 削減、Target ごとの設定差統一、不要な Clean 運用の停止
- **Phase 2 — Graph 修正**: Feature-to-Feature 依存を App Composition へ、巨大 Common を安定責務で分割、深い layer chain を統合、高 fan-in × 高変更 module を再設計、常時 co-change Target を統合
- **Phase 3 — Compile 最適化**: 遅い file/expression を診断、巨大 SwiftUI body を分割、自動生成コードを隔離、macro/plugin コストを測る、public API 面積を見直す
- **Phase 4 — Link 最適化**: Static/Dynamic 比較、Mergeable Libraries の PoC、Framework embed/sign 時間確認、App launch と Memory も同時評価
- **Phase 5 — Artifact Cache / Binary**: 安定・高コスト Target を選定、XCFramework 生成、revision/checksum 管理、dSYM・symbolication、Debug 用 source 版への切替手段、rollback 手順
- **Phase 6 — 継続的ガード**: CI で Build Benchmark、Target graph diff、新規 dependency edge のレビュー、高 fan-in module 変更アラート、build time regression threshold、Package/Target 追加時の理由記録

## 3. 推奨デフォルト(大規模単一 iOS アプリの開始点)

Monorepo / 少数の Local Package / Feature または意味のある技術境界ごとの Target / Feature 間直接依存なし / App は Composition Root / Stable API と Live Implementation は必要な場所だけ分割 / Common 禁止または厳格な責務制限 / Product linkage は原則未指定(F9)/ Debug は通常の incremental build / Mergeable Libraries は Framework 構成で PoC / Binary Target は安定・高コスト領域だけ / TestSupport・PreviewSupport は Production graph から分離 / Build Script input/output を完全宣言 / Build Timeline と Git co-change を継続取得。

## 4. レビューチェックリスト

### 新しい Target を追加するとき
- [ ] 変更理由が既存 Target と異なる
- [ ] 単独で変更・テストされる
- [ ] 依存方向が明確 / public API が小さい
- [ ] 深い直列チェーン・Feature-to-Feature 依存を作らない
- [ ] 常時 co-change する Target ではない
- [ ] build setting 差で不要な module variant を作らない
- [ ] 追加前後の build benchmark がある

### 新しい Package を追加するとき
- [ ] Target 追加だけでは不足する理由がある
- [ ] 所有権・配布・再利用・version 境界のどれかがある
- [ ] Local/Remote の選択理由がある / atomic change を阻害しない
- [ ] Product 数が過剰でない

### Binary 化するとき
- [ ] compile cost が計測済み / API が安定 / 変更頻度が低い
- [ ] source fallback・dSYM/symbolication・revision/checksum 追跡がある
- [ ] Xcode/Swift 更新時の再生成と rollback がある
- [ ] `BUILD_LIBRARY_FOR_DISTRIBUTION` の必要性を個別判断(F11)

### Dynamic/Mergeable 化するとき
- [ ] Link がボトルネックだと計測済み
- [ ] Debug build / Release archive / App launch / Memory / embed・sign を比較
- [ ] Bundle・runtime lookup と App Extension を確認

## 5. 未確定・プロジェクト依存の論点(一律の正解を出さない)

最適な Target 数 / Feature Target の最大サイズ / Local Package 数 / Static・Dynamic の最適比率 / Mergeable の効果量 / Binary 化対象 / DesignSystem の分割 / Domain module の粒度 / API・Implementation 分割の適用範囲 / Test Target の粒度 / Resource Bundle 数 / macro・code generation の許容コスト。

これらは対象プロジェクトの Build Timeline、依存グラフ、Git 履歴、開発者ワークフローから決める。
