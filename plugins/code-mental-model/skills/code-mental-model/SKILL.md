---
name: code-mental-model
description: 未知の言語・フレームワーク・コードベース・業務ドメインの既存実装やPR・差分について、主要オブジェクトと接続・データ・状態・変更を一枚の System Mental Model Map に整理し、開発者が挙動と影響を予測できる単体HTMLを作る。「このPRを理解したい」「初めて触るモジュールの全体像を掴みたい」などに使う。単なるコードレビュー、バグ検出、一般的なドキュメント作成には使わない。
---

# Code Mental Model

目的はコードの説明文ではなく、読者の頭に作るべきシステムの関係を画面へ外在化すること。**図を見る → オブジェクトや接続を選ぶ → 必要な詳細を読む**順に設計する。読者は開発経験があるが対象技術や業務ドメインには不慣れと仮定する。出力言語は依頼に合わせる。

## 入力・保存先

リポジトリ、ディレクトリ、ファイル、diff、commit、branch 間差分、PR、patch、変更の説明を受け付ける。対象、変更目的、既知／未知の言語やドメインが分かれば利用する。不明でも調査を進め、正確さを左右する点だけ尋ねる。説明文だけの場合は、コードで確認した事実とは区別する。

成果物は単一の self-contained HTML。明示された保存先を優先し、指定がなければ対象リポジトリの root に `.mental-model/index.html`、リポジトリがなければ作業ディレクトリの `.mental-model/index.html` を作る。同じディレクトリに `mental-model.json` と `metadata.json` も保存する。CSS・JavaScript・SVG は renderer が固定 assets から inline にし、外部ライブラリなしで開けるようにする。既定 locale は `ja-JP`。

## 再現可能な生成経路

同梱 Python ツールは Python 3.12 で実行する。

**Repository / Diff → structured analysis → canonical `mental-model.json` → 同梱 renderer → `index.html`** の順を必ず守る。Agent はコードの意味解析、node/edge と Confirmed/Inferred/Unknown の分類、根拠の確認だけを担当する。HTML、DOM、CSS、JavaScript、SVG 座標、ID、並び順、Code Lens の行範囲は作らない。詳細な draft schema、controlled vocabulary、ID・順序規則は [mental-model-schema.md](references/mental-model-schema.md) を読む。分析結果はその schema に沿う JSON draft として用意する。自由文は title・コード由来の識別子や短い関係ラベルに絞り、固定 UI 文言を言い換えない。

対象 root からの相対パスだけを使い、対象 source はすべて `--target` に渡す。`--base` / `--head` / `--config` / `--locale` を入力に合わせて明示する。最初に canonical input fingerprint を計算し、一致する `.mental-model/mental-model.json` があれば再解析せず再利用する。source、設定、schema / Skill / renderer bundle が変わった場合のみ再構築する。agent や session が変わったことだけでは再解析しない。

```text
python3.12 <skill>/scripts/build_model.py --repo <root> --analysis <draft.json> --target <relative-file> [--target ...] [--base <revision>] [--head <revision>] [--config <json>] [--locale ja-JP]
python3.12 <skill>/scripts/validate_model.py <root>/.mental-model/mental-model.json
python3.12 <skill>/scripts/render_html.py --model <root>/.mental-model/mental-model.json
python3.12 <skill>/scripts/verify_reproducibility.py --model <root>/.mental-model/mental-model.json
python3.12 <skill>/scripts/verify_graph_readability.py --model <root>/.mental-model/mental-model.json
python3.12 <skill>/scripts/validate_html.py <root>/.mental-model/index.html
```

`--analysis` は fingerprint 一致時の再利用には不要。明示的な再解析だけ `--force-analysis` を指定する。`index.html` を手修正しない。Visual QA で問題があれば canonical data、[template.html](assets/template.html)、[mental-model.css](assets/mental-model.css)、[mental-model.js](assets/mental-model.js)、renderer の該当箇所を修正し、Skill / renderer version を更新して再生成する。Agent ごとにデザインを変更したり、色・レイアウト・固定 UI 文言・node 順序を選び直したりしない。timestamp、絶対パス、session ID、agent 名は成果物に入れない。

