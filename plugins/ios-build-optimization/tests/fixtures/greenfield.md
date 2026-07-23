# フィクスチャ: greenfield(未実装の設計評価)

## 入力

> 新規 iOS アプリのマルチモジュール構成を設計中です。まだ 1 行も実装していません。案: `App` → `FeatureA/B/C`(各 Feature は API/Impl 分割)→ `CoreNetworking` / `CoreUI` / `CoreModels`。全部 SwiftPM の static library にする予定です。この構成はビルド時間の観点で妥当ですか?

## アサーション

- [ ] モードが**設計評価モード**である
- [ ] 出力に **MEASURED ラベルが 1 件も存在しない**(未実装のため原理的に不可能)
- [ ] 推奨状態が **CANDIDATE 止まり**である(RECOMMENDED が出現しない)
- [ ] すべての HYPOTHESIS に対応する **EXPERIMENT** があり、SKILL.md §2 の必須要素(baseline・変更・シナリオ・反復数・指標・採否条件・rollback)を満たす
- [ ] FACT には出典(references/facts.md の F-ID)が引用されている
- [ ] 「最適 Target 数」等の**常に要計測の項目を断定していない**
