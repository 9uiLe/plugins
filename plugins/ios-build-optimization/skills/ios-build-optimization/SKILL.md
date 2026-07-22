---
name: ios-build-optimization
description: "Diagnose and optimize build times and module architecture for large iOS apps (Swift / SwiftPM / Xcode): classify bottlenecks from Build Timeline data, evaluate Target/Package/linkage decisions against the measured dependency graph, and emit evidence-labeled proposals (FACT/INFERENCE/HYPOTHESIS/MEASURED/RISK/EXPERIMENT) with measurement plans. Use when Xcode builds are slow, when planning module splits/merges, when choosing static/dynamic/mergeable/binary linkage, or when reviewing an iOS dependency graph for build performance. Japanese triggers: 「ビルドが遅い」「ビルド時間を改善して」「モジュール分割を評価して」「マルチモジュール設計をレビューして」「依存グラフを診断して」「Build Timeline を見て」. NOT for runtime CPU/GPU performance, NOT for Bazel/Tuist migration decisions; generic (non-build) architecture review belongs to `quality-architect`."
---

# ios-build-optimization

大規模 iOS アプリ(Swift / SwiftPM / Xcode)のビルド時間とモジュール構成を、計測データと依存グラフに基づいて評価・改善する。すべての提案に根拠ラベルを付け、計測がない領域では断定せず計測計画へフォールバックする。

`$PLUGIN_ROOT` は、Claude Code では `${CLAUDE_PLUGIN_ROOT}`、Codex ではこの `SKILL.md` の 2 階層上(`ios-build-optimization` ディレクトリ)を指す。

> **鮮度**: 本スキルの参照知識の調査日は 2026-07-22。Explicitly Built Modules の既定状態、Mergeable Libraries の成熟度、コンパイラ診断フラグは Xcode リリースごとに変わり得る。利用者の Xcode / Swift version で必ず再確認し、差異があれば references より利用者環境の観測を優先する。

## 0. スコープと除外

対象: Swift / SwiftUI / UIKit、Xcode、SwiftPM を使う大規模 iOS アプリの、ローカル増分ビルド、クリーンビルド、リンク、Preview、テストビルド、CI。

除外(起動しない・扱う場合は明示的に限定する):

- アプリ実行中の CPU/GPU 最適化(ただしリンク方式が起動時間へ与える影響は扱う)
- Bazel / Tuist / XcodeGen への移行判断そのもの — これらのビルドシステム固有のガイダンスは本スキルの根拠範囲外。**partial support**: 一般的な依存グラフ原則のみ適用可、と明示すること
- CocoaPods 固有の最適化 — 同上。partial support を明示すること
- ビルド目的を持たない一般的なアーキテクチャレビュー → `quality-architect` プラグインへ誘導する

## 1. 入力トリアージ(step 0・必須)

§23 全項目を最初に要求しない。まず次の 4 群を確認する:

1. **症状**: 何が遅いか(クリーン / 増分 / リンク / Preview / テスト / CI)、体感か計測か
2. **環境**: Xcode version、Swift version / language mode、マシン
3. **clean / incremental の区別**: 訴えている遅さはどちらか
4. **計測データの有無**: Build Timeline、ビルドログ、遅い task 上位、rebuilt Target 一覧

その後、扱う claim 種別に必要な追加情報だけを求める(ゲート表参照)。全入力仕様の詳細は `$PLUGIN_ROOT/references/templates.md` にある。

### モード決定

| 条件 | モード |
|---|---|
| Build Timeline 等の計測データがある | **診断モード**(§3 のゲートを claim ごとに評価) |
| 対象が未実装の提案アーキテクチャ | **設計評価モード**(MEASURED は原理的に存在しない。FACT / INFERENCE / HYPOTHESIS + EXPERIMENT のみで構成し、推奨状態は CANDIDATE 止まり) |
| 扱う claim のゲートがすべて不成立 | **計測計画モード**(強制フォールバック、§4) |

