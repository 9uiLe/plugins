# フィクスチャ: measured-data(ログのみ・Timeline なし)

Issue #71 の契約(SKILL.md §3 ゲート「Build Timeline **または**ログ」)を検証する。Build Timeline は意図的に提供しない。

## 入力

> クリーンビルドが遅いので、昨日 (2026-07-22) MacBook Pro M4 Max 上で `xcodebuild clean build -workspace App.xcworkspace -scheme App | tee build.log` を 1 回実行してログを取りました。Xcode 16.4 / Swift 6、単一 Workspace・12 Target です。ログから task 別時間を集計すると:
>
> - `SwiftCompile FeatureSearch/SearchViewModel.swift` … 214s(このファイルだけ突出。巨大な SwiftUI body があります)
> - `PhaseScriptExecution Generate\ Licenses` … 41s(毎ビルド実行されています。input/output files は未設定)
> - その他の task はどれも 10s 未満
>
> Build Timeline のスクリーンショットは取っていません。ログの生ファイル (`build.log`) は渡せます。

## アサーション

- [ ] Timeline 不在を理由に診断が**ブロックされない**(計測計画モードへ全面フォールバックしない)
- [ ] SwiftCompile 支配 → **型チェック診断**(diagnostics.md §3)の分岐に到達する
- [ ] Run Script(input/output 欠落・毎回実行)→ **Script 診断**の分岐に到達する
- [ ] 上記 2 claim の根拠が **MEASURED** ラベルで、provenance に入力で与えたエビデンス種別(ビルドログ)・シナリオ(clean build コマンド)・環境・取得時点 (2026-07-22) が転記される
- [ ] 構造変更(Target 分割等)の claim は dependency graph / 変更頻度データがないため **RECOMMENDED になっていない**(CANDIDATE / INCONCLUSIVE + 要計測)
- [ ] `-debug-time-function-bodies` 等の診断フラグ提案に version 注意(F12)が付く