再現性は、**A: 同一 canonical model → 同一の可読性評価 → 同一の最良候補 → 同一座標 → byte-for-byte 同一 HTML** を必須、**B: 同一 source → 同一 model** を fingerprint 再利用と正規化で目指す、**C: 異なるモデルによる初回の自由推論の完全一致** は保証しない、と分ける。生成確認の順は model validation → deterministic render → 可読性検証 → 2回の SHA-256 比較 → Visual QA → Interaction QA。衝突または hash の不一致があれば完了しない。

## グラフを先に作る

1. 対象 revision と調査の問いを定める。差分の理由は依頼、issue、commit、テスト等で確かめる。対象ファイルの宣言、caller/callee、interface/実装、DI、モデル、保存先、API、設定、エラー経路、lifecycle、並行境界のうち関係を決める周辺を追う。単一ファイルや変更行だけで判断しない。言語・フレームワーク仕様が結論を変える場合は公式資料を確認する。
2. HTML や本文を書き始める前に [mental-model-graph.md](references/mental-model-graph.md) に従い、structured analysis draft を作る。意味のあるオブジェクトを node、実際に存在する接続を controlled vocabulary の edge にする。重要なデータは edge 上の入出力、独立した変換対象なら node とする。状態の所有者、副作用、process/network/database 等の境界を調査する。図の座標は指定しない。
3. node と edge の重要主張ごとに **Confirmed**（コード・テスト・一次資料で確認）、**Inferred**（根拠付き推論）、**Unknown**（未確認）と出典位置を付ける。実装の観察と設計者の意図を混同しない。未確認の caller や依存先は `?` を付けた node として残せる。差分なら added / removed / changed / existing を edge または node に付け、before と after で何の接続が変わったか確認する。
4. グラフを単純化する。すべての class を載せず、目的・主経路・変更・失敗の予測に必要な概念だけを Map に残す。詳細 class や helper は選択時の詳細へ移す。架空のレイヤーを作らない。図の接続をたどれば「この node が失敗したら何が影響するか」が分かるか点検する。

## HTML は Map を主役にする

タイトルと1〜2文の概要の直後に **System Mental Model Map** を大きく置く。最初の画面で主要 node と接続を可能な限り見渡せるようにする。renderer は同じ canonical graph から desktop / mobile の inline SVG を決定論的に描く。node、動詞付き edge、流れるデータ、state owner、副作用、境界、Unknown、変更箇所を示す。配置や線の衝突を改善する場合は [visual-grammar.md](references/visual-grammar.md) に従い renderer を直し、特定の HTML の座標を手で変えない。

Structure / Execution / Change は**同じ Map**の表示モードとする。各モードの問いは順に「何が存在し、どう繋がるか」「何がどの順で起きるか」「何の関係が変わったか」。Structure は全体像、Execution は選択したシナリオの node・edge だけとその実行順、Change は added / removed / changed を視線の中心にする。実行シナリオがない場合は Execution を表示しない。分岐を一本の連続番号に偽装せず、条件ごとにシナリオを分ける。実行順の番号を選ぶと、その手順の動作・分岐条件・補足を図の近くに表示する。例えば `miss` は検索結果が見つからないことを説明し、手順の失敗と誤解させない。初期表示にも変更箇所と主経路の手掛かりを残す。JavaScript 無効時にも構造・変更・意味が読める図とテキスト代替を用意する。

初期状態は **Overview** とし、Map を主役にする。node / edge を選ぶと **Focus** に移り、選択対象を Map 上に輪郭や線幅で残し、関係する node / edge を二次強調、無関係なものを軽く弱める。`is-selected` 等のクラスには必ず視覚的な CSS を定義し、hover に依存しない。Map の直下に全幅の Code Dock を一操作で表示し、選択名・関係・データ・条件・意味の短い説明と Code Lens を続けて示す。Map は消さず、選択とコードの対応を保つ。Overview に戻る操作も設ける。小さな floating Inspector を使うなら名称と1〜2文に限り、コードを入れない。node の詳細は名前→役割→重要な接続→状態・副作用→Code Lens→出典、edge は From→To→関係→データ・条件→意味→Code Lens→出典を目安とし、空欄は省く。クリックできない環境でも詳細へ到達できるアンカー等を用意する。既知概念との対応は詳細に置き、未知構文は挙動の誤解を防ぐのに必要な分だけ説明する。既知言語との類推は相違点も記す。

