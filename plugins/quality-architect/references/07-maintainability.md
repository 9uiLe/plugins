# 07. 保守性 / Maintainability

> ISO/IEC 25010:2023 製品品質モデルの「保守性」に関する、調査・アーキテクチャ設計・コードレビュー用リファレンス。

---

## 1. 定義

**ISO/IEC 25010:2023** における保守性とは、担当者がプロダクトやシステムを意図どおりに修正できる能力の高さを表す品質特性である（出典: ISO/IEC 25010:2023）。修正コストの低減と変更に伴うリスクの抑制を目的とし、モジュール性・再利用性・解析性・修正性・試験性の5つの副特性によって構成される。ISO/IEC 25023:2016 はこの特性を定量的に評価するための品質測定指標群を規定している。

> **2011 版との違い:** ISO/IEC 25010:2023 では保守性の副特性に「柔軟性 (Flexibility)」が追加され、6副特性構成に変更された（2011 版は5副特性）。また定義文も改訂されている。本ファイルは 2023 版を正典とするが、コアとなるモジュール性・再利用性・解析性・修正性・試験性の5副特性は両版に共通であり、これら5副特性に関する内容は 2023 準拠として記述する。

---

## 2. 副特性

### 2.1 モジュール性 (Modularity)

**定義:** システムやプログラムが独立したコンポーネントで構成されており、あるコンポーネントへの変更が他のコンポーネントへ波及しにくい度合い（出典: ISO/IEC 25010:2023）。

> 結合の **3 次元モデル (Integration Strength × Distance × Volatility)** と Connascence による深掘り語彙は補論 [`07a-coupling-deep-dive.md`](./07a-coupling-deep-dive.md) を参照。本ファイルのしきい値・PASS/FAIL は補論の知見によって **上書きされない**（補論 §9 H9: 重大度は下方修正のみ可）。

**調査観点:**
- コンポーネント間の依存関係グラフが非循環有向グラフ (DAG) を形成しているか。
- 変更波及範囲 (change impact area) がモジュール境界内に収まっているか。

**設計タクティクス・パターン:**
- Parnas (1972) の情報隠蔽原則: 変更されやすい設計決定をモジュール境界内に閉じ込める。
- Stevens et al. (1974) の構造化設計: 機能的凝集 (functional cohesion) を最大化し、結合度 (coupling) を最小化する。
- レイヤードアーキテクチャ / ヘキサゴナルアーキテクチャ: ビジネスロジックをインフラ依存から分離する。

**コードレビューチェックリスト:**
- [ ] 1 モジュールが単一の責務を持つか (SRP: Single Responsibility Principle)。
- [ ] パッケージ/モジュール間の循環依存がないか。
- [ ] public API の変更が他モジュールへのカスケード修正を引き起こさないか。

**計測指標:**
- **結合度 (Coupling Between Objects; CBO):** クラスが依存する他クラス数。Chidamber & Kemerer (1994) の CK メトリクスの一つ。推奨閾値: CBO ≤ 10。
- **ファン・イン / ファン・アウト:** モジュールを呼び出すモジュール数 / モジュールが呼び出すモジュール数。

---

### 2.2 再利用性 (Reusability)

**定義:** あるアセットが、複数のシステムや他のアセットを構築する際に転用できる度合い（出典: ISO/IEC 25010:2023）。

**調査観点:**
- 機能がコンテキスト固有の前提条件に依存していないか。
- インターフェースが汎化されており、呼び出し元の実装詳細を露出させていないか。

