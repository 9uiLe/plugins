# Static / Dynamic / Mergeable / Binary の選択

> 対応章: ベース調査文書 §10 | 支配的ラベル: INFERENCE(F7〜F11 に基づく)。**この領域の推奨は必ず Link の寄与の MEASURED を前提とする(claim 別ゲート)**

## 1. Static

適する: 起動時間を優先 / Framework 埋め込み数を抑えたい / リンクがボトルネックではない / 配布構成を単純にしたい。
リスク: 大規模な反復リンク、静的ライブラリ増加時のリンクコスト。

## 2. Dynamic

適する: Debug のリンクが主要ボトルネック(**要 MEASURED**)/ Framework 単位で差し替え・開発 / 起動時間への影響が許容される。
リスク: dyld ロード、埋め込み Framework 増加、起動時間とメモリ、Embed/Sign 工程、Bundle・runtime lookup の複雑化。

**F7 の含意**: Dynamic 化は Swift ソースの型チェックや module emission を消す施策ではなく、主にリンク工程へ効く。コンパイルが支配的なら効果は限定的。

## 3. Mergeable Libraries

検証候補: Xcode Framework Target が多数 / Debug リンクを軽くしたい / Release では Framework 数を減らしたい(F8)。

検証事項(**PoC で全部測る**): Debug 時の実リンク時間 / Release バイナリサイズ / App launch / Memory / Crash symbolication / `Bundle` lookup / `dlopen` 等の runtime lookup / Build Script が Framework binary の存在を前提にしていないか / App Extension との関係。

## 4. Binary Target

適する: コンパイル時間が非常に大きい(**要 MEASURED**)/ API が安定 / 変更頻度が低い / デバッグ頻度が低い / CI で安全に生成・配布できる / Source と Binary の revision を追跡できる。

候補例: 画像・動画・音声処理、暗号・圧縮、巨大な自動生成コード、安定した社内 SDK、変更しない第三者ライブラリ、コンパイルが重い C/C++ ラッパー。

避ける: 高頻度に変更する Feature / UI 試行錯誤が多い領域 / step-in デバッグが頻繁な領域 / API が不安定 / Source/Binary の同期を保証できない領域。

**F11 の含意**: Binary 化 ≠ `BUILD_LIBRARY_FOR_DISTRIBUTION`。同一リポジトリ・同一リリースで更新する内部 Framework に不要な resilience cost を持ち込まない。

## 5. 判断マトリクス

> **注意(必ず隣接して提示)**: この表は一般的傾向であり、プロジェクト実測を置き換えない。表だけを根拠に RECOMMENDED を出してはならない(CANDIDATE + EXPERIMENT 止まり)。

| 条件 | Source Static | Source Dynamic | Mergeable | Binary |
|---|---:|---:|---:|---:|
| 高変更頻度 | ◎ | ◎ | ◎ | × |
| 重いコンパイル | △ | △ | △ | ◎ |
| 重いリンク | △ | ◎ | ◎ | ◎ |
| 起動時間優先 | ◎ | △ | ◎ | 構成次第 |
| デバッグ容易性 | ◎ | ◎ | ○ | △ |
| 配布運用の単純さ | ◎ | ○ | ○ | × |
| API 不安定 | ◎ | ◎ | ◎ | × |
| 複数アプリ共有 | ○ | ○ | ○ | ◎ |

## 6. SwiftPM linkage の既定(F9)

可能なら Library Product の `.static` / `.dynamic` を明示せず SwiftPM に選ばせる。内部 Package 全部を `.dynamic` へ固定する施策は、事前に効果と制約を検証する。共有 Package では利用者の選択肢を保つ。
