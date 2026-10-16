# Evidence Rules

もっともらしいが実装に存在しない architecture を書かないための規則。すべての claim を Observed / Inferred / Unknown のいずれかに分類し、主要な claim は `Claim → Evidence → File → Symbol` まで辿れるようにする。

Observed / Inferred / Unknown は Claim の分類である。Data、State transition、affected / unaffected impact のような status を持たない構造要素は、Evidence ID があるだけで Observed Claim にはならない。これらは解決可能な Evidence を必須とし、`data-evidence-backed="true"` と「根拠あり」で出所を表示する。Evidence がない場合は Unknown へ変換せず、model error とする。

## 分類

| Status | 条件 | HTML での表示 |
| --- | --- | --- |
| Observed | コード・テスト・設定・設計資料・commit から直接確認できる | evidence のコード（抜粋または code ref）を付ける。ラベルは出さない（`data-evidence="observed"` 属性だけを持つ） |
| Inferred | Observed から合理的に導ける。推論の元にした Observed を示せる | 必ず「推論」のラベル（破線の枠）を付け、推論の元にした Observed を示す |
| Unknown | 提供された Source Truth から判断できない | 必ず「不明」のラベル（点線の枠）を付け、Known unknowns に問いと解消方法を置く |

HTML で status の属性も evidence のコード・リンクもない architecture claim は、Review では `unsupported` として扱う。確認済みにラベルを出さないのは、すべてのカードに付くとノイズになり、例外（推論・不明）が埋もれるため。

### Observed の条件

- 呼び出し、型の依存、設定値、テストの assert など、読める箇所を指せる。
- 名前だけからの推定は Observed にしない。`CacheManager` という名前は「キャッシュを管理する」ことの Observed ではない。実装を読んで確認する。
- コメント・ADR・commit message に書かれた意図は、「その資料にそう書かれている」ことが Observed である。資料の主張が実装と食い違う場合は、両方を示す。

### Inferred の条件

- 推論の元にした Observed を 1 つ以上挙げ、どう導いたかを一文で書く。
- 「可能性が高い」「〜と考えられる」など、推論であることが文面から分かる表現にする。
- 推論を重ねない。Inferred を根拠にした Inferred は Unknown にする。

### Unknown にするもの

次は、明示的な根拠（コメント、ADR、設計資料、issue、commit message）がない限り Unknown にする。

- 設計意図、導入理由、代替案を退けた理由
- 将来計画
- business requirement
- 過去の技術的判断の経緯
- performance requirement（測定値・SLO の記載がない限り）
- security requirement（脅威モデル・要件の記載がない限り）

Unknown には `question`、`reason`（なぜ判断できないか）、`how_to_resolve`（誰に聞くか、何を読めばよいか）を書く。Unknown を推測で埋めない。理由が分からない判断は、判断の内容（Observed）と、理由が不明であること（Unknown）に分けて書く。

## Evidence の記録

```json
{"id": "ev-token-rotate", "kind": "code", "revision": "<commit SHA>", "file": "app/auth/session_store.py", "symbol": "SessionStore.rotate", "line": 41, "end_line": 52, "note": "古い refresh token を失効させてから新しい token を保存", "references": ["ref-python-with"]}
```

- `file` は対象リポジトリのルートからの相対パスにする。
- `symbol` は file 内で検索できる識別子にする（class、関数、method、設定キー、テスト名）。`Class.method` のように限定してよい。
- `line` は分かる場合だけ書く。行番号は変わりやすいため、symbol を主な参照にする。
- `end_line` は抜粋の最終行。`line`〜`end_line` を、render 時に `--source-root` からそのまま読んで表示する。範囲は claim が述べている処理の行だけにし、関係のない前後の行やメソッド全体を含めない。1 つの関数が複数の step にまたがる場合は、step ごとに範囲を分けた evidence を作る。
- `note` には、その evidence が claim のどこを支えるかを書く。抜粋の上に表示される。コードの全文は model に写さない（抜粋は render 時にソースから読む）。
- `references` には、その抜粋を読むのに必要な言語機能・ライブラリ・プロトコルの公式ドキュメント（model の `references` の ID）を指定する。
- 変更の説明では commit を evidence にできる（`kind: "commit"`、`symbol` に short SHA）。
- `revision` は変更前後の根拠を区別できる版（commit SHA、旧実装の資料名など）にする。Before / After では `source.base_revision` / `source.revision` と対応させる。git diff は `kind: "diff"` とし、`note` に比較した base / head を記録する。両側の claim に使う場合は、同じ diff を指す旧側・新側の evidence 行を分ける。旧実装をユーザーが提供した場合は `kind: "doc"` でその資料名を記録してよい。

