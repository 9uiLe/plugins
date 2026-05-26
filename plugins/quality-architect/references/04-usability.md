# 04. 使用性 / Usability

> ISO/IEC 25010 製品品質モデルの「使用性」に関する、調査・アーキテクチャ設計・コードレビュー用リファレンス。

---

## 1. 定義

**使用性 (Usability)** とは、特定の利用状況において、指定されたユーザが目標を達成するために製品またはシステムを使用する際の、有効性・効率・満足度の程度を指す。

- **ISO/IEC 25010:2023** は使用性を製品品質の 9 特性のひとつとして定義し、6 つの副特性で構成する。
- **ISO 9241-11:2018** は利用品質の観点から usability を「有効性 (effectiveness)、効率性 (efficiency)、満足性 (satisfaction)」の 3 軸で定義する。両規格は相補的に参照される。

---

## 2. 副特性

### 2.1 適切度認識性 (Appropriateness Recognizability)

**定義**  
ユーザが製品やシステムの適切性を認識できる程度。

**調査観点**
- 初見ユーザが「この製品で自分のニーズが満たせるか」を理解できるか。
- ランディングページ・オンボーディング画面・ヘルプ概要が目的を明示しているか。

**設計タクティクス・パターン**
- ファーストビューに明確な価値提案 (value proposition) を配置する。
- メタファーとアイコンを一貫させ、機能の意図を視覚的に伝える。
- ナビゲーション構造を情報アーキテクチャ (IA) 原則に沿って設計する。

**コードレビューチェックリスト**
- [ ] `<title>`・`<meta name="description">` がコンテンツを正確に記述しているか。
- [ ] コンポーネント名・ラベル文言が機能の意図と一致しているか。
- [ ] 入力フォームに placeholder ではなく `<label>` が紐付けられているか。

**計測指標**
- タスク完了前の離脱率 (task abandonment rate)
- 「このツールで目的を達成できそう」と回答する割合（ユーザアンケート）
- ISO/IEC 25023:2016 の Appropriateness recognizability 計測尺度

---

### 2.2 習得性 (Learnability)

**定義**  
指定されたユーザが、製品またはシステムの使用を習得できる程度。

**調査観点**
- 初回利用からタスク完了に要する時間。
- ドキュメント・チュートリアルなしでも操作できるか（ゼロヘルプ習得性）。

**設計タクティクス・パターン**
- プログレッシブ・ディスクロージャ (progressive disclosure): 初心者には最小機能セットを提示し、習熟に従い高度機能を開示する。
- コンテキストヘルプ・ツールチップ・空状態 (empty state) メッセージで次のアクションを案内する。
- Nielsen の「習得のしやすさ」ヒューリスティクスに沿い、アフォーダンスを明確にする（Nielsen, 1993）。

**コードレビューチェックリスト**
- [ ] 複雑なウィザード・フローに進捗インジケーターが実装されているか。
- [ ] エラーメッセージが原因と回復手順を平易な言語で示しているか。
- [ ] ショートカット・上級機能は UI 上から発見可能か（隠蔽されすぎていないか）。

**計測指標**
- 初回タスク完了率・完了時間
- 学習曲線の傾き（セッション数 vs. タスク時間）
- System Usability Scale (SUS) スコア（Brooke, 1996 — ACM Digital Library 所収）

---

### 2.3 運用操作性 (Operability)

**定義**  
製品またはシステムを操作・制御しやすい程度。

**調査観点**
- 日常的な繰り返し操作を最少のステップで実行できるか。
- キーボードショートカット、バルク操作など効率化手段が提供されているか。

**設計タクティクス・パターン**
- Nielsen のヒューリスティクス H3 (User control and freedom) および H4 (Consistency and standards) を適用する（Nielsen Norman Group 公式）。
- Fitts の法則に基づきインタラクティブターゲットのサイズと距離を最適化する。
- 「元に戻す / やり直す (Undo/Redo)」を一貫して提供する。

**コードレビューチェックリスト**
- [ ] フォーム送信・破壊的操作に確認ダイアログまたは Undo が実装されているか。
- [ ] ドラッグ&ドロップなどポインタ操作にキーボード代替が存在するか。
- [ ] API のデフォルト値・プリセットが一般ユースケースを網羅しているか。

**計測指標**
- タスクあたり操作ステップ数
- エラー回復に要する時間 (mean time to recovery from error)
- ISO/IEC 25023:2016 の Operability 計測尺度

---

### 2.4 ユーザエラー防止性 (User Error Protection)

**定義**  
ユーザがエラーを起こすことを防止する程度。

**調査観点**
- 入力値の制約・バリデーションが事前に明示されているか。
- 取り消し不能な操作の前に十分な警告が行われているか。

