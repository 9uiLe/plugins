# Build Timeline 診断分岐とコンパイル・Script 診断

> 対応章: ベース調査文書 §12〜§14・§17 | 支配的ラベル: 手順(診断プロトコル)。分岐先の解釈は INFERENCE

## 1. Build Timeline 診断分岐(入口)

Build Timeline で最大時間の task を特定してから分岐する。**Timeline なしで下の分岐へ進まない。**

```text
Start: Build Timeline で最大時間の task を特定
 ├─ SwiftCompile
 │    ├─ 特定 file/expression が遅い → §3 型チェック診断
 │    └─ 多数 file が再 build → incremental dependency を調査(不要な広い無効化)
 ├─ EmitSwiftModule / CompileModule
 │    → import 過多(F5) / high fan-out / public interface 肥大 / module variant・setting 差(F4)
 ├─ Long idle / low CPU
 │    → 深い Target chain(F2) / script による直列化(F6) / unresolved dependency edge
 ├─ Link
 │    → Static library 数 / app target 肥大 / Dynamic・Mergeable の検証(linkage.md) / exported symbols
 ├─ Run Script
 │    → 毎 build 実行 / input・output 欠落(F6) / 重複実行 / 編集ループ外へ移動(§4)
 ├─ ProcessXCFramework / Embed / CodeSign
 │    → Framework 数 / Binary artifact / signing configuration
 └─ Resource
      → Asset Catalog 巨大 / Resource Bundle 数 / 重複処理
```

## 2. Import・module emission 診断

確認項目は `antipatterns.md` §3。「Target 分割数を増やす」より先に依存 edge を削る(F5)。「分割したのに速くならない」場合は module emission と import graph を確認する。

## 3. Swift ソースの型チェック診断

疑う対象: 巨大な SwiftUI `body`、深い View Builder、長い operator chain、複雑な generic constraints、overload 候補が多い式、型が曖昧な `.init`、巨大 Dictionary/Array literal、複雑な closure chain、Result Builder 内の多重条件、macro 展開、大量の自動生成 Swift。

診断オプション(**F12 の version 注意を必ず確認**: 非安定インターフェースのため利用中の Swift/Xcode version で有効性を確認):

```text
-Xfrontend -debug-time-function-bodies
-Xfrontend -debug-time-expression-type-checking
```

対処: 遅い式に明示的な型を与える / 長い式を中間変数へ分割 / View を意味のある SubView へ分解 / generic abstraction を単純化 / 自動生成コードを分割・Binary 化・事前生成 / macro 展開コストを測る / 変更頻度の低い巨大コードと Feature コードを分離。

**適用条件**: 型チェック最適化は Build Timeline で SwiftCompile や特定ファイルが支配的な場合に行う。Link、Emit Module、Script、Resource が支配的なら別の施策を優先する。

## 4. Build Script・Code Generation・Plugin

原則: 編集→ビルド→実行のループに必要な処理だけを Build Phase へ置く(F6)。

編集ループ外へ出しやすいもの: SwiftFormat / リポジトリ全体の SwiftLint / ドキュメント生成 / ライセンス一覧更新 / API schema 更新確認 / snapshot fixture 更新 / localization 完全検査。移動先候補: git pre-commit / CI / 明示的な開発コマンド / Xcode Build Tool Plugin / 生成物を commit する運用。

Build Phase 内に残す場合: input file list 完全定義 / output file list 完全定義 / 生成物は Derived Sources へ / `ENABLE_USER_SCRIPT_SANDBOXING` で不足依存を検出 / Target 間で重複実行しない / 生成 Tool 自体のビルド時間を測る / Plugin の依存と macro approval が CI を阻害しないか確認。

## 5. Resource・Preview・Test・CI

**Resource**: Asset Catalog が巨大でないか / Feature 固有 Resource が App へ集中していないか / Resource Bundle 数が過剰でないか / 同一 Resource を複数 Target で処理していないか。

**SwiftUI Preview**(Apple は Preview 対象と依存を小さく保つことを推奨 — WWDC26 Tips Group Lab 由来、証拠等級注意): App 全体を起動しない focused Preview / Live network・storage を依存させない / PreviewSupport を Feature 単位で提供 / App Composition Root を Preview へ持ち込まない。

**Test**: 巨大単一 Test Target になっていないか / 各 Test Target が App 全体へ依存していないか / `@testable import` の範囲 / TestSupport の Production への逆流 / UI Test の署名が開発ループへ常時入っていないか / Selective Testing の可否。

**CI**: ローカル増分と支配要因が異なる(clean checkout、Package resolution、DerivedData cache、module cache、codesign、test shard、simulator boot、artifact upload)。**ローカル最適化と CI 最適化は別 KPI で管理する。**