## Before / After の根拠

`change_impacts.before` と `after` は独立した claim として分類する。Observed として表示するなら各 claim の `evidence` に実在する根拠 ID を入れ、旧版・新版それぞれの Source Truth を指す。Inferred は元となる Observed と導出理由を示す。変更前の Source Truth がないときは旧 behavior を推測せず、`before.status: "unknown"` として「変更前のbehaviorは、現在提供されているSource Truthからは確認できません」と表示し、解消方法を `unknowns` に書く。変更後も根拠のない断定はしない。diff の存在だけで設計意図や未実行の runtime 結果を Observed にしない。

## HTML での traceability

主要な claim には、file と symbol を持つ code ref を付ける。

```html
<p>access token の期限切れ時は、同時に来た要求の refresh を 1 回にまとめる。
  <a class="code-ref" href="#code-ev-single-flight"
     data-file="app/client/token_manager.py" data-symbol="TokenManager._refresh_once">token_manager.py · _refresh_once</a></p>
```

- `data-file` と `data-symbol` は `architecture-explainer validate --source-root` の検査対象になる。file が存在し、symbol が file 内に現れることを確認する。
- code ref の `href` は、そのコードの抜粋（`id="code-<evidence-id>"`）を指す。リポジトリの Web URL が分かっている場合は、そこから外部リンクを追加してよい。
- renderer は根拠を折りたたまず、claim の隣にコードの抜粋（見出しは `a.code-ref`）として表示する。同じ evidence は文書で 1 回だけ抜粋し、2 回目以降は、同じ抜粋をウィンドウに表示する「同じコード」のボタンにする。抜粋の表示規則は [visual-grammar.md](visual-grammar.md) の「コードの抜粋」が正本。
- `annotations`（`{from, to, text}` の配列）は、抜粋のどの行が claim のどの部分を裏づけるかを書く。範囲は `line`〜`end_line` の内側に置き、文は該当行から読み取れる事実だけにする。原文コメントを根拠にする場合は「（原文コメント）」と添える。
- 推論・不明の表示は次の markup にする（確認済みはラベルを出さない）。

```html
<span class="status" data-evidence="inferred"><i aria-hidden="true"></i>推論</span>
<span class="status" data-evidence="unknown"><i aria-hidden="true"></i>不明</span>
```

`data-evidence` の値は `observed` / `inferred` / `unknown` の 3 つだけを使う。色だけで区別せず、文字ラベルを必ず含める（[visual-grammar.md](visual-grammar.md)）。

## Review での照合

逆算した model の各 claim を Source Truth と照合し、次のいずれかに分類する。

| 結果 | 意味 | Gate への影響 |
| --- | --- | --- |
| verified | Source Truth で確認できた | — |
| contradicted | Source Truth と矛盾する（存在しない component、異なる方式、改名済みの名前） | G1 または G6 違反 |
| unsupported | 確認も否定もできないのに、事実として書かれている | 主要 claim なら G1 または G2 違反 |
| not-checkable | 提供範囲外（外部 system の内部など）で、資料も推論・不明として扱っている | — |

照合結果には、確認した file / symbol を必ず書く。「コードと一致しない」とだけ書かない。

## 公式ドキュメントへのリンク

コードを読む読者がプログラミング言語やライブラリに詳しくない場合に備え、model の `references` に前提知識と公式ドキュメントを記録できる。

- リンク先は、言語・ライブラリ・プロトコル・ツールの提供元が公開する公式ドキュメントだけにする（例: typescriptlang.org、nodejs.org、sqlite.org、git-scm.com、各ライブラリの公式サイト）。ブログ、Q&A サイト、解説記事、AI による要約は使わない。
- URL は https に限る。資料を作るときに実際にページを開き、`note` に書く節の名前や API 名がページに存在することを確かめる。確かめられないアンカー（`#…`）は付けず、節の名前を `note` に書く。ネットワークがなく確かめられない場合は、リンクを作らない。
- ページの本文は写さない。`note` には、そのページのどこを読むと何が分かるかを 1 文で書く。
- 公式ドキュメントは Source Truth ではない。claim の `evidence` には使わず、抜粋を読むための補助として evidence の `references` と `references` view からだけ参照する。