**設計タクティクス・パターン**
- Don Norman の「強制機能 (forcing function)」概念を適用し、誤った操作パスを構造的に封じる（Norman, 2013）。
- フォームはインライン・リアルタイムバリデーションで入力ミスを即時フィードバックする。
- 危険な操作（削除・上書き）には名称入力による確認など摩擦を意図的に挿入する。
- Nielsen のヒューリスティクス H5 (Error prevention) を適用する。

**コードレビューチェックリスト**
- [ ] `<input type="number" min max step>` 等で入力範囲をブラウザレベルで制限しているか。
- [ ] 非同期処理中は重複送信防止 (disable during submit) が実装されているか。
- [ ] エラーメッセージは WCAG 1.3.3 (Sensory Characteristics) に準拠し色だけに依存しないか。
- [ ] API は冪等性 (idempotency) を確保し、重複リクエストを安全に処理するか。

**計測指標**
- タスクあたりエラー発生率
- エラー後の回復成功率
- ISO/IEC 25023:2016 の User error protection 計測尺度

---

### 2.5 ユーザインタフェース快美性 (User Interface Aesthetics)

**定義**  
ユーザインタフェースが快適で満足のいく相互作用を可能にする程度。

**調査観点**
- ビジュアル階層・余白・タイポグラフィが認知負荷を低減しているか。
- デザインが一貫したビジュアル言語（デザインシステム）を採用しているか。

**設計タクティクス・パターン**
- デザインシステム（例: Material Design, Apple HIG）を導入し、一貫性を担保する。
- ゲシュタルト原則（近接・類似・連続）を用いて視覚的グルーピングを設計する。
- ダーク/ライトモード・モーションリダクション等のユーザ設定を尊重する (`prefers-color-scheme`, `prefers-reduced-motion`)。

**コードレビューチェックリスト**
- [ ] コンポーネント間でスペーシング・カラートークンが統一されているか。
- [ ] アニメーションに `prefers-reduced-motion` メディアクエリが適用されているか。
- [ ] フォントサイズが相対単位 (rem/em) で指定され、ユーザのブラウザ設定を尊重しているか。
- [ ] コントラスト比が WCAG 2.2 SC 1.4.3 (AA: 4.5:1) 以上か。

**計測指標**
- 視覚的一貫性スコア（デザインシステム適合率）
- User Experience Questionnaire (UEQ) の Attractiveness / Beauty 因子
- ISO/IEC 25023:2016 の UI aesthetics 計測尺度

---

### 2.6 アクセシビリティ (Accessibility)

**定義**  
最も広範な特性・能力を持つ人々が製品またはシステムを使用できる程度。障害のある人を含む。

**調査観点**
- 支援技術（スクリーンリーダー・スイッチアクセス等）との互換性。
- 知覚・操作・理解・堅牢性の 4 原則 (POUR) への適合度。

**設計タクティクス・パターン**
- WCAG 2.2 (W3C Recommendation, 2023-10-05) の適合レベル AA を最低基準とする。WCAG 2.1 AA との後方互換性を維持する。
- WAI-ARIA 1.2 (W3C Recommendation, 2023-06-06) を用いて動的ウィジェットにセマンティクスを付与する。
- ISO 9241-210:2019 の人間中心設計プロセスを組み込み、障害当事者を含むユーザテストを実施する。
- Focus management を適切に実装し、キーボードのみで全機能を利用可能にする。

**コードレビューチェックリスト**
- [ ] すべての `<img>` に意味のある `alt` テキストが付与されているか（装飾画像は `alt=""`）。
- [ ] フォームコントロールに `<label for>` または `aria-labelledby` が紐付けられているか。
- [ ] フォーカス順序が DOM 順と一致し、可視フォーカスインジケーターが存在するか。
- [ ] `role`, `aria-expanded`, `aria-haspopup` 等の ARIA 属性が正確に使用されているか。
- [ ] 色コントラスト比: 通常テキスト 4.5:1 以上、大テキスト 3:1 以上 (WCAG 2.2 SC 1.4.3)。
- [ ] 自動再生メディアに停止・音量制御が存在するか (WCAG 2.2 SC 1.4.2)。
- [ ] タイムアウト処理でユーザへの事前警告と延長手段が実装されているか (WCAG 2.2 SC 2.2.1)。

**計測指標**
- 自動アクセシビリティ検査ツール (axe, Lighthouse) の違反件数
- スクリーンリーダーによるタスク完了率
- WCAG 2.2 適合レベル (A / AA / AAA) の達成比率

---

## 3. 横断的な設計戦略

### 3.1 人間中心設計プロセスの採用
ISO 9241-210:2019 は、利用状況の理解 → ユーザ要件の明確化 → 設計案の作成 → 評価 の反復サイクルを定義する。使用性品質はこのプロセスを製品ライフサイクル全体に組み込むことで継続的に向上する。

