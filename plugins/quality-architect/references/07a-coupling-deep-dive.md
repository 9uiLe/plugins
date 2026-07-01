# 07a. 結合の深掘り — Khononov『Balancing Coupling in Software Design』補論

> 本ファイルは [`07-maintainability.md`](./07-maintainability.md) §2.1 モジュール性、
> および [`08-flexibility.md`](./08-flexibility.md) §2.3 置換性 の **補論** であり、
> ISO/IEC 25010 のフレームを **上書きせず** に「結合 (coupling) を量と質の両面から扱う深掘り語彙」を提供する。
> 一次出典: **Khononov, V. (2024). _Balancing Coupling in Software Design: Universal Design Principles for Architecting Modular Software Systems._ Addison-Wesley Professional. ISBN 978-0-13-735348-4.**
> 邦訳: **島田 浩二 訳『ソフトウェア設計の結合バランス — 持続可能な成長を支えるモジュール化の原則』インプレス (impress top gear), 2025年10月. ISBN 978-4-295-02296-1.**

---

## §1. スコープと位置づけ

- **本ファイルは 25010 副特性ファイル (`07`, `08`) の補論である**。25010 の特性・副特性定義・サマリ表・しきい値（CBO ≤ 10、V(G) ≤ 10、分岐カバレッジ ≥ 80 %、重複密度 < 5 % など）は **本ファイルでは一切書き換えない**。本書由来の知見は **重大度の下方修正 (severity downgrade) の根拠** としてのみ用いる。**verdict の反転や上方修正に用いてはならない**（§9 H9 規律）。
- **25010 のバージョン前提**: 本ファイルは **ISO/IEC 25010:2023（第 2 版）** を前提とする。**JIS X 25010:2013（2011 版）** 文脈で運用される現場では、Adaptability / Replaceability が Portability 配下に、Modifiability が Maintainability 直下に配置されるため、§8 の写像表は別途 2011 版用に読み替えが必要になる。
- **本ファイルが定義する用語の権限範囲**: 「Integration Strength」「Distance」「Volatility」「BALANCE モデル」は Khononov (2024) に基づく用語。CK メトリクスの "Coupling Between Objects (CBO)"（Chidamber & Kemerer 1994）や Stevens et al. (1974) の Module Coupling とは **語が同じでも別概念** である。§2 の用語衝突回避表に従い、本文では必ず修飾語付きで表記する（例: "Khononov Integration Strength", "CK CBO", "Stevens Module Coupling"）。
- **位置づけ**: `quality-architecture` スキル (設計時) は §3〜§8 を「設計タクティクスの参考」として引用する。`quality-review` スキル (既存コード時) は §3〜§8 を「保守性・柔軟性指摘の補強リファレンス」として引用する。**ルーティングルールは 00-overview §5.1 を上書きしない**（新規入口を作らない）。

---

## §2. 用語衝突回避表（必須・最初に読む）

| 用語 | 出典 | 意味 | 計測単位 | 本ファイル中の表記 |
| --- | --- | --- | --- | --- |
| Coupling (CK CBO) | Chidamber & Kemerer (1994) | クラスが依存する他クラス数 | クラス | **"CK CBO"** または **"CBO"** |
| Coupling (Stevens Module Coupling) | Stevens, Myers & Constantine (1974) | モジュール対が共有するシグナルの種類（6 ラダー） | モジュール対 | **"Stevens Module Coupling"** |
| Coupling-Balance (Khononov Integration Strength × Distance × Volatility) | Khononov (2024) | 部品間 lattice の品質モデル | 多次元・部品対 | **"Khononov Integration Strength"**（"Strength" のみは禁止） |
| Adaptability (ISO/IEC 25010:2023 §8 副特性) | ISO/IEC 25010:2023 | 異なる環境への適応容易性 | 設計属性 | **"25010 Adaptability"** |
| Adaptability (Khononov informal) | Khononov (2024) | volatility に追随できるモジュール分解 | 設計属性 | **"volatility-aligned decomposition"**（25010 Adaptability との混同回避のため改名表記） |

**この 3 つの "Coupling" は集約不能である**: CBO スコアが低くても Stevens Module Coupling が Content レベル（最悪）なら結合は悪い。逆に CBO が高くても Khononov Integration Strength が Contract レベル（最良）なら結合は健全な可能性がある。**スコアの単純集計・平均化を禁ずる**。

---

## §3. Integration Strength（Khononov, Ch.7）— 4 段階ラダー

「**Integration Strength** は 2 つのコンポーネントが共有する知識の量を表す」。共有知識が多いほど、片方の変更が他方に伝播する可能性が高い（Khononov 2024, Ch.7）。

### §3.1 ラダー定義（強→弱）

| 段階 | 共有される対象 | 影響範囲 | 典型例 |
| --- | --- | --- | --- |
| **1. Intrusive Coupling** | 私的・内部実装（公開コントラクトを介さない） | 任意の内部変更が破壊 | 内部 DB スキーマ・private API への直接アクセス、リフレクション利用、内部状態の reach-in |
| **2. Functional Coupling** | 機能要件・ビジネスロジックの重複 | 仕様変更が両側に同時修正を要求 | 同じ業務ルールの並走実装、重複した計算ロジック |
| **3. Model Coupling** | ドメインモデル（型・概念）の共有（ロジックは非共有） | モデルの破壊的変更が伝播 | 共有 DTO 型、共通ドメインオブジェクトの参照 |
| **4. Contract Coupling** | 明示的コントラクト（インターフェース / API スキーマ）のみ | コントラクト互換であれば内部変更が伝播しない | OpenAPI 経由、メッセージスキーマ経由、純粋なインターフェース呼び出し |

