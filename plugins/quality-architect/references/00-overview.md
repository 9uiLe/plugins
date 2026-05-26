# 00. ISO/IEC 25010 製品品質モデル — 全体像

> 本プラグインのリファレンス・ライブラリの索引。各品質特性の詳細は `01`〜`08` の個別ファイルを参照する。

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

## 2. 製品品質モデルの 8 特性・31 副特性（本図の基準 = 2011 版 / JIS X 25010:2013）

| # | 特性 (JP / EN) | 副特性 | 詳細 |
| --- | --- | --- | --- |
| 01 | 機能適合性 / Functional Suitability | 機能完全性・機能正確性・機能適切性 | [`01-functional-suitability.md`](./01-functional-suitability.md) |
| 02 | 性能効率性 / Performance Efficiency | 時間効率性・資源効率性・容量満足性 | [`02-performance-efficiency.md`](./02-performance-efficiency.md) |
| 03 | 互換性 / Compatibility | 共存性・相互運用性 | [`03-compatibility.md`](./03-compatibility.md) |
| 04 | 使用性 / Usability | 適切度認識性・習得性・運用操作性・ユーザエラー防止性・UI 快美性・アクセシビリティ | [`04-usability.md`](./04-usability.md) |
| 05 | 信頼性 / Reliability | 成熟性・可用性・障害許容性(耐故障性)・回復性 | [`05-reliability.md`](./05-reliability.md) |
| 06 | セキュリティ / Security | 機密性・インテグリティ・否認防止性・責任追跡性・真正性 | [`06-security.md`](./06-security.md) |
| 07 | 保守性 / Maintainability | モジュール性・再利用性・解析性・修正性・試験性 | [`07-maintainability.md`](./07-maintainability.md) |
| 08 | 移植性 / Portability | 適応性・設置性・置換性 | [`08-portability.md`](./08-portability.md) |

---

## 3. 2011 版と 2023 版の差分（重要）

本図および本ライブラリの骨格は **ISO/IEC 25010:2011（JIS X 25010:2013）** に準拠する。
2023 年の改訂版 **ISO/IEC 25010:2023** では以下が変更された。設計・レビュー時にどちらの版を基準にするか明示すること。

- **特性が 8 → 9 に増加**: 新たに **Safety（安全性）** が独立した特性として追加（副特性: operational constraint / risk identification / fail safe / hazard warning / safe integration）。
- **Usability → Interaction Capability（相互作用性）** に名称変更。副特性に self-descriptiveness 等が追加・整理。
- 一部副特性のリネーム（例: functional appropriateness の整理、Compatibility 配下の調整）。
- Freedom from risk 等は引き続き**利用時品質モデル**側で扱う。

> 実務上の指針: 安全性が要求に含まれるシステム（医療・車載・産業制御等）では 2023 版の Safety 特性を必ず併用する。

---

## 4. 利用時品質モデル（参考）

製品品質モデルとは別に、ISO/IEC 25010 は **利用時品質モデル (quality in use)** を定義する
（有効性 / 効率性 / 満足性 / リスク回避性 / 利用状況網羅性）。
本プラグインは製品品質モデルを主対象とするが、使用性・信頼性のレビューでは利用時品質の観点も補助的に参照する。

---

## 5. 使い方（スキルからの参照）

- `quality-architecture` スキル: 要件から優先する品質特性を決め、該当する `0N-*.md` の「設計タクティクス/パターン」を用いて設計・評価する。
- `quality-review` スキル: 対象コード/差分に対し、各 `0N-*.md` の「コードレビュー チェックリスト」を適用し、指摘ごとに当該ファイルの「リファレンス」を引用する。

---

## 6. 一次リファレンス（モデル本体）

- International Organization for Standardization (2011). *ISO/IEC 25010:2011 — Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models.* https://www.iso.org/standard/35733.html
- International Organization for Standardization (2023). *ISO/IEC 25010:2023 — Systems and software engineering — SQuaRE — Product quality model.* https://www.iso.org/standard/78176.html
- International Organization for Standardization (2016). *ISO/IEC 25023:2016 — Measurement of system and software product quality.* https://www.iso.org/standard/35747.html
- International Organization for Standardization (2014). *ISO/IEC 25000:2014 — Guide to SQuaRE.* https://www.iso.org/standard/64764.html
- 日本産業標準調査会 (2013). *JIS X 25010:2013 システム及びソフトウェア製品の品質要求及び評価 (SQuaRE) — システム及びソフトウェア品質モデル.* https://www.jisc.go.jp/
