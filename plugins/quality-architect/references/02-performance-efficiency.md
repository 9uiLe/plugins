# 02. 性能効率性 / Performance Efficiency

> ISO/IEC 25010 製品品質モデルの「性能効率性」に関する、調査・アーキテクチャ設計・コードレビュー用リファレンス。

---

## 1. 定義

### ISO/IEC 25010:2023 公式定義

**日本語（意訳）:**
「明示された条件のもとで、使用するリソース量に対して、製品またはシステムがその機能を実行するときの性能の度合い。」

**英語（原文）:**
> "Performance relative to the amount of resources used under stated conditions."
> — ISO/IEC 25010:2023, clause 4.2.2

**旧版（ISO/IEC 25010:2011）との対応:**
旧版でも同特性が定義されており、副特性の構成（時間効率性・資源効率性・容量満足性）は 2023 年版でも継承されている。

**規格番号:**
- ISO/IEC 25010:2023 — Systems and software engineering — Systems and Software Quality Requirements and Evaluation (SQuaRE) — Product quality model
- ISO/IEC 25023:2016 — Measurement of system and software product quality（計測指標の定義）

---

## 2. 副特性

### 2.1 時間効率性 (Time Behaviour)

**定義:**
製品またはシステムがその機能を実行するとき、応答時間・処理時間・スループットレートが要件を満たす度合い。

**調査観点:**
- エンドユーザー体験の観点からの応答時間（ページ読み込み、API 応答など）
- スループット（単位時間あたりの処理件数）
- テールレイテンシ（p99、p999）の分布特性

**設計タクティクス・パターン:**
- **非同期処理:** 長時間処理をバックグラウンドキューに退避させ、応答時間を短縮する。
- **タイムアウト設計:** サービス間呼び出しに明示的なタイムアウトを設け、連鎖遅延（cascading latency）を防ぐ。
- **レイテンシ予算 (Latency Budget):** 分散システムにおける各コンポーネントへのレイテンシ割り当て管理。
- **プロファイリング駆動最適化:** フレームグラフ（Flame Graph）等を用いて実際のホットパスを特定してから最適化する（推測ではなく計測）。

**コードレビューチェックリスト:**
- [ ] N+1 クエリ問題が発生していないか（ORM 使用時の eager loading 確認）
- [ ] ループ内に同期 I/O 呼び出しがないか
- [ ] ブロッキング処理がイベントループ・メインスレッドをブロックしていないか
- [ ] 計測なしにアルゴリズムを「最適化」していないか

**計測指標:**
- 応答時間: `RT = T_完了 − T_受付`
- スループット: `X = N / T`（N: 完了リクエスト数、T: 観測時間）
- Little's Law（待ち行列理論の基本定理）:

  ```
  L = λ × W
  ```

  L: システム内平均滞在数、λ: 平均到着率、W: 平均滞在時間（Little 1961）

---

### 2.2 資源効率性 (Resource Utilization)

**定義:**
製品またはシステムがその機能を実行するとき、使用するリソースの量と種類が要件を満たす度合い。対象リソース: CPU、メモリ、ストレージ I/O、ネットワーク帯域、エネルギーなど。

**調査観点:**
- CPU 使用率の定常状態と突発スパイクの分離
- メモリリークの有無（ヒープ増加トレンド）
- ガベージコレクション (GC) 停止時間の頻度と長さ
- ネットワーク帯域消費（ペイロード圧縮・不要データ転送の排除）

**設計タクティクス・パターン:**
- **キャッシング:** 再計算コストが高いデータをメモリに保持し、CPU・I/O を節約する。キャッシュ階層（L1/L2/分散キャッシュ）を使用目的に応じて設計する。
- **接続プーリング:** DB 接続・スレッドなどのリソースを再利用し、生成コストを削減する。
- **オブジェクトプーリング:** 生成コストの高いオブジェクト（バッファ、コネクションなど）を Pool パターンで管理する。
- **データ圧縮:** ネットワーク帯域消費の削減（gzip、zstd など）。
- **Lazy Initialization:** 使用時まで高コストなリソースの初期化を遅延する。

**コードレビューチェックリスト:**
- [ ] リソース（ファイルハンドル、DB 接続、ソケット）が確実に解放されているか（try-with-resources / using / defer 等）
- [ ] 不要なオブジェクト生成がループ内で繰り返されていないか
- [ ] キャッシュに上限サイズ（eviction ポリシー）が設定されているか
- [ ] メモリリークのリスクがあるクロージャや静的コレクションがないか

