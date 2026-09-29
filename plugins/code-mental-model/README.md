# Code Mental Model

未知の既存実装や PR・差分を、経験ある開発者が自分で振る舞いと変更の影響を予測できるメンタルモデルへ変換します。最初にオブジェクトと接続のグラフを作り、成果物の冒頭に一枚の System Mental Model Map として示します。node や edge を選ぶと、図上の選択状態を保ったまま、Map 直下の全幅 Code Dock に対応コードを表示します。

Map は Structure で全体を示し、Execution では選択した経路だけを表示します。実行順の番号を選ぶと動作と分岐条件の説明が開きます。Change では変更された関係を強調します。

`$code-mental-model` を指定して、リポジトリ、ディレクトリ、ファイル、commit、PR、patch などを渡してください。既知の言語や、特に知りたい変更点も指定できます。例: 「この PR のメンタルモデルを作って。私は Swift に慣れていますが Kotlin は初めてです」。

成果物は外部ライブラリに依存しない単一の HTML です。保存先の指定がなければ対象リポジトリの `.mental-model/index.html` に作成します。同じ場所に正規化モデル `mental-model.json` と入力 fingerprint を持つ `metadata.json` を保存します。同梱 renderer は同じモデルから可読性コストが最小の配置を決定論的に選び、SHA-256 比較と衝突検証で確認します。スキルの手順は [SKILL.md](skills/code-mental-model/SKILL.md)、モデル形式は [mental-model-schema.md](skills/code-mental-model/references/mental-model-schema.md) を参照してください。

実装の境界とバージョン規則は [architecture.md](docs/architecture.md)、用語は [CONTEXT.md](CONTEXT.md) にまとめています。

同梱の生成・検証ツールは Python 3.12 と標準ライブラリで動作します。型チェックには `mypy --strict` を使用します。
