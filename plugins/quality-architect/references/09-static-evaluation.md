# 09. 静的評価レイヤー — AI の揺らぎを抑える方法論

> ISO/IEC 25010 のレビューを、できる範囲で **決定論的（再現可能）** にするための仕組み。
> 設定は `${CLAUDE_PLUGIN_ROOT}/quality-gates.yml`、適用は `quality-review` スキルが行う。

---

## 1. なぜ静的評価か

LLM によるレビューは同じ入力でも出力が揺らぐ。揺らぎが生じるのは「これは問題か？」を
**判断する**箇所である。そこで、**測れる指標は実在の解析ツールに委譲し、固定しきい値と機械的に
突き合わせて確定**させる。LLM は「ツールを実行し、数値を転記し、しきい値と比較する」役に徹し、
判断は数値化できない残余部分だけに閉じ込める（SonarQube の Quality Gate と同じ発想）。

---

## 2. 3 層モデル（言語非依存／依存の切り分け）

| 層 | 言語依存 | 所在 | 内容 |
| --- | --- | --- | --- |
| ① 何を測るか（特性→指標） | 非依存 | `references/00`〜`08` | 「保守性＝循環的複雑度・結合度」等。ISO/IEC 25010 由来で共通 |
| ② どう測るか（指標→ツール・しきい値） | **依存** | `quality-gates.yml` | SwiftLint / lizard / Trivy … コマンドと出力パースのみ言語差 |
| ③ 判定・スコアカード化 | 非依存 | `quality-review` スキル | 数値としきい値の機械的突き合わせ |

**言語差は ② のアダプタに閉じ込める**。スキルもリファレンスも言語ごとに分けない。
新言語対応は `quality-gates.yml` に profile を 1 つ追記するだけ。

---

## 3. 決定論パート と 考察パート

- **決定論パート（deterministic）**: ツールが数値を出し、しきい値で機械判定。同じコードなら毎回同じ結果。
  ツールが環境に無い場合は **「未実行」と報告し、数値を捏造しない**。
- **考察パート（judgment）**: ツールが未成熟／本質的に主観・動的な領域。LLM/人手で評価し **「推測」ラベル**を付す。
  スコアカードでは両者を**明確に分離**して表示する。

---

## 4. 各特性の静的化可否（一般則）

| 特性 | 静的化 | 代表指標（決定論パートに載せられるもの） |
| --- | --- | --- |
| 機能適合性 | ○ 部分 | テストカバレッジ、要件トレーサビリティ |
| 性能効率性 | △ | （本体は動的。一部 lint） |
| 互換性 | ○ 部分 | スキーマ破壊検知、契約テスト結果 |
| 使用性 | ○ a11y のみ | アクセシビリティ自動チェック（WCAG の一部） |
| 信頼性 | △ | エラーハンドリング lint（本体は障害注入等の動的検証） |
| セキュリティ | ◎/△ | SAST・依存脆弱性・秘密情報（言語によりツール成熟度が異なる） |
| 保守性 | ◎ | 循環的複雑度・結合度・重複・サイズ・デッドコード |
| 移植性 | ○ 部分 | OS 依存 API 検出、ビルド再現性 |

> 「測れないものを数値化しない」ことも揺らぎ対策である。UI 快美性・習得性・実可用性などは
> 考察パートに残し、ゲートのスコアには含めない。

---

## 5. Swift プロファイルの要点（現行対応言語）

- **強み（Go と同様）**: Swift コンパイラが型・Optional の nil 安全・`switch` 網羅・access control を
  ビルドで強制 → 正確性の土台が確定的。SwiftLint / lizard / Periphery / swift-format で保守性も数値化。
- **弱点**: SAST・依存脆弱性スキャンのツールが experimental（SWAN, Semgrep[Swift], Trivy, OWASP
  Dependency-Check）。この領域は考察パートで補完する。

コマンド・しきい値は `quality-gates.yml` の `swift:` を参照。

---

## 6. 新しい言語プロファイルの追加手順

1. `quality-gates.yml` に `<lang>:` ブロックを追加。
2. `deterministic` に「指標 → `run`（実行コマンド）→ `threshold`」を列挙（`ref:` に根拠を明記）。
3. ツールが未成熟・主観・動的な領域は `judgment` に列挙。
4. `references/` は変更不要（共通の土台）。

---

## 7. リファレンス

- International Organization for Standardization (2016). *ISO/IEC 25023:2016 — Measurement of system and software product quality.* https://www.iso.org/standard/35747.html
- International Organization for Standardization (2011). *ISO/IEC 25040:2011 — Evaluation process.* https://www.iso.org/standard/35765.html
- McCabe, T. J. (1976). A Complexity Measure. *IEEE Transactions on Software Engineering*, SE-2(4), 308–320. https://doi.org/10.1109/TSE.1976.233837
- OWASP Foundation. *OWASP Mobile Application Security Testing Guide (MASTG) — MASTG-TEST-0085: Checking for Weaknesses in Third Party Libraries.* https://mas.owasp.org/MASTG/tests/ios/MASVS-CODE/MASTG-TEST-0085/
- Tiganov, D., Cho, J., Ali, K., & Dolby, J. (2020). *SWAN: A Static Analysis Framework for Swift.* In Proceedings of the 28th ACM Joint Meeting on ESEC/FSE (Tool Demonstrations), pp. 1640–1644. https://doi.org/10.1145/3368089.3417924
- SwiftLint — Rules (cyclomatic_complexity 等の既定値). https://realm.github.io/SwiftLint/rule-directory.html
- Apple / Swift.org. *swift-format.* https://github.com/swiftlang/swift-format
- Aqua Security. *Trivy — Swift coverage.* https://trivy.dev/docs/latest/coverage/language/swift/