出典: coupling.dev の関連解説 ([Integration Strength](https://coupling.dev/posts/dimensions-of-coupling/integration-strength/)) は上記 4 段階を Khononov 2024 Ch.7 由来として明記。

### §3.2 重要な引用規律

- **Integration Strength 段を断定する場合、その判定根拠となる "shared element"（共有された具体的シンボル / 型名 / コントラクトパス）を同段落内に併記すること**（§9 H3）。共有要素を示さない断定は禁則。
- **Robert C. Martin の Instability `I = Ce / (Ce + Ca)` を Khononov Integration Strength の代理として引用してはならない**。Khononov 2024 は依存を「数える」アプローチ自体を "Dependencies, like words, should be weighed, not counted" として **名指しで否定** している（出典: [coupling.dev/posts/core-concepts/balance/](https://coupling.dev/posts/core-concepts/balance/)）。§9 H2 規律参照。

### §3.3 段は抽象化レベルに相対的（Khononov 2024, Ch.12 §12.4）

- Integration Strength の 4 段は **絶対的ではなく、観測する抽象化レベルに対して相対的** である（Khononov 2024, Ch.12「ソフトウェア設計のフラクタル幾何学的性質」§12.4「フラクタルモジュール性」, 邦訳 p.222）。あるレベルでの Contract Coupling は、より高い抽象化レベルでは Implementation (Intrusive) Coupling と見なされうる。
- 書籍の例（邦訳 p.222 趣意）: あるオブジェクトの公開インターフェースは、**マイクロサービス境界を越えて公開されない限り**、別のマイクロサービスから見れば実装詳細（Intrusive 相当）に当たる。同様にマイクロサービスの Contract Coupling は、まったく別のシステムから見れば Implementation Coupling と見なせる。
- **運用含意**: SIGNAL から段の候補を絞る際（§6.5 hint table）は、**どの抽象化レベル（`module_unit:`）で評価しているかを併記** する。同じ共有要素でも評価レベルが変われば段が変わりうるため、H3 の shared element 併記に加えて評価レベルの明示が要る。

---

## §4. Distance（Khononov, Ch.8）— 5 段階

「**Distance** は 2 つのコンポーネントが共有する実行環境・カプセル化境界の遠さを表す。距離が大きいほど、片方の変更を他方に伝播させるコストが大きい」（Khononov 2024, Ch.8）。

### §4.1 ラダー定義（近→遠）

| 段階 | 境界 | 典型例 |
| --- | --- | --- |
| **1. Methods** | 同一クラス/型内のメソッド間 | 同一クラス内の helper |
| **2. Objects** | 同一名前空間内の異オブジェクト間 | 同一モジュール内の class A → class B |
| **3. Namespaces / Packages** | 同一サービス内の異名前空間 | `domain.order` → `domain.payment` |
| **4. (Micro)Services** | 異サービス間（公式表記はカッコ付き） | Order Service → Payment Service |
| **5. Systems** | 異システム間（多くの場合、組織境界を跨ぐ） | 自社サービス → 外部 SaaS |

**公式表記**: 第 4 段は **"(Micro)Services"**（カッコ付き）であり、"Microservices" と単独表記しない（出典: [coupling.dev/posts/related-topics/distance/](https://coupling.dev/posts/related-topics/distance/)）。

**書籍の距離スペクトル（図 8.2 / 8.3 / 8.4, Ch.8, 邦訳 p.148 / p.149 / p.152）**: 書籍は Distance を連続軸として描き、上記 5 段より細かい例示点を置く:
**文 (statement) → メソッド → オブジェクト → 名前空間・パッケージ → ライブラリ → (マイクロ)サービス → システム**。
すなわち本表 5 段の下に **文 (statement)** が、第 3 段（名前空間・パッケージ）と第 4 段（(マイクロ)サービス）の間に **ライブラリ (library)** が例示される。

- 本ファイルは coupling.dev 由来の **5 段ラダーを正式段** として維持する（ツールの段写像もこれに従う）。文 / ライブラリ は段間を埋める **例示点** であり、Ch.8 本文がこれらを名前付き段として定義しているかは別途確認対象（今回確認した §8.1.2 / §8.2 の範囲では未定義）。
- **ツール写像への含意**: `distance-level` SIGNAL（`scripts/coupling-gate-swift.sh`）は外部 product 依存を「ライブラリ」相当とみなすが、現行実装はこれを保守的に **段 4（(マイクロ)サービス）へ丸めている**（遠側）。より細かい「ライブラリ」サブレベルが必要なら運用側で補間する。
- 図 8.3 は **距離 ∝ ライフサイクル結合の逆数**（§8.1.2「ライフサイクル結合としての距離」, p.149）、図 8.4 は 距離が 変更コスト（正比例）と ライフサイクル結合（反比例）の双方に効くことを示す（§8.2, p.152）。§4.2（訂正版: 変更コストは比例 / ライフサイクル結合は反比例）参照。

### §4.2 補助概念

- **Socio-Technical Distance**: 「コンポーネントを所有する人/チームの距離」を表す追加要素（"Additional Factors Affecting Distance"）。これは **Distance のラダーとは別軸** として扱う。Conway's Law と密接。本ファイルでは「判断のみ」項目として §9 で扱う。
- **距離と変更コスト／ライフサイクル結合の関係（書籍原典確認済み）**:
  - **変更コストは距離に比例する（直接比例）**。距離が遠いほど連鎖的変更のコストが増す（Khononov 2024, Ch.8 図 8.2 / 本文, 邦訳 p.148:「結合されたコンポーネントの変更コストが、それらの距離に比例する」）。§4 冒頭の「距離が大きいほどコストが大きい」と整合。
  - **ライフサイクル結合は距離に反比例する**。距離が近いほど同時に実装・テスト・デプロイされやすい（Ch.8 §8.1.2 図 8.3, p.149:「コンポーネント間の距離はライフサイクル結合に反比例する」）。
  - ⚠️ **訂正記録**: 旧版は「変更コストは距離に反比例 (inversely proportional)」と記していたが、これは原典（図 8.2 / p.148）および §4 冒頭に反する **誤記**。反比例するのは **ライフサイクル結合**（図 8.3）であって、変更コストは **比例** する。本版で訂正。
- **Distance も抽象化レベルに相対的**（Khononov 2024, Ch.12 §12.4, 邦訳 p.222）: 例えば異なる言語の標準ライブラリ同士は「遠い」と見なされうるが、サービスレベルなど上位の抽象化で見ると「距離」のスケールは変化する。`module_unit:` 宣言（§4.3 / H4）は **どの抽象化レベルで距離を測るか** の宣言でもある（§3.3 の Strength 相対性と対をなす）。

### §4.3 引用規律

- **`distance_level` を断定する場合、`module_unit:` （モジュール単位の宣言）が明示されていることを併記する**（§9 H4）。`module_unit:` 未宣言の場合は `distance basis: path-depth fallback` ラベルを併記し、決定論性が部分的であることを明示する。

---

## §5. Volatility（Khononov, Ch.9）— 変更確率

「**Volatility** はコンポーネントが将来変更される確率を表す。変更されない（または変更されにくい）コンポーネントへの結合は安価で、頻繁に変更されるコンポーネントへの結合は高価である」（Khononov 2024, Ch.9）。

### §5.1 DDD サブドメイン写像（Khononov による）

| サブドメイン | Volatility | 解釈 |
| --- | --- | --- |
| Core | 最も高い | 競合優位の源泉。頻繁に変更される。 |
| Supporting | 中程度 | 業務固有だが変更頻度は中。 |
| Generic | 最も低い | 汎用機能。長期的に安定。 |

### §5.2 Essential vs Accidental Volatility（Brooks 風区別）

- **Essential Volatility**: 業務 / ドメイン由来の変更圧力（避けられない）。
- **Accidental Volatility**: 設計判断の結果として生じる変更圧力（取り除ける）。
- 設計判断の対象は **accidental volatility の削減** であって、essential volatility そのものを抑えようとしてはならない。

### §5.3 観測値としての Volatility（Phase 2 シグナル化）

- 実装計測は VCS の co-change / churn による近似となる（観測ウィンドウ依存）。
- 本ファイルでは観測ウィンドウ付き計測値を **`observed_change_frequency`** と呼び、これを Khononov Volatility の **proxy（近似指標）** として扱う。
- proxy 由来の BALANCE 判定には **`推測` ラベルを必ず付与**する（§9 H5、H6）。
- **計測には `--since=<window>` を本文に必ず併記する**。windowless な churn 値は引用禁止（§9 H5）。

---

## §6. BALANCE モデル（Khononov, Ch.10-11）

### §6.1 公式論理モデル（書籍本文 verbatim 確認済み）

Khononov 2024 本文（§10.2「強度、距離、変動性の組み合わせ」）に明示される論理モデル。
**邦訳本文 verbatim**（島田訳, p.181 / p.183）:

```
モジュール性  = 強度 XOR 距離                       (Modularity)
複雑性        = NOT モジュール性 = NOT (強度 XOR 距離) (Complexity)
局所的複雑性  = NOT 強度 AND NOT 距離               (Local complexity)
大域的複雑性  = 強度 AND 距離                        (Global complexity)
均衡度        = (強度 XOR 距離) OR NOT 変動性         (Balance, §10.2.2 p.183)
```

英語表記（本ファイルの canonical 表現）:

```
MODULARITY        = STRENGTH XOR DISTANCE
COMPLEXITY        = NOT MODULARITY
LOCAL COMPLEXITY  = NOT STRENGTH AND NOT DISTANCE
GLOBAL COMPLEXITY = STRENGTH AND DISTANCE
BALANCE           = (STRENGTH XOR DISTANCE) OR NOT VOLATILITY
```

出典: Khononov (2024), Ch.10 §10.2 / §10.2.2（邦訳 島田訳 p.181, p.183）で **verbatim 確認済み**。
二次解説: [coupling.dev/posts/core-concepts/balance/](https://coupling.dev/posts/core-concepts/balance/)。

**注（旧記載の訂正）**: 旧 07a は `COMPLEXITY = STRENGTH AND DISTANCE` と 1 行で記していたが、
書籍は **局所的複雑性 (`NOT S AND NOT D`)** と **大域的複雑性 (`S AND D`)** を区別する。本ファイルの
canonical はこの区別を反映する（`COMPLEXITY = NOT MODULARITY` が総体、`S AND D` は大域的のみ）。

**読み方**:
- 強い結合 (high strength) と長い距離 (high distance) が **両立** すると complexity が爆発する。
- 強い結合と短い距離、または弱い結合と長い距離なら modularity が成立する（XOR）。
- volatility が低ければ（変更されないなら）両方が成立しなくても許容される（NOT VOLATILITY による緩和）。

### §6.2 「Pain 式」に関する注意（重要・書籍確認済み）

「`Pain = Strength × Distance × Volatility`」の乗算形は **書籍本文に verbatim 存在する**。
邦訳（島田訳, Ch.10 §10.2.1, p.182）では:

> メンテナンスの労力 ＝ 強度 ＊ 距離 ＊ 変動性

（"Pain" は邦訳で「メンテナンスの労力」と訳出。乗算記号は ＊）。

**ただし、書籍自身が以下の 2 つの重大な留保を付けている**:

1. **2 値スケール前提**（脚注 ※2, p.182）: 「私は依然として 2 値スケールを想定している。各次元で許可される
   値は 高 (1) と 低 (0) である」。連続値ではない。本文は例として
   `0 ＊ 1 ＊ 1 ＝ 0`, `1 ＊ 0 ＊ 1 ＝ 0`, `1 ＊ 1 ＊ 0 ＝ 0`（いずれかの次元が 0 なら痛みは 0）を挙げる。
2. **「正確な科学ではない」警告**（§10.3, p.184）: 「警告：これは正確な科学ではない」。結合の 3 次元は
   「定義上 主観的」であり、同一数値スケールへの定量化には本質的な課題があると明記する。

そのため本ファイルでは:
- **Khononov 2024 の canonical 第一表現は §6.1 の論理モデル (XOR/AND/NOT)** とする（こちらも書籍 verbatim）。
- **`Pain = S × D × V` 形を「連続値の精密メトリクス」として提示してはならない**。引用する場合は
  必ず (1) 2 値スケール前提（高=1/低=0）と (2) §10.3 の「正確な科学ではない」警告 を併記する（§9 H2 規律）。
- 2 値スケールでの `S ＊ D ＊ V ＝ 0`（痛みなし）は §6.1 の `均衡度 = (強度 XOR 距離) OR NOT 変動性 = 高`
  と整合する。本ファイルは均衡度（BALANCE）論理モデルを第一表現として用いる。

### §6.3 Rebalancing 戦略（Ch.11）

- **Strength を下げる**: Intrusive → Functional → Model → Contract に再設計（公開コントラクト導入、内部依存除去）。
- **Distance を縮める**: モジュール / サービス境界を再編し、結合の強い 2 部品を同一境界内に寄せる。
- **Volatility を下げる**: 安定化（API を凍結する、変更頻度の高い部分を抽出する）。
- BALANCE = TRUE になるまで、3 次元のうち最も改修コストの低い軸から調整する。

#### §6.3.1 削減アクション・カタログ（運用補助・本リポジトリ合成）

> 位置づけ: §6.3 の 3 軸（Khononov 2024, Ch.11）を「指摘に添える具体的アクション」へ運用化した **本リポジトリ独自の catalog** である（§6.5 と同じく Khononov 2024 の verbatim ではない。出典として引用する場合は 3 軸の考え方のみ Ch.11 に帰属させること）。**severity・PASS/FAIL 判定には一切影響しない**（H9: 本 catalog は推奨の内容であって判定入力ではない）。

| 検出状況（例） | 下げる軸 | 具体的アクション例 |
| --- | --- | --- |
| Intrusive Coupling（内部実装への依存、リフレクション、private 相当への到達） | Strength | 依存先の公開 API / 明示コントラクトのみを使うよう書き換え。必要な機能が公開されていなければ依存先に API 追加を提案（Intrusive → Functional 以下へ） |
| Functional Coupling（業務ロジック・業務シーケンスの境界跨ぎ共有、cross-boundary duplicates） | Strength または Distance | 重複ロジックをどちらか一方の境界へ集約し他方はコントラクト経由で呼ぶ。または 2 部品を同一境界内へ移設（Distance 短縮） |
| Model Coupling（ドメインモデル型の境界跨ぎ共有） | Strength | 境界専用の DTO / integration-specific model を導入し、内部モデルを非公開化（Model → Contract） |
| 大域的複雑性（強 Strength × 遠 Distance、§6.1 `S AND D`） | どちらか一方 | XOR を成立させる: 強く結合したままなら同一境界へ寄せる（Distance↓）、遠いまま保つなら Contract 化（Strength↓）。両方同時に着手しない（改修コストの低い軸から） |
| 局所的複雑性（弱 Strength × 近 Distance の部品が過剰分割で散在、§6.1 `NOT S AND NOT D`） | Distance（構成整理） | 過剰分割を統合し境界数を減らす。§6.4 の通り「さらに疎結合化」は逆効果（distributed monolith） |
| 高 Volatility の結合先（Core サブドメイン等）への強依存 | Volatility（隔離） | 変更頻度の高い部分を安定インターフェースの背後に抽出・隔離（accidental volatility のみ削減対象。essential は設計では消えない、§5.2） |

**アクション提示の書式**（指摘・設計成果物に添える 1〜2 行）:

```
削減アクション: <軸: Strength|Distance|Volatility>を下げる — <上表から選んだ具体的手順>（Khononov 2024, Ch.11）
期待効果: BALANCE = (STRENGTH XOR DISTANCE) OR NOT VOLATILITY が <FALSE→TRUE になる理由 1 文>
```

### §6.4 「Decouple everything は誤り」原則

Khononov 2024 は「decouple everything」アプローチを **明示的に否定** する。過剰な疎結合は distributed monolith を生み、Distance だけが伸びて Strength が下がらない反パターンとなる（出典: coupling.dev/posts/core-concepts/balance/）。

### §6.5 SIGNAL → Integration Strength 候補絞り込みヒント — Hint Table (Phase 2 / experimental)

> ⚠️ **EXPERIMENTAL（実験的）**: 本 §6.5 は Phase 2 試作の **experimental layer** であり、`deterministic:` でも安定した `planned-deterministic:` でもない。本 table は Khononov 2024 本書に verbatim 出現せず、本リポジトリが §6.1 BALANCE 論理モデルと §3 Integration Strength 定義から **合成した運用補助** である。**Khononov 2024 出典として引用してはならない**。
>
> 🚫 **本 table は段を「確定」しない。候補を絞り込む「ヒント」に過ぎない**。SIGNAL は静的計測値であり、Integration Strength 段の確定（特に「DTO 専用か / ドメインロジック付きか」「公開コントラクト経由か」の意味的判別）は **本質的にレビュアの判断を要する**（07a §3.2 / §9 H3、static-evaluation §3.6.4 で Strength 段は「判断のみ」に分類）。Khononov 2024 の中心原則 **"Dependencies, like words, should be weighed, not counted"** に従い、本 table が出す候補を SIGNAL の数値だけで段に固定することを禁ずる。

`quality-gates.yml` の `swift.planned-deterministic.coupling:`（**experimental ブロック**）で計測される SIGNAL から、
Integration Strength ラダー段（Intrusive / Functional / Model / Contract）の **候補を絞り込む** ための hint table。
本 table は **共有要素併記が成立している場合に限り、候補提示の参考として利用可能**（H3 規律。`(symbol|type|contract-path)` を併記しない断定は禁則）。

#### §6.5.1 Hint Table（上から優先順 / 出力は「候補」であって「確定」ではない）

| 優先順位 | 条件（SIGNAL ベース） | 候補 Integration Strength（確定不可・要レビュア判断） | severity 入力（**下方修正のみ**, H9） | BALANCE 含意 |
| --- | --- | --- | --- | --- |
| **1（先頭固定 override）** | `intrusive_hits > 0` | **Intrusive Coupling** | critical / high | **常に FAIL**。Distance / Volatility がいかに良くても override される |
| 2 | `cross_boundary_duplicates > 0` **OR** `shared_model_surface` 内で **public API かつドメインロジック付き型** が境界跨ぎ参照されている | **Functional Coupling** | high / medium | Strength=High。Distance×Volatility との XOR 判定対象 |
| 3 | `shared_model_surface` 内で **DTO 専用** の型が境界跨ぎ参照されている（ロジック非共有） | **Model Coupling** | medium / info | Strength=Mid |
| 4 | 境界跨ぎは **`contract_layer_present = true`**（OpenAPI / Protobuf / 明示インターフェース）経由のみ。共有モデル型なし、duplicates=0、intrusive_hits=0 | **Contract Coupling** | info | Strength=Low。BALANCE 達成しやすい |

#### §6.5.2 適用ルール（厳守）

- **共有要素（shared element）併記必須**: 割当を断定する箇所には `(symbol: <name>) / (type: <FQN>) / (contract: <path>)` のいずれかを直近 5 行以内に併記すること。違反時は割当を **`推測` ラベル付き** に格下げする（H3）。
- **`intrusive_hits > 0` の override は無条件**: Distance が 1（Methods 内）であっても、Volatility が「stable」であっても、`intrusive_hits > 0` であれば BALANCE = FALSE が確定する（07a §3 H3 連動）。
- **module_unit 未宣言時の制限**: `module_unit:` が `quality-gates.yml` で宣言されていない場合、Distance に依存する条件（優先順位 2 の「境界跨ぎ」判定）は **`distance basis: path-depth fallback` ラベル付き** で出力する（H4）。
- **観測ウィンドウ必須**: Volatility 系シグナル（`observed_change_frequency`）を判定根拠に用いる場合、`--since=<window>` を直近 5 行以内に併記する（H5）。
- **hint table の出力は段の「確定」ではなく「候補（recommendation）」**: 共有要素の意味的判別（DTO か否か、ドメインロジック付きか）はレビュアの判断を必要とする。本 table は **「段の候補を絞り込むための experimental な入力」** であって「段そのものの確定」ではない（07a §3 H3 規律、static-evaluation §3.6.4 で Strength 段は「判断のみ」）。出力を段に固定する場合は必ずレビュアが共有要素を確認し、`推測` ラベルを併記する。

#### §6.5.3 BALANCE 適用順序（intrusive override 句先頭固定）

> 下記擬似コードは experimental な運用イメージであり、`STRENGTH_LEVEL` は hint table が出す**候補**をレビュアが確定した後の値を指す（SIGNAL から自動確定しない）。

```
IF intrusive_hits > 0:
    BALANCE = FALSE  (Intrusive override; rebalance: Strength を下げる)
ELSE:
    STRENGTH_LEVEL  = hint_table(SIGNAL inputs) → reviewer confirms  -- 上記 §6.5.1（候補→人手確定）
    DISTANCE_LEVEL  = swift package describe 由来 (module_unit 宣言下)
    VOLATILITY_BAND = observed_change_frequency / --since=<window>
    BALANCE = (STRENGTH_LEVEL XOR DISTANCE_LEVEL) OR NOT VOLATILITY_BAND
              -- 07a §6.1 canonical 表現
ENDIF
```

**運用注意**: 本 §6.5 の table は Phase 2 試作段階の **experimental な hint support**（候補絞り込み補助）であり、Khononov 2024 本書中に同等の table が verbatim 出現するわけではない。本 table は coupling.dev で明示される BALANCE 論理モデル（§6.1）と Integration Strength 4 段定義（§3）を運用化するために本リポジトリで合成したものである。**Khononov 2024 出典として引用してはならない**。本リポジトリ独自の experimental 運用 layer として明示する。`deterministic:` への昇格は static-evaluation §3.6.4 の 3 条件（pinned コマンド・固定パーサー・閾値根拠）が揃い、かつ Strength 段の意味的判別が自動化された場合に限る（現時点では未達）。

### §6.6 BALANCE モデルの自己相似性（Khononov 2024, Ch.12 §12.4）

- 均衡結合モデル（§6.1）は **すべての抽象化レベルに自己相似的（フラクタル的）に適用** できる（Khononov 2024, Ch.12「ソフトウェア設計のフラクタル幾何学的性質」§12.4「フラクタルモジュール性」, 邦訳 p.222: 「均衡結合モデルは、すべての抽象化レベルで、コンポーネントの相互作用の設計を評価するために適用できる」）。メソッド間でも、サービス間でも、システム間でも同じ XOR/AND/NOT 論理（§6.1）で結合を評価する。
- このため §3（Strength）・§4（Distance）の段は固定ラベルではなく **評価レベルに応じた相対量** として読む（§3.3 / §4.2）。hint table（§6.5）で候補を絞る際は `module_unit:` がどのレベルかを必ず併記する。
- **H2 連動の注意**: 自己相似性は「結合評価の論理が全レベルで同形」という意味である。Ch.12 が観察する「相互作用数が要素数に対し super-linear（図 12.5: `n(n-1)/2`）に増える」ことを **精密なべき乗則メトリクスとして引用してはならない**（`M = S^D` 形は書籍に存在しない。§10 確認済み）。§10.3「これは正確な科学ではない」留保は Ch.12 にも及ぶ。

---

## §7. 古典タクソノミー（補論）

Khononov 2024 は古典理論を Ch.5 と Ch.6 で取り込み直しており、両者を併用すべきである。

### §7.1 Stevens Module Coupling（Stevens, Myers & Constantine 1974, Ch.5）

強い順:

1. **Content Coupling**: 他モジュールの内部にアクセス
2. **Common Coupling**: グローバル変数の共有
3. **External Coupling**: 外部フォーマット・プロトコルへの依存
4. **Control Coupling**: 制御フラグの受け渡し
5. **Stamp Coupling**: 必要以上の構造体共有
6. **Data Coupling**: 必要最小限のパラメータのみ受け渡し（最良）

原典: Stevens, W. P., Myers, G. J., & Constantine, L. L. (1974). Structured Design. *IBM Systems Journal*, 13(2), 115–139. https://doi.org/10.1147/sj.132.0115

二次解説: [coupling.dev/posts/related-topics/module-coupling/](https://coupling.dev/posts/related-topics/module-coupling/)

### §7.2 Page-Jones Connascence（Khononov 2024, Ch.6）

**静的 Connascence**（弱→強）:

| 略号 | 名称 | 内容 |
| --- | --- | --- |
| CoN | Connascence of Name | 同じ名前への合意 |
| CoT | Connascence of Type | 同じ型への合意 |
| CoM | Connascence of Meaning | 同じ意味（マジック値）への合意 |
| CoP | Connascence of Position | 同じ位置（引数順序）への合意 |
| CoA | Connascence of Algorithm | 同じアルゴリズムへの合意 |

**動的 Connascence**（弱→強。動的は常に静的より強い）:

| 略号 | 名称 | 内容 |
| --- | --- | --- |
| CoE | Connascence of Execution | 実行順序 |
| CoTi | Connascence of Timing | タイミング |
| CoV | Connascence of Value | 実行時の値 |
| CoI | Connascence of Identity | 同一インスタンス参照 |

**三性質** (Page-Jones, 1996):
- **Strength**: 検出と保守のコスト
- **Locality**: 距離（カプセル化境界）
- **Degree**: 影響範囲のサイズ

**Rule of Locality**（Weirich による要約）: 距離が縮まるほど、強い結合形態が許容される（同じ関数内なら CoP も問題にならない）。

原典:
- Page-Jones, M. (1992). Comparing Techniques by Means of Encapsulation and Connascence. *Communications of the ACM*, 35(9), 147–151. https://doi.org/10.1145/130994.131004
- Page-Jones, M. (1996). *What Every Programmer Should Know About Object-Oriented Design.* Dorset House. ISBN 978-0-932633-31-9.

二次参照（**定義参照のみ可、推奨根拠としては不可** — §9 H7）:
- [connascence.io](https://connascence.io) （community wiki）

---

## §8. ISO/IEC 25010:2023 副特性写像

| Khononov 概念 | 25010:2023 副特性 | 寄与方向 |
| --- | --- | --- |
| Integration Strength（低い） | 07 Modularity | 直接寄与 |
| Distance（適切） | 07 Modifiability, 07 Analysability | 直接寄与 |
| Volatility 認識 | 07 Modifiability, 08 Adaptability | 設計予測能力に寄与 |
| Contract Coupling | 08 Replaceability | 直接寄与 |
| Connascence（静的・弱い） | 07 Modularity, 07 Testability | 直接寄与 |
| BALANCE 達成 | 07 全副特性, 08 Adaptability | 統合的寄与 |
| Stevens Module Coupling（Data まで弱い） | 07 Modularity | 直接寄与 |
| Khononov の **volatility-aligned decomposition** | 25010 Adaptability の操作的補強 | 補強的寄与（用語衝突注意） |

**2011 版（JIS X 25010:2013）運用時の読み替え**:
- 25010:2023 の Adaptability / Replaceability は 2011 版では Portability の副特性に配置される。
- 25010:2023 の Modifiability は 2011 版でも Maintainability 直下。
- 本ファイルの「07」「08」言及は 2023 版前提なので、2011 版運用時は対応する 2011 副特性に読み替えること。

---

## §9. やってはいけないこと（H1〜H10 規律）

本ファイルおよび本ファイルを引用するスキル出力で必ず守るべき規律。**grep で機械検証可能な形** にしてある。

### H1. verbatim 引用の章節指定
- 07a §3〜§6 で Khononov 概念を引用するとき、**章番号（Ch.7 / Ch.8 / Ch.9 / Ch.10）を必ず併記**する。「Khononov の Integration Strength」のような章指定なし参照は引用根拠として弱い。

### H2. Pain 式・Instability 代理の禁則
- ⚠️ `Pain = Strength × Distance × Volatility`（邦訳「メンテナンスの労力 ＝ 強度 ＊ 距離 ＊ 変動性」）は
  **書籍本文 verbatim 存在**（Ch.10 §10.2.1, 邦訳 p.182）。ただし書籍自身が **2 値スケール前提**（脚注 ※2: 高=1/低=0）と
  **「正確な科学ではない」警告**（§10.3, p.184）を付している。
- ❌ Pain 式を **連続値の精密メトリクス** として提示すること、または上記 2 留保を併記せずに引用することは禁則。
  引用時は (1) 2 値スケール前提 と (2)「正確な科学ではない」警告 を必ず併記する。canonical 第一表現は §6.1 の
  XOR/AND/NOT 論理モデル（こちらも書籍 verbatim, §10.2 / §10.2.2, p.181 / p.183）。
- ❌ Robert C. Martin の Instability `I = Ce / (Ce + Ca)` を Khononov Integration Strength の代理として引用すること。Khononov は依存をカウントするアプローチを名指しで否定している（"Dependencies, like words, should be weighed, not counted"）。

### H3. Integration Strength の shared element 併記
- Integration Strength 段（Intrusive / Functional / Model / Contract のいずれか）を断定する場合、**共有要素の具体名**（シンボル名・型名・コントラクトパス）を **直近 5 行以内** に併記する。
- 共有要素を示さない断定は禁則。**違反時は `推測` ラベルを自動付与する**。

### H4. distance_level 確定条件
- `distance_level` を 1〜5 のいずれかに確定する場合、**`module_unit:` 宣言が明示されていることを併記**する。
- 未宣言時は **`distance basis: path-depth fallback`** ラベルを併記し、決定論性が部分的であることを明示する。

### H5. volatility 観測ウィンドウ必須
- volatility 数値（`observed_change_frequency` 等）を引用する場合、**`--since=<window>`（または同等の観測ウィンドウ表記）を本文に必ず併記**する。
- windowless な churn 値の引用は禁則。

### H6. 動的 Connascence の静的シグナル断定禁止
- 動的 Connascence（CoE / CoTi / CoV / CoI）を **静的シグナルのみで断定してはならない**。
- 動的検証（実行プロファイル / ログ分析 / 並行性解析ツール）への参照を併記し、必ず **`推測` ラベル** を付与する。

### H7. citation surface の制限
- 本ファイルおよび引用元の §10 References に列挙された **学術論文・公式文書のみ** を根拠引用に用いる。
- **coupling.dev / connascence.io は「定義参照のみ可、推奨根拠としては不可」**。「これは Khononov 2024 由来の概念である」と書く目的での参照は可。「したがって X を採用すべき」と書く根拠としての引用は不可（quality-architecture §3 の citation discipline と整合）。

### H8. 25010 バージョン明示
- 本ファイルを引用する出力では、**25010 のバージョン（2011 / 2023）を冒頭で明示**する。本ファイルは 2023 版前提。2011 版運用時は §8 の写像表を読み替える。

### H9. 既存しきい値の片方向ルール
- 既存 `07-maintainability.md` および `08-flexibility.md` の **しきい値・PASS/FAIL 判定を本ファイル由来の知見で上書きしてはならない**。
- 本ファイルが寄与できるのは **重大度の下方修正 (severity downgrade) のみ**。verdict 反転や severity 上方修正には用いない。
- 例: 07-maintainability で `CBO=15` が `High` 判定された場合、本ファイルの BALANCE モデルで「短い Distance + 低い Volatility なので balanced」と評価できれば **`Medium` に下げる根拠** にはなる。逆に CBO=8（PASS）を本ファイル由来で `High` に上げることは禁則。

### H10. Pain 言及時の sandwich rule
- 「pain」「balance」「結合の苦痛」等の表現を本文中で使う場合、**同段落内に §6.1 の canonical 表現（XOR/AND/NOT）を併記**する。
- Pain 式の単独引用は禁則（H2 と連動）。

---

## §10. References（学術・公式のみ）

以下は WebSearch / WebFetch により実在を確認済みの一次資料・著名な学術書である。**citation surface は本表のみ**（H7 規律）。

1. **Khononov, V. (2024).** *Balancing Coupling in Software Design: Universal Design Principles for Architecting Modular Software Systems.* Addison-Wesley Professional. ISBN 978-0-13-735348-4. Product page: https://www.informit.com/store/balancing-coupling-in-software-design-universal-design-9780137353484
   - 邦訳: 島田 浩二 訳『ソフトウェア設計の結合バランス — 持続可能な成長を支えるモジュール化の原則』インプレス (impress top gear), **2025 年 10 月 21 日 初版第 1 刷発行**（奥付確認済み）. ISBN 978-4-295-02296-1. https://www.kinokuniya.co.jp/f/dsg-01-9784295022961

2. **Stevens, W. P., Myers, G. J., & Constantine, L. L. (1974).** Structured Design. *IBM Systems Journal*, 13(2), 115–139. https://doi.org/10.1147/sj.132.0115

3. **Page-Jones, M. (1992).** Comparing Techniques by Means of Encapsulation and Connascence. *Communications of the ACM*, 35(9), 147–151. https://doi.org/10.1145/130994.131004

4. **Page-Jones, M. (1996).** *What Every Programmer Should Know About Object-Oriented Design.* Dorset House. ISBN 978-0-932633-31-9.

5. **Parnas, D. L. (1972).** On the Criteria To Be Used in Decomposing Systems into Modules. *Communications of the ACM*, 15(12), 1053–1058. https://doi.org/10.1145/361598.361623

6. **Chidamber, S. R., & Kemerer, C. F. (1994).** A Metrics Suite for Object Oriented Design. *IEEE Transactions on Software Engineering*, 20(6), 476–493. https://doi.org/10.1109/32.295895

7. **Martin, R. C. (2017).** *Clean Architecture: A Craftsman's Guide to Software Structure and Design.* Prentice Hall. ISBN 978-0-13-449416-6. （Instability 公式 `I = Ce / (Ce + Ca)` の出典 — 本ファイルは Khononov 2024 が同公式を Strength 代理として用いることを批判している事実を参照する目的でのみ引用する）

8. **Snowden, D. J., & Boone, M. E. (2007).** A Leader's Framework for Decision Making. *Harvard Business Review*, 85(11), 68–76. https://hbr.org/2007/11/a-leaders-framework-for-decision-making （Cynefin 一次出典 — Khononov 2024 Ch.2 で参照）

9. **International Organization for Standardization (2023).** *ISO/IEC 25010:2023 — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model.* https://www.iso.org/standard/78176.html （本ファイルの 25010 副特性写像 §8 の前提）

**二次参考（H7 規律により定義参照のみ可、推奨根拠としては不可）**:

- coupling.dev. *Dimensions of Coupling.* Vlad Khononov's blog. https://coupling.dev/posts/core-concepts/balance/ , https://coupling.dev/posts/dimensions-of-coupling/integration-strength/ , https://coupling.dev/posts/related-topics/distance/ , https://coupling.dev/posts/related-topics/module-coupling/
- connascence.io. Community wiki. https://connascence.io

**書籍原典確認済み（邦訳 島田訳, 2025-10-21 初版第 1 刷, ISBN 978-4-295-02296-1）**:
- 「`Pain = Strength × Distance × Volatility`」=「メンテナンスの労力 ＝ 強度 ＊ 距離 ＊ 変動性」は **本文 verbatim 存在**（Ch.10 §10.2.1, p.182）。
  ただし 2 値スケール前提（脚注 ※2, p.182: 高=1/低=0）+「正確な科学ではない」警告（§10.3, p.184）付き。§6.2 / §9 H2 に反映済み。
- 論理モデル（モジュール性 ＝ 強度 XOR 距離 / 大域的複雑性 ＝ 強度 AND 距離 / 均衡度 ＝ (強度 XOR 距離) OR NOT 変動性）は
  本文 verbatim（§10.2 p.181, §10.2.2 p.183）。§6.1 に反映済み（局所的/大域的複雑性の区別を含む）。
- 「精緻な数学モデル」（coupling.dev が言及）について: 書籍の数式的内容は上記の論理モデル + 2 値スケール乗算式であり、
  §10.3 が明示的に「正確な科学ではない」「定義上 主観的」と留保する。**coupling.dev が示唆する厳密な数学モデルに相当する形は
  本書には存在しない**（本書は厳密化を意図的に避けている）。
- **結合 3 次元の数値閾値は存在しない**: 第 7 章（図 7.14, p.137: Integration Strength は順序的バーチャート）・第 8 章
  （図 8.2, p.148: Distance は順序カテゴリ 文/メソッド/オブジェクト/名前空間・パッケージ/ライブラリ/(マイクロ)サービス/システム）・
  第 9 章（表 9.1, p.167: Volatility は コア/汎用/支援 の 高い/低い 分類）はいずれも順序尺度／質的提示で、段階を区切る数値
  カットオフを与えない。Ch.9 §9.3.2（p.167）は commit 数を「単純だが不正確になりやすい変動性指標」と明記。
  → `quality-gates.yml` の band severity は **リポジトリ運用上の選択**（Khononov 非依存）であり、`planned-deterministic:`
  SIGNAL を `deterministic:` へ昇格しない方針を確定（静的評価 §3.6.4）。2 値境界 `intrusive_hits > 0`（§6.5 override）のみ書籍由来。
- 「`M = S^D`」の **べき乗（指数）表記は書籍に存在しない**（Ch.12「ソフトウェア設計のフラクタル幾何学的性質」確認済み）。
  同章が扱うのは (a) BALANCE/均衡結合モデル（§6.1）が全抽象化レベルに **自己相似的** に適用されること（§12.4「フラクタル
  モジュール性」, p.222。Integration Strength 段と Distance 段は抽象化レベルに対して **相対的**: あるレベルの Contract 結合は
  上位レベルでは Implementation 結合に見えうる）と、(b) コンポーネント間相互作用が要素数に対し **super-linear** に増大すること
  （図 12.5: n 項目で `n(n-1)/2` 本＝完全グラフの辺数, p.214）であり、べき乗則 `M = S^D` の形は現れない。
  KanDDDinsky 講演の `M = S^D` は `^` を XOR 演算子と解した `モジュール性 = 強度 XOR 距離`（Ch.10 §10.2, p.181 verbatim, §6.1）
  と一致するとみなすのが妥当。

> **書籍原典確認は完了**: Issue 追跡の残存リスク 4 項目（Pain 式・精緻な数学モデル・`M = S^D`・発売日）は
> いずれも邦訳（島田訳, 2025-10-21 初版第 1 刷）で確定。本ファイルに未確認 caveat は残っていない。

---

## §11. 設計時の結合検討（コードが無い段階）

> **位置づけ**: 本節は §6.5 hint table（**静的 SIGNAL 前提＝レビュー時専用**）の **設計時版＝質的判断版** である。設計段階（コード未生成・PR 無し）でモジュール／サービス境界を決めるとき、`quality-architecture` スキルが §1 step 3・§2 から本節を入口として参照する。**`quality-review`（既存コード）側は本節ではなく §6.5 と `quality-review` スキルの §2.1 merge contract を使う**。
>
> ⚠️ **設計時は実測値を書かない**（00-overview §5.1 ルール 4 / quality-architecture §3.5）。本節で結合 3 次元に言及する数値・段は **すべて `（参考値: Khononov 2024, Ch.<n>）` ラベル付き** で扱い、対象コードへの実測判定として書いてはならない。実測が必要になった瞬間、それは review 領域であり `coupling-gate-swift.sh` / §6.5 / §2.1 に移譲する。
>
> 🚫 本節は **新しい数値しきい値を導入しない**。Khononov 2024 は結合 3 次元に数値カットオフを与えない（§10 確認済み: 図 7.14 / 8.2 / 表 9.1 はいずれも順序尺度）。本節も段の「確定」ではなく境界設計の「検討手順」を提供するに留まる。

### §11.1 設計時ヒューリスティクス（定性・SIGNAL 非依存）

設計が **モジュール／サービス境界を新規に定義する** とき、境界をまたぐ依存（コンポーネント対）ごとに次を **定性的に** 問い、§6.1 canonical の `BALANCE = (STRENGTH XOR DISTANCE) OR NOT VOLATILITY` で評価する。SIGNAL（churn / jscpd / semgrep）はまだ無いため、各次元は計測でなく **設計意図からの見積り** であり、`推測` 相当として扱う。

1. **評価レベルを宣言する（H4 / §3.3 / §4.2）**: どの抽象化レベルで結合を見るか（`module_unit:` = メソッド / オブジェクト / 名前空間 / (マイクロ)サービス / システム）を先に固定する。Strength 段も Distance 段も評価レベルに **相対的** なので、レベル未宣言の議論は段を確定できない。

2. **Integration Strength を1段選ぶ（§3 / H1 / H3）**: 境界をまたいで共有する「知識」が何か（私的実装 / 業務ロジック / ドメインモデル型 / 明示コントラクト）から、Intrusive → Functional → Model → Contract の **どの段に設計するか** を選ぶ。**共有要素（型名・コントラクトパス・シンボル）を必ず併記**する（H3）。設計時なので「現状」ではなく「目標とする段」を書く。

3. **Distance を見積る（§4 / H4）**: その境界が Methods / Objects / Namespaces / (Micro)Services / Systems のどこに当たるか。Distance が遠いほど変更コストは比例して増し（§4.2: 比例）、ライフサイクル結合は反比例で弱まる（§4.2）。

4. **Volatility を見積る（§5）**: 結合先が Core / Supporting / Generic のどれで、将来の変更圧力が高いか低いか。**essential（ドメイン由来・不可避）と accidental（設計由来・除去可能）を区別**し、設計判断で減らすのは accidental の方だけ（§5.2）。観測ウィンドウ付きの実測（`observed_change_frequency`）はまだ無いので、ここは設計仮説。

5. **BALANCE を XOR/AND/NOT で評価する（§6.1 / H10）**:
   - **強 Strength × 遠 Distance の両立 = 大域的複雑性**（`STRENGTH AND DISTANCE`）。これを設計で作り込もうとしていないか最優先で疑う。
   - 強 Strength なら Distance を **縮める**（同一境界に寄せる）、Distance を遠くするなら Strength を **下げる**（Contract 化）＝ XOR を成立させる（§6.3 Rebalancing）。
   - 結合先が低 Volatility（安定）なら、XOR が崩れても `OR NOT VOLATILITY` で許容できる（凍結された Generic サブドメインへの依存など）。
   - 「pain / balance / 結合の苦痛」という語を使うなら、同段落に canonical `BALANCE = (STRENGTH XOR DISTANCE) OR NOT VOLATILITY` を併記する（H10）。`Pain = S × D × V` を精密メトリクスとして書かない（H2: 2 値スケール前提＋「正確な科学ではない」§10.3 の2留保が必要）。

6. **「decouple everything」を疑う（§6.4）**: 全境界を最大 Distance＋Contract 化すると distributed monolith（Distance だけ伸びて Strength が下がらない反パターン）になる。強く結合した2部品は **あえて同一境界に寄せる** 設計も balanced であり得る。

### §11.2 設計時 結合チェックリスト（成果物テンプレ）

`quality-architecture` の出力（§2 の「モジュール境界と結合バランス」節）に貼る、境界設計レビュー用チェックリスト。各項目は **grep で機械検証できる** ことを意図し、H 規律に紐づく。設計時なので数値は `（参考値）` ラベル必須。

- [ ] **評価レベルを宣言したか**: 各境界に `module_unit:`（評価する抽象化レベル）を明示したか（H4 / §3.3）。
- [ ] **Strength 段を1つ選び、共有要素を併記したか**: 境界ごとに目標 Integration Strength 段（Intrusive/Functional/Model/Contract）を選び、`(type: ...) / (contract: ...) / (symbol: ...)` を直近に併記したか（H3）。未併記なら `推測` ラベルに格下げ。
- [ ] **Distance を見積ったか**: 境界の Distance 段（Methods〜Systems）を見積り、変更コスト比例／ライフサイクル結合反比例の含意（§4.2）を踏まえたか。
- [ ] **Volatility を essential/accidental で分けたか**: 結合先の変更圧力を見積り、設計で減らす対象を accidental に限定したか（§5.2）。
- [ ] **三重苦を避けたか**: 強 Strength × 遠 Distance × 高 Volatility が同時に成立する境界を作っていないか（§6.1 大域的複雑性 + 高 Volatility）。該当すれば §6.3.1 の削減アクション書式（下げる軸 + 具体的手順 + 期待効果）で明記。
- [ ] **XOR を成立させたか**: 各境界で `STRENGTH XOR DISTANCE`（強なら近く / 遠いなら弱く）か、または低 Volatility による緩和（`OR NOT VOLATILITY`）を説明できるか（§6.1）。
- [ ] **decouple everything になっていないか**: 過剰な疎結合で distributed monolith を招いていないか（§6.4）。
- [ ] **canonical 表現を併記したか**: 「pain / balance」表現に canonical `BALANCE = (STRENGTH XOR DISTANCE) OR NOT VOLATILITY` を併記したか（H10）。`Pain = S × D × V` 単独引用や精密メトリクス化をしていないか（H2）。
- [ ] **既存しきい値を上書きしていないか**: 本節の結合論で `07-maintainability` / `08-flexibility` の数値しきい値・PASS/FAIL を上書きしていないか（H9: 設計時は `参考値` 引用のみ、判定化しない）。
- [ ] **citation 規律を守ったか**: Khononov 概念に章番号を併記（H1）、根拠引用は §10 References の学術・公式のみ（coupling.dev/connascence.io は定義参照のみ・推奨根拠不可、H7）。

### §11.3 §6.5 hint table との関係（混同禁止）

| 観点 | §6.5 hint table | §11 設計時ヒューリスティクス |
| --- | --- | --- |
| 適用フェーズ | 既存コードのレビュー時 | コードが無い設計時 |
| 入力 | 静的 SIGNAL（`coupling-gate-result.json`: intrusive_hits / duplicates / contract_layer_present 等） | 設計意図からの定性見積り（計測なし） |
| 出力の性格 | SIGNAL から段の **候補を絞る**（experimental・要レビュア確定） | 境界設計の **検討手順**（段は目標として選ぶ） |
| 数値の扱い | proxy 数値を `推測` ラベルで採用（H5: `--since=<window>` 併記） | 実測値を書かない（`参考値` ラベルのみ） |
| 使うスキル | `quality-review`（同スキル §2.1 merge contract 経由） | `quality-architecture`（同スキル §1 step 3 / §2 章 4'） |

両者は **同じ §3〜§6 の語彙・§6.1 canonical を共有**するが、**入力（SIGNAL か設計意図か）と数値規律（実測 `推測` か `参考値` か）が異なる**。設計時に SIGNAL 数値を捏造して §6.5 を使ってはならず、レビュー時に §11 の定性見積りで実測を代替してはならない。