**計測指標:**
- CPU 使用率: `U_CPU = T_busy / T_total × 100 [%]`
- メモリ使用率: `U_MEM = M_used / M_total × 100 [%]`
- Little's Law による利用率との関係（M/M/1 モデル）:

  ```
  ρ = λ / μ   （ρ: 利用率、λ: 到着率、μ: サービス率）
  ```

---

### 2.3 容量満足性 (Capacity)

**定義:**
製品またはシステムのパラメータの最大限度が要件を満たす度合い。同時接続ユーザー数・データベースレコード数・スループット上限などが対象。

**調査観点:**
- 設計上の最大同時接続数・最大スループット
- スケールアップ（垂直スケーリング）とスケールアウト（水平スケーリング）の限界点
- データ増加に伴うクエリ性能の劣化特性

**設計タクティクス・パターン:**
- **水平スケーリング（Shared-Nothing アーキテクチャ）:** ステートレス設計によりノード追加でスループットを線形に増加させる。
- **Amdahl の法則に基づくボトルネック特定:** 並列化効果の理論上限を把握し、逐次実行部分を優先的に削減する。
- **Universal Scalability Law (USL) による容量計画:** 競合（contention）と粘着（coherency）コストを含む、より現実的なスケーラビリティ予測。
- **シャーディング / パーティショニング:** データを分割し、単一ノードへの集中を防ぐ。
- **バックプレッシャー設計:** 上流からの過負荷をキューで吸収し、システム崩壊を防ぐ。

**コードレビューチェックリスト:**
- [ ] 最大接続数・スレッド数・ファイルディスクリプタ数にハードリミットが設定されているか
- [ ] データ増大を想定した適切なインデックス設計がなされているか
- [ ] バルク処理にページネーション（チャンク分割）が実装されているか
- [ ] キャパシティ超過時のフォールバック（サーキットブレーカー、rate limiting）があるか

**計測指標:**
- Amdahl の法則（並列化の理論最大スピードアップ）:

  ```
  S(N) = 1 / (s + (1 − s) / N)
  ```

  s: 逐次実行割合、N: プロセッサ数（Amdahl 1967）

- Universal Scalability Law（Gunther）:

  ```
  X(N) = N × X(1) / (1 + α(N − 1) + βN(N − 1))
  ```

  α: 競合コスト係数、β: 粘着コスト係数

- 負荷試験によるスループット/レイテンシ曲線の実測（同時ユーザー数を段階増加）

---

## 3. 横断的な設計戦略

### 3.1 Software Performance Engineering (SPE)
開発ライフサイクルの早期段階から性能モデルを構築し、実装前に性能リスクを評価する手法。Smith & Williams (2002) が体系化。主な手順:
1. パフォーマンス要件の定量化（応答時間目標、スループット目標の SLO として記述）
2. ソフトウェア実行モデル（Software Execution Model）の作成
3. システムリソースモデルとの結合分析
4. 性能テストによる検証と反復的改善

### 3.2 プロファイリング駆動最適化
「推測ではなく計測する」原則に従い、プロファイラ（CPU プロファイラ、ヒーププロファイラ）によるボトルネック特定を最適化の前提とする。Gregg (2020) のメソドロジカルアプローチ（USE Method: Utilization, Saturation, Errors）が参照基準として有用。

### 3.3 待ち行列理論による解析的モデリング
Little's Law および M/M/1・M/M/c モデルを用いて、システムへの到着率・サービス率からスループット・レイテンシ・リソース利用率を解析的に推定する。負荷試験前の机上検証として有効。

### 3.4 ベンチマーキングの標準化
SPEC（Standard Performance Evaluation Corporation）のベンチマーク手法に準拠した再現可能な計測を実施し、環境差異・測定誤差を排除する。

---

## 4. レビュー時の重点チェックリスト（要約）

| 観点 | 確認事項 | 対応副特性 |
|------|----------|------------|
| 計測 | 性能目標が定量的な SLO/SLA として文書化されているか | 全般 |
| 計測 | 本番同等環境での負荷試験結果があるか | 時間・容量 |
| 設計 | N+1 クエリ・不要なシリアル I/O が排除されているか | 時間効率性 |
| 設計 | キャッシュに eviction ポリシーと TTL が設定されているか | 資源効率性 |
| 設計 | スケールアウト時のステートレス性が確保されているか | 容量満足性 |
| 設計 | 最大並列度・接続数のリミットが設定されているか | 容量満足性 |
| コード | リソースリークの可能性がないか（ファイル・接続・メモリ） | 資源効率性 |
| コード | プロファイリングなしに最適化が行われていないか | 時間効率性 |
| 運用 | 主要なレイテンシ・スループット・リソース使用率が監視されているか | 全般 |

