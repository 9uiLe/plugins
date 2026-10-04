# 日本語の説明を明確にする

この reference は日本語の技術説明に使う。ASD-STE100 の controlled-language principles を参考にするが、英語用規格の日本語版でも、規格準拠の判定基準でもない。正確さと根拠を優先する。短くするために条件・例外・Unknown を落とさない。

## 用語を統制する

- `explanation-model.json` の `glossary` を唯一の用語の正本とする。同じ code concept にはそこにある `preferred` の名称を使う。自然に見せるためだけに言い換えない。本文、図の node、矢印、表、caption へ model から名称を反映する。
- 初出で必要なら「認証サービス（`AuthService`）」のように人間向け名称と code identifier を対応付ける。その後は preferred term を使う。既知の別名や identifier は `aliases` / `code_terms` に明示する。
- class、function、method、module、API endpoint、設定キー、event、table、field、protocol の identifier は改変しない。人間向け名称を付けても Code Map から元の綴りへ辿れるようにする。
- `avoid` は紛らわしい名称の校正用である。既存コード・引用・変更前の説明に現れる文字列まで機械的に禁止しない。
- 主要 concept が別々の名前で登場し、読者が別物と誤認し得る場合は修正する。明示済みの alias や無害な短縮は許容する。

## 文で振る舞いを伝える

- 原則として 1 文に主要 claim を 1 つ置く。長い複文を分けても、条件・結果の関係が失われるなら分けない。文字数だけを合否基準にしない。
- 動作では actor → action → object / target を追えるようにする。「認証が行われます」より「認証サービスが認証情報を確認します」を選ぶ。actor が明白な連続 step で毎回繰り返す必要はない。
- 条件で動作が変わるときは、条件を動作より前に置く。「トークンが期限切れの場合、`TokenService` がトークンを更新します」。例外経路には条件と結果を両方書く。
- 「これ」「それ」「この処理」「その値」「前述のもの」などの指示先が曖昧なら具体名に替える。同じ名詞の反復を許容する。
- コードを上から読み上げない。優先する情報は trigger、actor、action、condition、result。例: 「変数を作り、if 文で判定し、関数を呼ぶ」より「有効なセッションがない場合だけ、セッションストアが新しいセッションを作ります」。
- component の責務は可能なら 1 文で、入力・行為・結果のうち重要なものを示す。「`UserRepository` は User の repository」ではなく「`UserRepository` はユーザーデータの取得と保存を担当します」。
- 手順は実行順に書き、各 step で誰が何に何をするかを示す。図と文章の actor / target には同じ preferred term を使う。

## 根拠を文面にも出す

- Observed: 「`TokenService` は最大 3 回再試行します」。code ref を付ける。
- Inferred: 「この再試行は、一時的な通信障害への対処を目的としている可能性があります」。推論 badge と元の Observed を付ける。
- Unknown: 「再試行回数を 3 回にした理由は、この実装からは確認できません」。不明 badge と解消方法を付ける。

文章を読みやすくしても status は変えない。理由の推測を Observed の動作に混ぜない。分類と表示の正本は [evidence-rules.md](evidence-rules.md)。

## 作成・評価時の確認

Reader Questions を決めた後、表示する主要 concept の preferred term と code identifier を model で確定する。Explanation Plan の図・本文・表へ同じ語を投影する。HTML の作成後、各主要 concept の表示を追い、文の主要 claim、actor、条件、結果、指示先、status を読み直す。language lint は architecture explanation の mental model を壊す不一致を優先する。順序は用語不一致 → 曖昧な entity / 指示先 → 意味の薄い関係ラベル → 複雑な責務文 → 読みやすさの目安。heuristic は warning にとどめる。文意や根拠の妥当性は [evaluation-rubric.md](evaluation-rubric.md) で判断する。
