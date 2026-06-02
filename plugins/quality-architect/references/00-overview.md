# 00. ISO/IEC 25010 製品品質モデル — 全体像

> 本プラグインのリファレンス・ライブラリの索引。各品質特性の詳細は `01`〜`09` の個別ファイルを参照する。
> **正典は ISO/IEC 25010:2023（第 2 版、9 特性）**。旧 2011 版（8 特性）との差分は §3 に示す。

---

## 1. SQuaRE と製品品質モデルの位置づけ

ISO/IEC 25010 は **SQuaRE (Systems and software Quality Requirements and Evaluation)** と総称される
**ISO/IEC 25000 シリーズ**の中核規格であり、ソフトウェア／システム製品の品質を
**特性 (characteristic)** と **副特性 (subcharacteristic)** の階層で定義する参照モデルである。

SQuaRE シリーズの主な構成（本プラグインで参照する範囲）:

| 規格 | 役割 |
| --- | --- |
| ISO/IEC 25000 | SQuaRE 全体のガイドと用語 |
| ISO/IEC 25010 | **製品品質モデル**（本プラグインの土台）+ 利用時品質モデル |
| ISO/IEC 25012 | データ品質モデル |
| ISO/IEC 25019 (旧 25022) | 利用時品質の測定 |
| ISO/IEC 25023 | **製品品質の測定**（特性ごとの品質測度 QM の定義） |
| ISO/IEC 25040 | 品質評価プロセス |

> ⚠️ ISO/IEC 25010 は有償規格である。本ライブラリでは公式書誌情報・公開要約・派生する学術文献を引用し、
> 規格本文の逐語転載は行わない。定義は規格の趣旨に基づく要約として記述する。

---

## 2. 製品品質モデルの 9 特性・40 副特性（正典 = ISO/IEC 25010:2023）

| # | 特性 (JP / EN) | 副特性 | 詳細 |
| --- | --- | --- | --- |
| 01 | 機能適合性 / Functional Suitability | 機能完全性・機能正確性・機能適切性 | [`01-functional-suitability.md`](./01-functional-suitability.md) |
| 02 | 性能効率性 / Performance Efficiency | 時間効率性・資源効率性・容量満足性 | [`02-performance-efficiency.md`](./02-performance-efficiency.md) |
| 03 | 互換性 / Compatibility | 共存性・相互運用性 | [`03-compatibility.md`](./03-compatibility.md) |
| 04 | 相互作用性 / Interaction Capability | 適切度認識性・習得性・運用操作性・ユーザエラー防止性・ユーザ従事性・包摂性・ユーザ支援性・自己記述性 | [`04-interaction-capability.md`](./04-interaction-capability.md) |
| 05 | 信頼性 / Reliability | 欠陥のなさ・可用性・障害許容性(耐故障性)・回復性 | [`05-reliability.md`](./05-reliability.md) |
| 06 | セキュリティ / Security | 機密性・インテグリティ・否認防止性・責任追跡性・真正性・耐性 | [`06-security.md`](./06-security.md) |
| 07 | 保守性 / Maintainability | モジュール性・再利用性・解析性・修正性・試験性 | [`07-maintainability.md`](./07-maintainability.md) |
| 08 | 柔軟性 / Flexibility | 適応性・拡張性・設置性・置換性 | [`08-flexibility.md`](./08-flexibility.md) |
| 09 | 安全性 / Safety | 運用上の制約・リスク識別・フェイルセーフ・ハザード警告・安全な統合 | [`09-safety.md`](./09-safety.md) |
| — | 静的評価レイヤー（方法論） | 揺らぎ防止・3 層モデル・言語プロファイル | [`static-evaluation.md`](./static-evaluation.md) |

副特性数: 3+3+2+8+4+6+5+4+5 = **40**。

---

## 3. 2011 版（第1版）からの主な変更点

旧 **ISO/IEC 25010:2011（JIS X 25010:2013）** は 8 特性・31 副特性だった。2023 年の第2版で以下が変わった。

- **特性が 8 → 9**: **安全性 (Safety)** を新設（運用上の制約・リスク識別・フェイルセーフ・ハザード警告・安全な統合）。
- **使用性 (Usability) → 相互作用性 (Interaction Capability)** に改称し副特性を拡張:
  - UI 快美性 → **ユーザ従事性 (User engagement)**
  - アクセシビリティ → **包摂性 (Inclusivity)** と **ユーザ支援性 (User assistance)** に分割
  - **自己記述性 (Self-descriptiveness)** を追加
- **移植性 (Portability) → 柔軟性 (Flexibility)** に改称・一般化し、**拡張性 (Scalability)** を追加（旧版では適応性に含まれていた）。
- **信頼性**: 成熟性 (Maturity) → **欠陥のなさ (Faultlessness)** に改称。
- **セキュリティ**: **耐性 (Resistance)** を追加（5 → 6 副特性）。

> いただいた図は 2011 版（8 特性）。本ライブラリは現行の **2023 版を正典**とし、各ファイルで 2011 版との差分を注記している。
> 日本の JIS（X 25010:2013）は 2011 版に対応するため、JIS 準拠が要件の場合は 2011 版の構成を併用すること。

---

## 4. 利用時品質モデル（参考）