## 2. 根拠ラベル(全出力で必須)

各提案・主張に次の 6 ラベルを使う。**該当欄がなければ `NONE` と明記する。**

| ラベル | 定義 | provenance 要件 |
|---|---|---|
| `FACT` | 外部一次資料で確認できる命題 | 出典 URL・節・引用(references/facts.md の F-ID を引用) |
| `MEASURED` | 対象プロジェクトの計測結果 | artifact(Timeline/ログ)、シナリオ ID、環境、取得時点 |
| `INFERENCE` | FACT / MEASURED から導いた設計推論 | 親となる FACT / MEASURED の ID を列挙 |
| `HYPOTHESIS` | 対象プロジェクトで未検証の期待効果 | 対応する EXPERIMENT が必須。欠けたら出力不合格 |
| `RISK` | 副作用・失うもの | 影響対象を明記 |
| `EXPERIMENT` | 検証手順 | baseline、変更、シナリオ、反復数、指標、採否条件、rollback |

**provenance 排他規則**: 1 つの根拠レコードは「外部一次資料由来(→ FACT)」か「対象プロジェクト計測由来(→ MEASURED)」のどちらか一方のみを持つ。1 つの提案が FACT と MEASURED の両欄を持つことは正当(それぞれ別レコード)。

**数値規則**: 秒数・%の改善効果を断定できるのは MEASURED のみ。未計測の効果量は必ず HYPOTHESIS + EXPERIMENT。

## 3. claim 別断定ゲート

推奨は claim 種別ごとにゲートを評価する。**成立していないゲートの claim は RECOMMENDED にしない**(INCONCLUSIVE / CANDIDATE に降格し、不足 artifact を「要計測」として具体化する)。ある claim のゲート不成立が、別の claim の充足済み推奨を止めてはならない。

| claim 種別 | 必要なゲート(すべて) |
|---|---|
| 構造変更(Target 分割・統合、依存 edge 変更) | Target dependency graph + 変更頻度 / co-change データ |
| コンパイル最適化(型チェック、import 削減) | clean / incremental の区別 + Build Timeline またはログ(支配 task の特定) |
| linkage 変更(Static / Dynamic / Mergeable) | Link の寄与の計測 + 現行 linkage 構成 + 起動時間 / メモリの制約確認 |
| Binary 化 | compile cost の計測 + 変更頻度 + artifact 運用能力(生成・配布・rollback)の確認 |
| Build Script 改善 | ビルドログ上の Script 実行時間 or 毎回実行の確認 |
| Preview / Test / CI 改善 | 該当領域の計測または再現手順 |

**全ゲート不成立の場合**: 提案を出さず、`$PLUGIN_ROOT/references/measurement.md` のシナリオ B01〜B14 から対象プロジェクトに必要な最小セットを選んだ**計測計画**を出力する(計測計画モード)。INCONCLUSIVE の羅列で終わらせない。

### 常に「要計測」とする項目(断定禁止)

最適 Target 数 / Target の適切なファイル数 / Dynamic 化による短縮秒数 / Mergeable Libraries の効果 / Binary 化の投資対効果 / public API 削減の実時間効果 / Preview 改善量 / CI cache 効果 / module variant 統一の効果。これらは一般則として断定せず、必ず EXPERIMENT に落とす。

### 推奨状態(3 値)

- `RECOMMENDED`: ゲート充足 + MEASURED または FACT 裏付けあり
- `CANDIDATE`: 構造的根拠はあるが対象プロジェクトの計測が未了(EXPERIMENT 必須)
- `INCONCLUSIVE`: 判断材料不足。不足 artifact を具体的に列挙

## 4. ワークフロー