**Code Lens は Focus の主要ビュー**とし、340px 程度の Inspector や高さを制限した popover へ入れない。基本は Map → 選択対象 → 全幅 Code Dock とする。十分な横幅があり、Map とコードの双方が読める場合だけ split view を選ぶ。コード側では通常の80〜100文字程度の行を無理なく走査できる幅を優先し、狭ければ全幅 dock に戻す。対象行と最小限の前後文脈だけを抜粋し、通常は5〜20行、特に必要でも約30行で分割する。短い lens に縦スクロール窓を作らず、折り返さずに長い行だけコード領域内で横スクロールさせる。コード文字は desktop で実効14〜16px、mobile で13〜15px、行間は1.5〜1.65を目安にレンダリングして確認する。元ソースと対応できる場合はファイル・行番号を表示し、行番号はコピー対象コードから分離する。生成時に token 化した静的な HTML の syntax highlighting を埋め込み、外部 CDN は要求しない。構文色は読み分けの補助、対象行の背景・gutter・marker は「今見る理由」を示す semantic cue として別に設計する。選択した edge と該当コード行には共通の selection accent を使い、変更行の `+` / `−` / context と現在選択中の変更を区別する。Change view では選択対象の変更行を Code Lens で示す。実コードに AI の説明コメントを大量に加えず、必要な説明は lens の外に1〜2文で置く。根拠の一覧は Code Lens と分ける。詳しい色・コード表示・連動規則は [visual-grammar.md](references/visual-grammar.md) を読む。

Map と Code Dock の後には、同じ Map に対応する代表ケース、変更の意味、不変条件・失敗経路、Evidence / Unknowns を必要な分だけ置く。初期表示へ用語集や長文を割り込ませない。表は属性比較や根拠の一覧に限り、構造・接続・順序・状態の代用品にしない。実行例は input → decision → mutation → side effect → output を具体的に追い、Program Model を業務上の Situation Model に接続する。Self-explanation は任意。置くなら暗記ではなく予測を促す短い問いにし、回答を強制しない。productive mental effort は残しつつ、対応箇所を探すクリックや視線移動は減らす。教育的根拠を確認するときは [learning-principles.md](references/learning-principles.md) を読む。

読みやすい本文幅、左目次のサイドバー（広い画面）、狭い画面での自然な移動、十分なコントラスト、形と文字を併用した凡例、キーボード操作、印刷を満たす。目次の節番号が読む順番を強制するなら外す。ページ全体の横スクロールを避ける。Mobile では別の縦長レイアウトを生成し、重要な関係ラベルを保持する。レンダリング後の実効文字サイズを確認し、読めない場合は縮小でなくレイアウトを変える。不要なアニメーションを使わない。

## 完了の判定

生成後 `python3.12 <このSkillのディレクトリ>/scripts/validate_html.py <index.html>` を実行する。可能なら desktop・狭い viewport・print でレンダリングし、図の欠け、交差、ラベルの重なり、ページ横溢れ、実効文字サイズ、キーボード、JavaScript 無効時を確認する。さらに実ユーザーのように Overview→node→edge→Execution→Change→Overview を操作し、選択が Map に残るか、全幅 Code Dock と同時に切り替わるか、対応行が視覚探索なしに分かるか、モードごとの問いが図に現れるか、意図しないスクロールがないかを確認する。コードの代表行の幅、実効文字サイズ、説明・source metadata との密度、短い lens の内部縦スクロールの有無、Focus 時のコードの視覚優先度も確認する。狭い viewport でも同じ操作を試す。静的検証は視覚・操作確認の代わりではない。

最後に作成者が Map **だけ**を見て主要オブジェクト、接続、入口と主経路、変更された接続を説明し、失敗の波及を予測できるか試す。読者に理解を証明させない。図を見る→線を選ぶ→実コードを見る流れで対応を結べないなら、文章を増やす前に Map・選択・Code Lens の視覚対応を直す。納品時は HTML の保存先、確認範囲、重要な Unknown を簡潔に伝える。
