# 入力仕様・出力仕様・提案テンプレート

> 対応章: ベース調査文書 §23・§24・§26 | 提案・最終出力を書くときに必ず読む

## 1. 入力仕様(全量。トリアージでは 4 群から段階的に収集する)

**プロジェクト情報**: Xcode version / Swift version・language mode / Deployment target / UIKit・SwiftUI / `.xcodeproj`・`.xcworkspace` / SwiftPM・CocoaPods・internal framework / Monorepo・multi-repo / Target 数・Package 数 / App Extension 数 / CI 環境

**性能情報**: Clean Build / Incremental Build / Link / Preview / Test / Archive / Build Timeline / Build log / 遅い task 上位 / rebuilt Target / CPU 利用率 / キャッシュ状態

**構造情報**: Target dependency graph / import graph / Product graph / Static・Dynamic 構成 / public API / Build Scripts / Resource Bundles / Target 別 build settings / module variant

**変更履歴**: Target 別変更頻度 / co-change / ownership / Feature release cadence / API 変更頻度 / Binary 候補の安定期間

## 2. 出力仕様(18 項目)

1. 現状のボトルネック分類 2. 事実と推論の分離 3. 依存グラフ上の critical path 4. high fan-in / high fan-out 5. high fan-in × high-change Target 6. 統合候補 7. 分割候補 8. Package 移動候補 9. API/Implementation 分割候補 10. Dynamic/Mergeable/Binary 候補 11. Build Script 改善 12. Preview/Test/CI 改善 13. 期待効果 14. リスク 15. 検証実験 16. 優先順位 17. ロールバック方法 18. 不明点と追加計測

該当がない項目は省略してよいが、13〜18 は提案が 1 件でもあれば必須。

## 3. 提案テンプレート(全提案で必須)

```markdown
## 提案: <タイトル>(状態: RECOMMENDED / CANDIDATE / INCONCLUSIVE)

### 根拠(該当なしの欄は NONE と明記)
- FACT: <facts.md の F-ID + 要旨> / NONE
- MEASURED: <artifact・シナリオ ID・環境・取得時点> / NONE
- INFERENCE: <親 FACT/MEASURED の ID を列挙> / NONE
- HYPOTHESIS: <未検証の期待効果。ある場合 EXPERIMENT 必須> / NONE

### 現状
- <対象の fan-in / compile time / 変更頻度など、判断に使った観測>

### 変更
- <新規/統合 Target、依存 edge、public API、Composition Root への影響>

### 期待効果
- <再ビルド範囲・並列性・テスト・所有権。数値は MEASURED 以外では書かない>

### リスク(RISK)
- <Target 固定費、Protocol/Factory 増加、デバッグ、起動時間、manifest 管理など>

### 実験(EXPERIMENT — HYPOTHESIS がある場合は必須)
1. branch を作る
2. 代表シナリオ(例: B02/B04/B11)を各 5 回以上測る
3. median を比較する(p90 の扱いは measurement.md §3)
4. linkage 変更なら App launch と memory も比較する
5. 改善が採否条件未満なら戻す

### 採否条件
- <利用者と合意した閾値。合意がなければ「未確定(要合意)」と書く。スキルが数値を捏造しない>
```

## 4. 計測計画モードの出力形式

```markdown
## 現状わかっていること
- <ラベル付きの観測・推論のみ。推奨は出さない>

## 計測計画
- 対象シナリオ: <B01〜B14 から claim に必要な最小セット>
- 各シナリオの手順・記録項目(measurement.md §1〜§2)
- 反復数と指標(median 主指標)

## 計測後に判断できるようになること
- <どの claim 種別のゲートが開くか>
```