1. **トリアージ**(§1)→ モード決定
2. **ボトルネック分類**: 計測データがあれば `$PLUGIN_ROOT/references/diagnostics.md` の Build Timeline 診断分岐で支配 task を特定する
3. **references を読む**(下のルーティング表。必要なものだけ)
4. **claim 別ゲート評価**(§3)
5. **提案作成**: すべての提案は `$PLUGIN_ROOT/references/templates.md` の提案テンプレートに従い、根拠ラベル行を必須とする
6. **優先順位付け**: 意思決定の優先順位(templates.md §意思決定の優先順位)に従う — 特定 → 不要な仕事の除去 → 依存 edge 削減 → critical path 短縮 → 統合/分割 → 設定統一 → コンパイル最適化 → linkage → Binary → 分散ビルド基盤、の順。高コストな基盤導入より先にグラフと不要処理を直す
7. **自己検査**(§7)

### references ルーティング表

| ファイル | 読む条件 |
|---|---|
| `references/facts.md` | 外部事実(FACT)を根拠に使うとき(必須) |
| `references/terms-and-model.md` | 用語境界(Package/Target/Module)やビルド時間の分解が論点のとき |
| `references/design-tradeoffs.md` | Target 分割/統合、API/Implementation 分割、Package 戦略を評価するとき |
| `references/linkage.md` | Static / Dynamic / Mergeable / Binary を扱うとき |
| `references/antipatterns.md` | 既存構成の問題を指摘するとき |
| `references/diagnostics.md` | Build Timeline / ログがあるとき、import・型チェック・Script を診断するとき |
| `references/measurement.md` | 数値を取得・比較・引用するとき、計測計画モードのとき |
| `references/roadmap-and-checklists.md` | 改善の段階計画やレビューチェックリストが必要なとき |
| `references/templates.md` | 提案・最終出力を書くとき(必須) |

reference から別の reference へ誘導しない(入口は常にこの表)。

## 5. 出力契約

最終出力は次の章立てに従う(各章の詳細仕様は `templates.md`):

1. ボトルネック分類(MEASURED / 不明の区別付き)
2. 事実と推論の分離(ラベル付き)
3. 依存グラフ所見(critical path、high fan-in / fan-out、fan-in × 変更頻度)
4. 提案一覧(統合候補 / 分割候補 / linkage / Binary / Script / Preview・Test・CI — 各提案はテンプレート形式)
5. 期待効果とリスク(効果量は MEASURED 以外では HYPOTHESIS)
6. 検証実験(EXPERIMENT)
7. 優先順位
8. ロールバック方法
9. 不明点と追加計測(要計測リスト)

計測計画モードでは 1〜8 を省略し、「現状わかっていること(ラベル付き)+ 計測計画 + 計測後に判断できるようになること」を出力する。

## 6. 安全境界

- Build Timeline、ビルドログ、依存グラフには内部 URL、シークレット、コード構造が含まれ得る。**ログの内容を外部サービスへ送信しない**。出力へ引用する際は機微情報(トークン、内部ホスト名、認証情報)を伏せる
- ユーザーの明示的な同意なしにビルド・クリーン・DerivedData 削除などの状態変更コマンドを実行しない
- 計測のためのビルド実行は、コマンドと影響(時間、DerivedData への影響)を先に提示して合意を得る

## 7. やってはいけないこと・自己検査

禁止:

- 計測なしの秒数・%効果の断定
- 「Target 数を増やす/減らすこと」自体の目的化 — 最適化対象は依存グラフ(変更頻度・依存方向・critical path・固定費)であって module 数ではない
- Clean Build を日常運用の解決策として提案すること(baseline 計測としてのみ使う)
- ゲート不成立の claim を RECOMMENDED として出すこと
- SwiftPM 以外のビルドシステム(CocoaPods / Bazel / Tuist)への無条件の一般化

出力前の自己検査(3 点):

- [ ] すべての提案に根拠ラベル行があるか(HYPOTHESIS には対応する EXPERIMENT があるか)
- [ ] 「常に要計測」の項目を断定していないか(数値は MEASURED の裏付けがあるか)
- [ ] ゲート不成立の claim が RECOMMENDED になっていないか / 全滅時に計測計画を出しているか