**設計タクティクス・パターン:**
- DRY 原則 (Don't Repeat Yourself): 知識の単一表現化。
- 依存性逆転原則 (DIP): 上位モジュールは下位モジュールの具象に依存せず抽象に依存する (Martin, 2017)。
- コンポーネント凝集の原則 (REP / CCP / CRP): Martin (2017) が提示するコンポーネント再利用等価の原則。

**コードレビューチェックリスト:**
- [ ] 重複コードブロックが抽象化・関数化されているか。
- [ ] ユーティリティ関数が特定ドメインの型に非依存か。
- [ ] ライブラリ・共有コンポーネントのバージョン管理ポリシーが明確か。

**計測指標:**
- **重複コード密度:** 重複行数 / 総行数。目安: 5 % 未満。
- **LCOM (Lack of Cohesion of Methods):** クラス内メソッド間でインスタンス変数を共有しないペアの割合。LCOM が高いほど再利用単位として不適切 (Chidamber & Kemerer, 1994)。

---

### 2.3 解析性 (Analysability)

**定義:** プロダクトやシステムにおいて、障害の原因特定・変更箇所の把握・変更影響の評価を効果的かつ効率的に行える度合い（出典: ISO/IEC 25010:2023）。

**調査観点:**
- ログ・トレース情報が障害の根本原因特定に十分な情報を提供しているか。
- コードの認知的複雑度 (cognitive complexity) が高く、読解に過大なコストを要しないか。

**設計タクティクス・パターン:**
- 構造化ログ・分散トレーシング: 障害箇所の素早いピンポイント化。
- 循環的複雑度の管理: McCabe (1976) は複雑度を V(G) = e − n + 2p で定義。V(G) ≤ 10 を推奨閾値とする。
- 意図を明示した命名規則と Fowler (2018) の明示的メソッド抽出 (Extract Function) リファクタリング。

**コードレビューチェックリスト:**
- [ ] 関数・メソッドの長さが適切か (目安: 20〜30 行以内)。
- [ ] 条件分岐の深さが 3 レベル以内か。
- [ ] エラーメッセージが障害診断に十分な文脈を含むか。

**計測指標:**
- **循環的複雑度 V(G):** V(G) = e − n + 2p (e: エッジ数, n: ノード数, p: 連結成分数)。単一関数に対して p = 1 とすると V(G) = 分岐数 + 1 (McCabe, 1976)。
- **認知的複雑度:** 制御フローの入れ子深さに応じた主観的複雑度の定量化。SonarSource (2018) による。

---

### 2.4 修正性 (Modifiability)

**定義:** 新たな欠陥を混入させたり既存の品質を損なったりすることなく、プロダクトやシステムを効果的・効率的に変更できる度合い（出典: ISO/IEC 25010:2023）。

**調査観点:**
- 変更影響が局所化されており、予期しない副作用が生じにくい構造か。
- 技術的負債 (technical debt) の蓄積により修正コストが増大していないか。

**設計タクティクス・パターン:**
- オープン・クローズド原則 (OCP): 拡張に対して開かれ、修正に対して閉じられた設計 (Martin, 2017)。
- ストラングラーフィグパターン / フィーチャートグル: 段階的な変更適用による修正リスクの低減。
- 技術的負債の管理: Cunningham (1992) の負債メタファーに基づき、意図的負債を明示的に記録・返済計画を策定する。

**コードレビューチェックリスト:**
- [ ] ハードコードされた定数・設定値が外部化されているか。
- [ ] ビジネスルールが UI やデータアクセス層から分離されているか。
- [ ] 変更箇所が単一クラス・モジュール内に収まっているか (散弾銃手術のアンチパターンを回避)。

**計測指標:**
- **変更影響指数 (Change Impact):** ある変更に対して修正が必要なクラス数の平均。
- **保守性指数 (Maintainability Index; MI):** Coleman et al. (1994) による複合指標。
  ```
  MI = 171 − 5.2 × ln(HV) − 0.23 × V(G) − 16.2 × ln(SLOC) + 50 × sin(√(2.4 × CM))
  ```
  (HV: Halstead Volume, V(G): 循環的複雑度, SLOC: ソースコード行数, CM: コメント率)。スケール 0〜100; 高い値ほど保守しやすい。

---

### 2.5 試験性 (Testability)

**定義:** システム・プロダクト・コンポーネントに対するテスト基準を設定し、その基準への適合をテストによって確認できる度合い（出典: ISO/IEC 25010:2023）。

**調査観点:**
- 外部依存が依存性注入またはスタブ化可能な形で実装されているか。
- テストカバレッジが意味のある水準に達しているか、かつカバレッジが品質を保証しているか。

**設計タクティクス・パターン:**
- 依存性注入 (DI): テスト時に依存コンポーネントをモックに置換可能にする。
- ヘキサゴナルアーキテクチャ (ポート&アダプタ): ビジネスロジックをインフラから分離し、単体テストを容易にする。
- テスト駆動開発 (TDD): テストファーストにより、テスト容易な設計を誘導する。

**コードレビューチェックリスト:**
- [ ] クラス・関数に副作用がない純粋関数の割合が適切か。
- [ ] グローバル状態・シングルトンへの依存がテスト実行を干渉させないか。
- [ ] テスト用の seam (継ぎ目) が設計上確保されているか (Feathers, 2004)。

**計測指標:**
- **命令カバレッジ / 分岐カバレッジ:** テスト実行による到達命令数・分岐数の割合。
- **CBO (Coupling Between Objects):** 高結合クラスはモック化が困難で試験性を低下させる。

---

## 3. 横断的な設計戦略

### 3.1 SOLID 原則の適用

Martin (2017) が体系化した 5 原則は保守性の複数副特性を同時に向上させる:

| 原則 | 主に寄与する副特性 |
|------|------------------|
| SRP (単一責任) | モジュール性・解析性 |
| OCP (開放閉鎖) | 修正性・再利用性 |
| LSP (リスコフ置換) | 修正性・試験性 |
| ISP (インターフェース分離) | モジュール性・試験性 |
| DIP (依存性逆転) | 再利用性・試験性 |

### 3.2 継続的リファクタリング

Fowler (2018) によれば、リファクタリングとは外部的な振る舞いを維持しつつソフトウェアの内部構造を改善する手法であり、保守性を継続的に高める実践的アプローチである。主要パターン:

- **Extract Function / Method:** 長大な手続きを意図を持った名前の小関数に分割 (解析性向上)。
- **Replace Conditional with Polymorphism:** 条件分岐をポリモーフィズムに置換 (修正性向上)。
- **Introduce Parameter Object:** データ集合をオブジェクトにまとめる (再利用性向上)。

### 3.3 技術的負債の可視化と管理

Cunningham (1992) の技術的負債メタファーに基づき:

1. **負債の分類:** 意図的/非意図的、慎重/無謀の 2 軸 4 象限で分類する。
2. **負債の定量化:** コードスメルの密度・CBO・V(G) の閾値超過件数を KPI とする。
3. **返済計画:** スプリント毎に技術的負債解消タスクを割り当て、利息の複利化を防ぐ。

---

## 4. レビュー時の重点チェックリスト（要約）

| # | 確認項目 | 関連副特性 |
|---|---------|-----------|
| 1 | 循環的複雑度 V(G) ≤ 10 (関数単位) | 解析性・試験性 |
| 2 | クラス間循環依存なし | モジュール性 |
| 3 | CBO ≤ 10 | モジュール性・試験性 |
| 4 | LCOM が低い (高凝集) | 再利用性 |
| 5 | ハードコード定数の外部化 | 修正性 |
| 6 | ビジネスロジックとインフラの分離 | モジュール性・試験性 |
| 7 | 重複コード密度 < 5 % | 再利用性 |
| 8 | 関数長 ≤ 30 行 | 解析性 |
| 9 | テスト分岐カバレッジ ≥ 80 % | 試験性 |
| 10 | 技術的負債が明示的に記録・管理されているか | 修正性 |

---

## 5. アンチパターン

### 5.1 神クラス (God Class)
単一クラスがシステム全体の責務を担う。CBO・LCOM・SLOC が極端に高い。SRP 違反の典型。修正・テストが困難になり、モジュール性・試験性・解析性を一括して損なう。

### 5.2 散弾銃手術 (Shotgun Surgery)
一つの変更に対して多数のクラスに修正が必要な設計。変更影響指数が高い状態。修正性と解析性を著しく低下させる。

### 5.3 並行継承階層 (Parallel Inheritance Hierarchies)
サブクラスを追加するたびに別の継承ツリーにもサブクラスを追加しなければならない構造。再利用性・修正性の阻害要因。

### 5.4 デッドコード (Dead Code)
実行されない到達不能なコードが残存する状態。解析性を低下させ、保守者を混乱させる。

### 5.5 マジックナンバー / 文字列リテラルの埋め込み
意味不明な数値・文字列が直接コードに埋め込まれている。修正性を低下させ、変更時に見落としのリスクを高める。

### 5.6 テスト不能設計 (Untestable Design)
グローバル状態・隠れた依存性・new 演算子の直接使用などにより自動テストが実質不可能な構造。試験性の根本的欠如。

---

## 6. リファレンス

以下はすべて WebSearch により実在を確認済みの一次資料・著名な学術書である。

1. **ISO/IEC 25010:2023.** *Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model.* Geneva: ISO/IEC. https://www.iso.org/standard/78176.html

1a. **ISO/IEC 25010:2011.** *Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models.* Geneva: ISO/IEC. https://www.iso.org/standard/35733.html （旧版、参考）

2. **ISO/IEC 25023:2016.** *Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Measurement of system and software product quality.* Geneva: ISO/IEC. https://www.iso.org/standard/35747.html

3. **McCabe, T. J. (1976).** A Complexity Measure. *IEEE Transactions on Software Engineering*, SE-2(4), 308–320. https://doi.org/10.1109/TSE.1976.233837

4. **Halstead, M. H. (1977).** *Elements of Software Science.* New York: Elsevier North-Holland.

5. **Stevens, W. P., Myers, G. J., & Constantine, L. L. (1974).** Structured Design. *IBM Systems Journal*, 13(2), 115–139. https://doi.org/10.1147/sj.132.0115

6. **Parnas, D. L. (1972).** On the Criteria To Be Used in Decomposing Systems into Modules. *Communications of the ACM*, 15(12), 1053–1058. https://doi.org/10.1145/361598.361623

7. **Chidamber, S. R., & Kemerer, C. F. (1994).** A Metrics Suite for Object Oriented Design. *IEEE Transactions on Software Engineering*, 20(6), 476–493. https://doi.org/10.1109/32.295895

8. **Coleman, D., Ash, D., Lowther, B., & Oman, P. (1994).** Using Metrics to Evaluate Software System Maintainability. *IEEE Computer*, 27(8), 44–49. https://doi.org/10.1109/2.303623

9. **Cunningham, W. (1992).** The WyCash Portfolio Management System. *ACM SIGPLAN OOPS Messenger*, 4(2), 29–30. https://doi.org/10.1145/157710.157715

10. **Martin, R. C. (2017).** *Clean Architecture: A Craftsman's Guide to Software Structure and Design.* Prentice Hall. ISBN 978-0-13-449416-6.

11. **Fowler, M. (2018).** *Refactoring: Improving the Design of Existing Code* (2nd ed.). Addison-Wesley Professional. ISBN 978-0-13-475759-9.

12. **Khononov, V. (2024).** *Balancing Coupling in Software Design: Universal Design Principles for Architecting Modular Software Systems.* Addison-Wesley Professional. ISBN 978-0-13-735348-4. （結合の深掘り補論 [`07a-coupling-deep-dive.md`](./07a-coupling-deep-dive.md) を参照）