製品品質モデルとは別に、ISO/IEC 25010 は **利用時品質モデル (quality in use)** を定義する
（有効性 / 効率性 / 満足性 / リスク回避性 / 利用状況網羅性）。
本プラグインは製品品質モデルを主対象とするが、相互作用性・信頼性・安全性のレビューでは利用時品質の観点も補助的に参照する。

---

## 5. 使い方（スキルからの参照）

### 5.1 プラグイン共通の絶対規律（カノン・両スキルが従う）

本プラグインのどのスキルから入っても、以下は **スキル非依存の絶対要件** である。両 SKILL.md の §0 はここを反映しており、矛盾があれば本節を優先する。

1. **ルーティング**: 対象として既存コード／差分／PR／実装が与えられた依頼の唯一の正当な入口は `quality-review` である。`quality-architecture` を起動してしまった場合は、最初の応答でハンドオフ提案を行う（黙って続行しない）。
2. **決定論ファースト**: 既存コードに対する品質判断（数値・指摘）を出力する前に、必ず次の順で試す。(a) `quality-gate-result.json` を Read、(b) `${CLAUDE_PLUGIN_ROOT}/scripts/quality-gate-<lang>.sh` を Bash で実行、(c) `quality-gates.yml` の `run` を個別実行、(d) いずれも不可なら全項目 `skipped` を明記し総合 `inconclusive` と報告。**いずれも実行せずに LLM 単独で数値を出すことは禁止**。
3. **資産検出**: いずれのスキルでも、対象リポジトリ内の `quality-gate-result.json` / `.swiftlint.yml` / `.periphery.yml` / `Mintfile` / `scripts/quality-gate-*.sh` / `.github/workflows/*quality*.y*ml` の存在を確認し、結果をレポート冒頭に転記する。
4. **数値しきい値**: 対象コードに対する判定文脈で数値しきい値（V(G), カバレッジ, CBO 等）を本文に書く場合、必ず `measured: <実測値>` または `measured: 未実行(skipped: <理由>)` をペアで併記する。設計時（`quality-architecture`）で文献値を引用するときは `（参考値: ...）` ラベル必須で、対象コードへの判定として書かない。
5. **副作用付きツールの事前同意**: `swift test`, `trivy fs` などビルド／テスト／ネットワークが走るコマンドは AskUserQuestion で実行可否を確認してから実行する（既に同意済みの場合を除く）。

上記 1〜5 のいずれかが満たせない場合は、応答冒頭で「どの規律が、どの理由でブロックされているか」を明示し、ユーザの判断を仰ぐ。サイレントに省略してはならない。

### 5.2 スキルの役割分担

| 判別軸 | `quality-architecture` を選ぶ | `quality-review` を選ぶ |
| --- | --- | --- |
| 対象 | これから作るもの・設計案・要件文書 | 既存コード／差分／PR／リポジトリ |
| 成果物 | アーキテクチャ提案・トレードオフ表・検証計画 | 指摘一覧（重大度付き）・スコアカード |
| 数値 | 文献値を `（参考値）` ラベルで引用（実測しない） | 静的解析ツールで実測（決定論パート） |
| 代表的トリガー語 | 設計して／非機能要件／ATAM／検討して／案を比較して | レビューして／評価して／指摘して／監査して／このコード／この PR |

- `quality-architecture` スキル: 要件から優先する品質特性を決め、該当する `0N-*.md` の「設計タクティクス／パターン」を用いて設計・評価する。**既存コードのレビュー要求が来たら §5.1 ルール 1 により `quality-review` にハンドオフ。**
- `quality-review` スキル: 対象コード／差分に対し、各 `0N-*.md` の「コードレビュー チェックリスト」を適用し、指摘ごとに当該ファイルの「リファレンス」を引用する。**§5.1 ルール 2 の決定論ファーストを必ず実行する。**

---

## 6. 一次リファレンス（モデル本体）

- International Organization for Standardization (2023). *ISO/IEC 25010:2023 — Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model.* https://www.iso.org/standard/78176.html
- International Organization for Standardization (2011). *ISO/IEC 25010:2011 — Systems and software engineering — SQuaRE — System and software quality models* (第1版・2023 に置換). https://www.iso.org/standard/35733.html
- International Organization for Standardization (2016). *ISO/IEC 25023:2016 — Measurement of system and software product quality.* https://www.iso.org/standard/35747.html
- International Organization for Standardization (2014). *ISO/IEC 25000:2014 — Guide to SQuaRE.* https://www.iso.org/standard/64764.html
- 日本産業標準調査会 (2013). *JIS X 25010:2013 システム及びソフトウェア製品の品質要求及び評価 (SQuaRE) — システム及びソフトウェア品質モデル* (2011 版に対応). https://www.jisc.go.jp/
- Khononov, V. (2024). *Balancing Coupling in Software Design: Universal Design Principles for Architecting Modular Software Systems.* Addison-Wesley Professional. ISBN 978-0-13-735348-4. https://www.informit.com/store/balancing-coupling-in-software-design-universal-design-9780137353484 （結合の深掘り補論 [`07a-coupling-deep-dive.md`](./07a-coupling-deep-dive.md) を参照。本書は §5.1 / §5.2 のルーティング規律を上書きしない補論扱い）
  - 邦訳: 島田 浩二 訳『ソフトウェア設計の結合バランス — 持続可能な成長を支えるモジュール化の原則』インプレス (impress top gear), 2025 年 10 月 21 日 初版第 1 刷発行（奥付確認済み）. ISBN 978-4-295-02296-1.
