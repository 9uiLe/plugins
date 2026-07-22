# 一次資料から確認できる事実(FACT レジスタ)

> 対応章: ベース調査文書 §2・§29 | 調査日: 2026-07-22(全 URL 到達確認済み 2026-07-22)
> 本ファイルの各項目は外部一次資料由来の FACT。ただし各項目末尾の「判断への影響」は本スキルの INFERENCE であり、FACT と混同しないこと。
> WWDC Group Lab(F5・F6 の一部・F12 注記)は Q&A 形式の口頭ガイダンス要約であり、エンジニアリングセッションや文書より出典安定性が一段低い。引用時は「公式ガイダンス由来」であることを明示する。

## F1: SwiftPM Target は module のコンパイル単位

> "compiled into a module or test suite"

Target が基本構成要素であり、Target 内のソースが module または test suite へコンパイルされる。Product は 1 つ以上の Target の成果物をまとめ外部へ公開する単位。**適用範囲の注意**: これは source target の話であり、binary / system / plugin target まで同じ意味で module になると一般化しない。

- 出典: [SwiftPM — PackageDescription](https://docs.swift.org/package-manager/PackageDescription/PackageDescription.html) / [SwiftPM Target Documentation](https://docs.swift.org/swiftpm/documentation/packagedescription/target/)
- INFERENCE(判断への影響): Package 数より Target 構成がコンパイル境界として重要。同じ Target を別 Package へ移すだけではコンパイル粒度は変わらない。

## F2: 下流 Target は依存 Target の module interface を必要とする

> "required for downstream targets to begin a compilation"

Swift Target は公開インターフェースを表す binary module を生成し、それが下流 Target のコンパイル開始に必要。

- 出典: [WWDC22 — Demystify parallelization in Xcode builds](https://developer.apple.com/videos/play/wwdc2022/110364/)
- INFERENCE: 深い直列チェーンは critical path を長くする。高被依存 Target の module emission 時間・公開 API・import が重要。

## F3: module graph は非循環グラフとして扱われる

> "forming an acyclic module graph"

- 出典: [WWDC24 — Demystify explicitly built modules](https://developer.apple.com/videos/play/wwdc2024/10171/)
- INFERENCE: 依存は DAG として評価する(edge、深さ、fan-in、fan-out、critical path)。循環回避のためだけの Common module は別の集中依存を作り得る。

## F4: Explicitly Built Modules は module 構築を明示的なタスクにする

> "scanning, building modules, and finally building the original code"

Xcode はソースを scan し、module graph を作り、module compile を明示的タスクとしてスケジュールし、その後に元ソースをコンパイルする。設定差異により同じ module の複数 variant が生成され、設定統一で module を Target 間で共有しやすくなる。**version 依存**: 既定の有効状態は Xcode version で変わり得るため利用者環境で確認。

- 出典: [WWDC24 — Demystify explicitly built modules](https://developer.apple.com/videos/play/wwdc2024/10171/) / [WWDC26 — Swift Group Lab](https://developer.apple.com/videos/play/wwdc2026/8001/)
- INFERENCE: Target ごとに Swift version、language mode、feature flag 等を不必要に変えない。module 数だけでなく module variant 数を確認する。

## F5: Emit Module が遅い場合、過剰な import が重要な疑いになる(Group Lab 由来)

WWDC26 Swift Group Lab では、型推論や generics は極端なケースで特定 expression を遅くできるが、Emit Module フェーズ全体が遅い場合は import している module 群との関係がより疑わしいと説明された。**証拠等級注意**: Group Lab の口頭ガイダンス。

- 出典: [WWDC26 — Swift Group Lab](https://developer.apple.com/videos/play/wwdc2026/8001/)
- INFERENCE: `-debug-time-expression-type-checking` だけで module emission 問題を説明しない。Target 分割数を増やす前に依存 edge を削る。

## F6: Build Script は input/output が不明だと並列性と増分性を損なう

> "inputs and outputs ... must be manually configured"

Script Phase は input/output を手動で正確に設定する必要がある。不十分だと直列実行や不要な再実行が発生する。User Script Sandboxing で宣言されていないファイルアクセスを検出できる。

- 出典: [WWDC22 — Demystify parallelization](https://developer.apple.com/videos/play/wwdc2022/110364/) / [WWDC26 — Xcode Tips and Tricks Group Lab](https://developer.apple.com/videos/play/wwdc2026/8013/)(後者は Group Lab)
- INFERENCE: ビルドに不可欠な Script だけを編集ループ内へ置き、input/output file list を完全定義する。フォーマット等は git hook や明示コマンドへ。

## F7: Static と Dynamic はビルド時間と起動時間のコスト配置が異なる

> "This results in faster builds."(Dynamic Library の反復ビルドについて)

Dynamic では更新時に static linker がコードをコピーし直す必要がなく反復ビルドを軽くできる。一方、起動時に dyld が Framework を探索・ロードし、埋め込み Framework の増加はメモリと起動時間へ影響する。

- 出典: [WWDC23 — Meet mergeable libraries](https://developer.apple.com/videos/play/wwdc2023/10268/)
- INFERENCE: Dynamic 化は主にリンク工程へ効く。コンパイルが支配的なら効果は限定的。Debug と Release で同じリンク戦略が最適とは限らない。

## F8: Mergeable Libraries は開発時と配布時の両方を最適化できる

> "combine the best parts of static and dynamic libraries"

- 出典: [WWDC23 — Meet mergeable libraries](https://developer.apple.com/videos/play/wwdc2023/10268/)
- INFERENCE: Framework Target を多数持つアプリでは検証候補。制約と効果は必ず計測(runtime lookup、bundle lookup、App Extension への影響を確認)。

## F9: SwiftPM Library Product の linkage は固定しないことが推奨される

> "don't declare the type of library explicitly"

可能なら `.static` / `.dynamic` を明示せず SwiftPM が選べる状態を推奨。

- 出典: [SwiftPM — Product.library](https://docs.swift.org/package-manager/PackageDescription/PackageDescription.html)
- INFERENCE: 内部 Package 全部を `.dynamic` に固定する施策は事前に効果と制約を検証する。

## F10: SwiftPM は Apple プラットフォーム向け Binary Target を持つ

remote / ローカル artifact を参照する pre-built Binary Target をサポート。

- 出典: [SwiftPM — binaryTarget](https://docs.swift.org/package-manager/PackageDescription/PackageDescription.html)
- INFERENCE: コンパイルコストが高く変更頻度が低い module は Binary Target 化の候補。ただし XCFramework 生成、checksum、互換性、更新パイプラインの運用が必要。

## F11: 内部 Framework に Library Evolution を無条件で有効化しない

> "should not be built with library evolution support"

常にアプリと一緒にビルド・配布する SPM Package や内部 Binary Framework には Library Evolution を有効化すべきではない。クライアントと別に更新される Framework 向けの機能で、性能特性も変える。

- 出典: [Swift.org — Library Evolution in Swift](https://www.swift.org/blog/library-evolution/)
- INFERENCE: Binary 化と `BUILD_LIBRARY_FOR_DISTRIBUTION` を同一視しない。外部 SDK として独立配布する場合だけ module stability を設計する。

## F12: Swift コンパイラには型チェック時間の診断機能がある

- `-Xfrontend -debug-time-function-bodies`(function 単位)
- `-Xfrontend -debug-time-expression-type-checking`(expression 単位)

**version 依存の注意(必ず持ち越すこと)**: これらは非安定・内部的なインターフェースであり version 差がある。利用中の Swift / Xcode version で有効性を確認してから使う。

- 出典: [Swift Compiler Performance](https://github.com/swiftlang/swift/blob/main/docs/CompilerPerformance.md)
- INFERENCE: 特定ファイル・特定 expression が遅い場合に使う。module emission、link、script、resource の問題には別の計測を使う。

## 一次資料一覧

1. [SwiftPM — PackageDescription](https://docs.swift.org/package-manager/PackageDescription/PackageDescription.html)
2. [SwiftPM Target Documentation](https://docs.swift.org/swiftpm/documentation/packagedescription/target/)
3. [WWDC22 — Demystify parallelization in Xcode builds](https://developer.apple.com/videos/play/wwdc2022/110364/)
4. [WWDC23 — Meet mergeable libraries](https://developer.apple.com/videos/play/wwdc2023/10268/)
5. [WWDC24 — Demystify explicitly built modules](https://developer.apple.com/videos/play/wwdc2024/10171/)
6. [WWDC26 — Swift Group Lab](https://developer.apple.com/videos/play/wwdc2026/8001/)(Group Lab: 証拠等級低め)
7. [WWDC26 — Xcode Tips and Tricks Group Lab](https://developer.apple.com/videos/play/wwdc2026/8013/)(Group Lab: 証拠等級低め)
8. [Swift.org — Library Evolution in Swift](https://www.swift.org/blog/library-evolution/)
9. [Swift Compiler Performance](https://github.com/swiftlang/swift/blob/main/docs/CompilerPerformance.md)