### 3.2 ユーザビリティテストの計画的実施
Nielsen (1993) は 5 名程度の参加者でユーザビリティ問題の約 85% を発見できることを示した。スプリントごとの小規模テストを推奨する。

### 3.3 ヒューリスティック評価
Nielsen の 10 ヒューリスティクス（Nielsen Norman Group 公式, 1994/2020 改訂）はコストの低い専門家評価手法として広く適用される。

### 3.4 デザインシステムとコンポーネント駆動開発
コンポーネントライブラリへのアクセシビリティ・一貫性の組み込みにより、個別実装の品質ばらつきを抑制する。

### 3.5 継続的アクセシビリティ監査
CI パイプラインへの自動アクセシビリティ検査 (axe-core 等) の組み込みにより、退行を早期検出する。

---

## 4. レビュー時の重点チェックリスト（要約）

| 副特性 | 最重要確認事項 |
|--------|---------------|
| 適切度認識性 | 価値提案が初見で伝わるか、`<title>` / `<meta>` が正確か |
| 習得性 | 初回タスク完了率、エラーメッセージに回復手順があるか |
| 運用操作性 | Undo/Redo の一貫性、キーボード代替の有無 |
| ユーザエラー防止性 | バリデーション、破壊的操作の確認フロー、冪等性 |
| UI 快美性 | コントラスト比 AA 適合、デザイントークン一貫性 |
| アクセシビリティ | WCAG 2.2 AA 適合、ARIA 正確性、フォーカス管理 |

---

## 5. アンチパターン

| アンチパターン | 問題 | 対策 |
|--------------|------|------|
| **Dark Pattern** | 解約・キャンセルを意図的に困難にする | 操作の可逆性を設計原則として明文化する |
| **エラーコードのみ表示** | `Error: 0x80004005` では回復不可能 | 平易な言語と回復手順を必ず付記する |
| **色のみによる情報伝達** | 色覚多様性のあるユーザが情報を取得できない | 形・アイコン・テキストを組み合わせる (WCAG 1.4.1) |
| **過剰な確認ダイアログ** | 全操作に確認を求めると警告疲れを招く | 破壊的・取り消し不能な操作に限定する |
| **アクセシビリティ後付け** | リリース直前の対応では修正コストが急増 | 設計初期から POUR 原則を組み込む |
| **モバイル未考慮のフォーカス管理** | モーダル開閉後にフォーカスが迷子になる | 開閉ごとに `focus()` を適切に移動させる |

---

## 6. リファレンス

### 国際規格

1. **ISO/IEC 25010:2023** — *Systems and software engineering — SQuaRE — Product quality model.*  
   ISO. https://www.iso.org/standard/78176.html

2. **ISO/IEC 25023:2016** — *Systems and software engineering — SQuaRE — Measurement of system and software product quality.*  
   ISO. https://www.iso.org/standard/35747.html

3. **ISO 9241-11:2018** — *Ergonomics of human-system interaction — Part 11: Usability: Definitions and concepts.*  
   ISO. https://www.iso.org/standard/63500.html

4. **ISO 9241-210:2019** — *Ergonomics of human-system interaction — Part 210: Human-centred design for interactive systems.*  
   ISO. https://www.iso.org/standard/77520.html

### W3C 公式勧告

5. **W3C** (2023). *Web Content Accessibility Guidelines (WCAG) 2.2.* W3C Recommendation, 5 October 2023.  
   https://www.w3.org/TR/WCAG22/

6. **W3C** (2018, updated 2025). *Web Content Accessibility Guidelines (WCAG) 2.1.* W3C Recommendation.  
   https://www.w3.org/TR/WCAG21/

7. **W3C** (2023). *Accessible Rich Internet Applications (WAI-ARIA) 1.2.* W3C Recommendation, 6 June 2023.  
   https://www.w3.org/TR/wai-aria-1.2/

### 著名な学術書・公式技術資料

8. **Nielsen, J.** (1993). *Usability Engineering.* Morgan Kaufmann. ISBN 978-0-12-518406-9.  
   ACM Digital Library: https://dl.acm.org/doi/10.5555/529793

9. **Nielsen, J.** (1994, revised 2020). *10 Usability Heuristics for User Interface Design.* Nielsen Norman Group.  
   https://www.nngroup.com/articles/ten-usability-heuristics/

10. **Norman, D.** (2013). *The Design of Everyday Things: Revised and Expanded Edition.* Basic Books. ISBN 978-0-465-05065-9.  
    (初版 1988, MIT Press. 強制機能・アフォーダンス・エラー防止の基礎的概念を提示)
