# 静的評価レイヤー — AI の揺らぎを抑える方法論

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
| ① 何を測るか（特性→指標） | 非依存 | `references/00`〜`09` | 「保守性＝循環的複雑度・結合度」等。ISO/IEC 25010:2023 由来で共通 |
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

## 3.5 完全な決定論化（ラッパースクリプト + CI）

LLM が `run` コマンドを組み立て、出力をパースする工程にはまだ揺らぎが残る
（対象ファイルの選び方・JSON の読み方など）。これを排除するには:

- **ラッパースクリプト**: `${CLAUDE_PLUGIN_ROOT}/scripts/quality-gate-swift.sh` が
  ツール実行 → パース → しきい値判定 → `quality-gate-result.json` 出力までを担う。
  スキルはこの JSON を読むだけなので、解釈の揺れが入らない。未導入ツールは `skipped`、
  全件 skipped なら `inconclusive`（pass と誤認しない）。
- **CI で実行**: ローカルにツールが無い環境（サンドボックス等）では決定論パートが
  `skipped` だらけになり揺らぎが復活する。`examples/ci/github-actions-swift-quality.yml`
  のように **CI でツールを走らせ、`quality-gate-result.json` を artifact 化**し、
  それをレビューに食わせるのが最も堅い。
- **しきい値の根拠**: 複雑度 20・カバレッジ 0.70 等は ISO 規格の値ではなく**プロジェクト方針**。
  規格由来の絶対基準と混同しないこと（env / `.swiftlint.yml` で調整）。

## 3.6 結合の深掘り（Khononov 補論）のための拡張概念

[`07a-coupling-deep-dive.md`](./07a-coupling-deep-dive.md) で扱う **Integration Strength × Distance × Volatility** の 3 次元モデルを静的シグナル化するには、`§3` の決定論／考察 2 区分だけでは粒度が足りない。以下の 3 概念を追加する。

### 3.6.1 `module_unit:` 宣言

- **何のためか**: `distance_level` は「2 つのコンポーネントが共有する境界の遠さ」を表す（07a §4）。**何を 1 つのモジュールとみなすか** を宣言しないと、distance を確定できない。
- **形式**: `quality-gates.yml` の各言語プロファイルに `module_unit:` フィールドを追加する。例: Swift なら `spm-target`、Go なら `package`、JS/TS なら `pnpm-workspace-package` または `npm-package`、Python なら `top-level-package`。
- **未宣言時の規約**: `module_unit:` が宣言されていない場合、`distance_level` を 1〜5 のいずれかに確定してはならない。**`distance basis: path-depth fallback`** ラベルを併記し、決定論性が **部分的** であることを明示する（07a §9 H4 規律）。

### 3.6.2 `band` しきい値（連続値の段階化）

- **何のためか**: Khononov 由来のシグナルは「>10 で FAIL」のような単一しきい値より、**「band 0 / band 1 / band 2 / band 3」のような連続値の段階化** が適切な場合がある（例: `intrusive_hits` は 0 と 1 で意味が異なる、`observed_change_frequency` は 0–5/6–20/21– などの帯域で意味が変わる）。
- **形式**: `threshold` を `{ bands: [{ max: 0, label: "balanced" }, { max: 5, label: "watch" }, ...] }` 形式で表現する。各 band にラベル（`balanced` / `watch` / `imbalanced` / `knot` 等）と severity マッピングを持たせる。
- **既存しきい値との共存**: 既存の `{ high: 10, critical: 20 }` 形式は無編集で残す。`band` 形式は補論シグナル専用。**既存しきい値の上書きや書き換えは禁則**（07a §9 H9）。

### 3.6.3 `aggregate` しきい値（リポジトリ全体の集計）

- **何のためか**: BALANCE モデル（07a §6）はモジュール **対** に対する論理判定だが、リポジトリ全体の状態を一目で見るには対ごとの判定を集約した指標が要る。例: 「`STRENGTH AND DISTANCE = TRUE` となっているモジュール対の割合」「`intrusive_hits > 0` の境界数」。
- **形式**: `aggregate: { metric: <name>, formula: <expression>, threshold: ... }` をプロファイル内に持つ。
- **注意**: aggregate スコアを **単独の verdict 根拠** として使わない。Khononov 2024 は count-based なメトリクスを名指しで否定している（07a §3.2、H2）。aggregate は **概観目的** に限る。

### 3.6.4 `planned-deterministic:` ブロックと `deterministic:` ブロックの区別

- **何のためか**: `intrusive_hits` / `distance_level` / `observed_change_frequency` のような補論シグナルは、ツールチェーンが **完全には整備されていない領域** にまたがる。Semgrep の Swift サポートは experimental、jscpd / code-maat / git-of-theseus はリポジトリ規模により実行コストが大きい、など。
- **形式**: `quality-gates.yml` プロファイル内で `deterministic:` とは別に **`planned-deterministic:`** ブロックを設ける。`planned-deterministic:` の項目は:
  - 通常の `deterministic:` と同じく `run:` `threshold:` を持つ。
  - ただし **生成された数値は `推測` ラベル付きで採用** する（量子化された判断であって最終判定ではない）。
  - 観測ウィンドウ依存のシグナル（volatility 系）は `--since=<window>` を本文に必ず併記する（07a §9 H5）。
  - ツール未導入時は `deterministic:` と同じく `skipped` 扱い（数値捏造禁止）。
- **`deterministic:` への昇格条件**: 当該シグナルに対する pinned コマンド・固定パーサー・閾値根拠の 3 点が揃った時点で、プロジェクトは `planned-deterministic:` 項目を `deterministic:` へ移動できる。**移動の判断はユーザの明示同意の下でのみ行う**（auto-mode で自動昇格してはならない）。

## 4. 各特性の静的化可否（一般則）

| 特性 | 静的化 | 代表指標（決定論パートに載せられるもの） |
| --- | --- | --- |
| 機能適合性 | ○ 部分 | テストカバレッジ、要件トレーサビリティ |
| 性能効率性 | △ | （本体は動的。一部 lint） |
| 互換性 | ○ 部分 | スキーマ破壊検知、契約テスト結果 |
| 相互作用性 | ○ 包摂性/支援性の一部のみ | アクセシビリティ自動チェック（WCAG の一部） |
| 信頼性 | △ | エラーハンドリング lint（本体は障害注入等の動的検証） |
| セキュリティ | ◎/△ | SAST・依存脆弱性・秘密情報（言語によりツール成熟度が異なる） |
| 保守性 | ◎ | 循環的複雑度・結合度・重複・サイズ・デッドコード |
| 柔軟性 | ○ 部分 | OS 依存 API 検出、ビルド再現性、設定の外部化 |
| 安全性 | △ | 安全状態遷移・フェイルセーフの静的検査は限定的（本体は安全解析・動的検証） |
| **結合の深掘り（07a 補論）** | **混在** | Khononov Distance（`module_unit:` 宣言下で決定論）/ Volatility proxy（`--since` 固定下で観測値、`推測` 付与）/ Integration Strength 段（判断のみ）/ 静的 Connascence（部分決定論）/ 動的 Connascence（判断のみ） |

> 「測れないものを数値化しない」ことも揺らぎ対策である。ユーザ従事性・習得性・実可用性・
> ハザード対応の妥当性などは考察パートに残し、ゲートのスコアには含めない。
> **結合の深掘り (07a) では、Integration Strength 段の確定を「判断のみ」として扱う**（共有要素併記が必須・断定不可、07a §9 H3 規律）。Phase 2 で `planned-deterministic:` に置く SIGNAL は「Strength ラダー割当の入力」であって「Strength そのもの」ではない。

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