---

## 5. アンチパターン

| アンチパターン | 説明 | 関連副特性 |
|----------------|------|------------|
| **推測ベースの最適化** | プロファイリングなしに「遅そうな箇所」を改修し、実際のボトルネックを放置する | 時間効率性 |
| **N+1 クエリ** | ORM のリレーション取得でループごとに追加クエリが発行される | 時間効率性 |
| **無制限キャッシュ** | eviction なしのキャッシュによりメモリを無制限に消費する | 資源効率性 |
| **巨大ペイロード転送** | 必要なフィールドのみを取得せず、全フィールドを毎回転送する | 資源効率性 |
| **同期ボトルネック（Amdahl の壁）** | 水平スケーリングしても逐次部分がスループット上限を固定する | 容量満足性 |
| **容量未定義のキュー** | 無制限キューがメモリを使い果たすまでバックログを蓄積する | 容量満足性 |
| **ウォームアップ未考慮** | JIT コンパイル・キャッシュウォームアップなしに負荷試験を開始し、誤った計測値を得る | 時間効率性 |
| **Thundering Herd** | キャッシュ失効時に多数のリクエストが同時に DB へ到達し過負荷を引き起こす | 時間・容量 |

---

## 6. リファレンス

1. **ISO/IEC** (2023). *ISO/IEC 25010:2023 — Systems and software engineering — Systems and Software Quality Requirements and Evaluation (SQuaRE) — Product quality model*. International Organization for Standardization.
   <https://www.iso.org/standard/78176.html>

2. **ISO/IEC** (2016). *ISO/IEC 25023:2016 — Systems and software engineering — Systems and Software Quality Requirements and Evaluation (SQuaRE) — Measurement of system and software product quality*. International Organization for Standardization.
   <https://www.iso.org/standard/35747.html>

3. **Little, J.D.C.** (1961). "A Proof for the Queuing Formula: L = λW". *Operations Research*, 9(3), 383–387. INFORMS.
   <https://pubsonline.informs.org/doi/10.1287/opre.9.3.383>

4. **Amdahl, G.M.** (1967). "Validity of the single processor approach to achieving large scale computing capabilities". *Proceedings of the April 18–20, 1967, Spring Joint Computer Conference (AFIPS '67)*, pp. 483–485. ACM.
   <https://dl.acm.org/doi/10.1145/1465482.1465560>

5. **Gunther, N.J.** (2007). *Guerrilla Capacity Planning: A Tactical Approach to Planning for Highly Scalable Applications and Services*. Springer.
   <https://link.springer.com/book/10.1007/978-3-540-31010-5>

6. **Smith, C.U. & Williams, L.G.** (2002). *Performance Solutions: A Practical Guide to Creating Responsive, Scalable Software*. Addison-Wesley Professional. ISBN 0-201-72229-1.
   <https://dl.acm.org/doi/10.5555/560806> *(関連書籍: ACM Digital Library)*

7. **Jain, R.** (1991). *The Art of Computer Systems Performance Analysis: Techniques for Experimental Design, Measurement, Simulation, and Modeling*. John Wiley & Sons. ISBN 0-471-50336-3.
   <https://www.cse.wustl.edu/~jain/books/perfbook.htm>

8. **Menascé, D.A. & Almeida, V.A.F.** (2002). *Capacity Planning for Web Services: Metrics, Models, and Methods*. Prentice Hall. ISBN 0-13-065903-7.
   <https://dl.acm.org/doi/10.5555/560806>

9. **Gregg, B.** (2020). *Systems Performance: Enterprise and the Cloud* (2nd ed.). Addison-Wesley Professional. ISBN 978-0-13-682015-4.
   <https://www.brendangregg.com/systems-performance-2nd-edition-book.html>

10. **SPEC — Standard Performance Evaluation Corporation** (ongoing). *SPEC Benchmark Suites*. SPEC.
    <https://www.spec.org/>

11. **IEEE** (2008). *IEEE Std 829-2008 — IEEE Standard for Software and System Test Documentation*. IEEE.
    <https://ieeexplore.ieee.org/document/4578383>
