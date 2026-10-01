# Evidence Rules

もっともらしいが実装に存在しない architecture を書かないための規則。すべての claim を Observed / Inferred / Unknown のいずれかに分類し、主要な claim は `Claim → Evidence → File → Symbol` まで辿れるようにする。

## 分類

| Status | 条件 | HTML での表示 |
| --- | --- | --- |
| Observed | コード・テスト・設定・設計資料・commit から直接確認できる | evidence へのリンク（code ref）を付ける。badge は任意 |
| Inferred | 複数の Observed から合理的に導ける | 必ず `inferred` badge を付け、推論の元にした Observed を示す |
| Unknown | 提供された Source Truth から判断できない | 必ず `unknown` badge を付け、Known unknowns に問いと解消方法を置く |

HTML で badge も evidence リンクもない architecture claim は、Review では `unsupported` として扱う。

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
{"id": "ev-token-rotate", "kind": "code", "file": "app/auth/session_store.py", "symbol": "SessionStore.rotate", "line": 41, "note": "古い refresh token を失効させてから新しい token を保存"}
```

- `file` は対象リポジトリのルートからの相対パスにする。
- `symbol` は file 内で検索できる識別子にする（class、関数、method、設定キー、テスト名）。`Class.method` のように限定してよい。
- `line` は分かる場合だけ書く。行番号は変わりやすいため、symbol を主な参照にする。
- `note` には、その evidence が claim のどこを支えるかを書く。コードの全文は写さない。
- 変更の説明では commit を evidence にできる（`kind: "commit"`、`symbol` に short SHA）。

## HTML での traceability

主要な claim には、file と symbol を持つ code ref を付ける。

```html
<p>access token の期限切れ時は、同時に来た要求の refresh を 1 回にまとめる。
  <a class="code-ref" href="#ev-single-flight"
     data-file="app/client/token_manager.py" data-symbol="TokenManager._refresh_once">token_manager.py · _refresh_once</a></p>
```

- `data-file` と `data-symbol` は `validate_explainer.py --source-root` の検査対象になる。file が存在し、symbol が file 内に現れることを確認する。
- code ref の `href` は、Code Map または evidence 一覧の該当行（`id`）を指す。リポジトリの Web URL が分かっている場合は、そこから外部リンクを追加してよい。
- 推論・不明の表示は次の markup にする。

```html
<span class="badge" data-evidence="inferred">推論</span>
<span class="badge" data-evidence="unknown">不明</span>
<span class="badge" data-evidence="observed">確認済み</span>
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
