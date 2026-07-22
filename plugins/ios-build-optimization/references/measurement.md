# 計測プロトコル(シナリオ・記録項目・統計規律)

> 対応章: ベース調査文書 §16 | 支配的ラベル: 手順(計測プロトコル)。数値を取得・比較・引用するとき、および計測計画モードの出力を作るときに必ず読む

## 1. 計測シナリオ

計測計画では、扱う claim に関係するシナリオだけを選ぶ(全部を要求しない)。

| ID | シナリオ | 目的 |
|---|---|---|
| B01 | DerivedData あり・変更なし build | 不要再実行の検出 |
| B02 | Feature 内部実装を 1 行変更 | 通常増分 |
| B03 | Feature の internal model 変更 | Feature 内波及 |
| B04 | Feature の public API 変更 | 下流波及 |
| B05 | 高 fan-in Core API 変更 | 最大波及 |
| B06 | SwiftUI View 変更 | UI 編集ループ |
| B07 | Resource 1 件変更 | Asset 処理 |
| B08 | App Composition 変更 | Link 中心の編集 |
| B09 | Test 1 件変更・1 件実行 | Test feedback |
| B10 | SwiftUI Preview 更新 | Preview feedback |
| B11 | Clean Build | 総仕事量(baseline のみ。日常運用の指標にしない) |
| B12 | CI cold build | キャッシュなし CI |
| B13 | CI warm build | キャッシュ効果 |
| B14 | Release archive | 最適化・署名・配布 |

claim 種別との対応の目安: 構造変更 → B02/B04/B05/B11、コンパイル → B02/B06、linkage → B08/B11/B14 + App launch/Memory、Binary 化 → B02/B11/B12、Script → B01/B02、Preview → B10、CI → B12/B13。

## 2. 記録項目

環境: Xcode version / Swift version・language mode / macOS version / マシン(CPU・RAM)/ simulator・device / configuration / clean・warm / DerivedData 状態 / Package cache 状態。

結果: wall-clock / critical path / CPU 利用率 / peak memory / SwiftCompile / EmitSwiftModule・CompileModule / ScanDependencies / Link / Run Script / Asset processing / Embed Framework / CodeSign / changed file / rebuilt Target 一覧 / cache hit・miss / module variant 数。

## 3. 統計規律

- 単発結果を採用しない。warm-up を実施し、同一マシン・同一条件で測る
- **median を主指標とする。予備計測は 5 回以上**
- **tail 指標(p90)の注意**: n=5 では p90 がほぼ最大値と一致し、安定した tail 指標にならない。5 回計測は median の予備計測に限定し、p90 を報告する場合の反復数は計測計画で別に決める(それまでは「最大値」として報告する)
- 外れ値の理由を記録する
- Xcode update 前後で再 baseline を取る

## 4. 比較実験の設計(EXPERIMENT の必須要素)

1. baseline(現状)の対象シナリオを 5 回以上計測し median を記録
2. 変更(branch 上で)を適用
3. 同一条件で同じシナリオを計測
4. median を比較(App launch・Memory が関係する変更では同時に取得)
5. **採否条件(閾値)はスキルが捏造しない**。利用者の SLO または baseline の分散から利用者と合意する。合意できない場合は「閾値未確定」のまま出す
6. 改善が閾値未満なら戻す(rollback 手順を実験に含める)
