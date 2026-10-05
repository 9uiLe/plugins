# Explanation Model

Presentation IR を作る前に保存する semantic truth。Source Truth から集めた Evidence を、読者の mental model に必要な要素へ整理する。HTML はこの model の一部を audience に合わせて描いたものにすぎない。表示順、theme、layout、SVG 座標はここに置かない。

```text
Source Truth → Evidence → Explanation Model（用語を含む）→ Reader Questions → Explanation Plan → Presentation IR → Renderer → HTML
```

## 保存形式

成果物 HTML と同じディレクトリに `explanation-model.json` として保存する。Review / Improve では、既存 HTML から逆算した model も同じ形式で作り、Source Truth から作った model と比較する。

- すべての要素に安定した `id` を付ける。HTML の anchor（`id`）と同じ値を使うと、説明から model とコードへ辿れる。
- 該当しない要素は空配列にする。セクションを埋めるために内容を作らない。
- 各 claim は `status`（`observed` / `inferred` / `unknown`）と `evidence`（evidence id の配列）を持つ。分類規則は [evidence-rules.md](evidence-rules.md) に従う。
- `status` が `unknown` の claim には、`unknowns` に `about` がその claim の `id` を指す行を置く。claim 自体の `evidence` は空にする。
- decision は、判断の内容（`status`）と理由（`rationale.status`）を別々に分類する。実装から判断は確認できても、理由は Unknown であることが多い。
- `source.revision` には、git 管理下なら commit SHA、そうでなければ資料名や取得日など版を識別できるものを書く。識別できなければ空にする。
- `components`・`context.actors`・`context.external_systems`・`data` の `name` は Source Truth に現れる識別子または正式名称を記録する。人間向け表示名は `glossary.preferred` から取得する。両者が異なる場合、`name` を `glossary.code_terms` または `aliases` にも記録し、同じ concept の名称であることを明示する。

## Schema

実際に検証できる全項目の例は [auth-model.json](../../../tests/fixtures/presentation/auth-model.json) を参照する。入力契約の正本は [JSON Schema](../schemas/explanation-model.schema.json) と TypeScript domain types。以下の表で `?` は省略可能な field を示す。配列自体は必須で、該当要素がなければ `[]` を入れる。すべての object は未知の property を拒否する。

| 要素 | 必須 field | 省略可能な field |
| --- | --- | --- |
| `subject` | `title`, `question`, `scope`（`in`, `out`） | なし |
| `source` | `root`, `revision`, `materials` | `base_revision` |
| `audience` | `profile`, `familiarity`, `goal` | `inferred_from` |
| `purpose` | `problem`, `responsibility`, `status`, `evidence` | `id` |
| `context` | `actors`, `external_systems`, `boundaries` | なし |
| actor / external | `id`, `name`, `status`, `evidence` と actor の `role` / external の `interaction` | なし |
| boundary | `id`, `kind`, `contains` | なし |
| component | `id`, `name`, `level`, `responsibility`, `depends_on`, `code_locations`, `status`, `evidence` | なし |
| dependency / code location | `target`, `meaning` / `file` | code location の `symbol`, `line` |
| runtime scenario | `id`, `name`, `trigger`, `steps`, `exceptional_paths` | なし |
| runtime step / exceptional path | `from`, `to`, `action`, `status`, `evidence` / `at_step`, `condition`, `result`, `status`, `evidence` | それぞれ `id` |
| state / transition | `id`, `owner`, `name`, `transitions` / `event`, `guard`, `to`, `evidence` | なし |
| data | `id`, `name`, `stored_in`, `written_by`, `read_by`, `evidence` | なし |
| decision / rationale | `id`, `context`, `decision`, `status`, `evidence`, `rationale`, `tradeoffs`, `alternatives` / `text`, `status`, `evidence` | rationale の `id` |
| invariant | `id`, `description`, `enforced_by`, `status`, `evidence` | なし |
| change impact | `id`, `change`, `before`, `after`, `affected`, `unaffected`, `requires_verification` | なし |
| before / after、affected / unaffected、requires verification | `id`, `behavior`, `status`, `evidence` / `target`, `reason`, `evidence` / `target`, `reason` | なし |
| glossary | `id`, `concept`, `preferred`, `code_terms`, `aliases`, `avoid`, `meaning`, `evidence` | なし |
| unknown | `id`, `about`, `question`, `reason`, `how_to_resolve` | なし |
| evidence | `id`, `kind`, `revision` | `file`, `symbol`, `line`, `note` |

`status` は `observed` / `inferred` / `unknown`。`profile` は `newcomer` / `implementer` / `reviewer` / `architect` / `debugger`。component `level` は `system` / `container` / `module` / `class` / `function`。boundary `kind` は `app` / `module` / `process` / `data` / `external` / `trust`。Evidence `kind` は `code` / `test` / `doc` / `config` / `commit` / `diff` / `issue`。`line` は 1 以上の整数で、該当行がなければ field を省略する。

## 要素の定義

| 要素 | 意味 | 作らない場合 |
| --- | --- | --- |
| Purpose | 対象が解く問題と、担っている責務 | 不要な場合はない。最初に必要 |
| Context | 対象の外側にいる actor、外部 system、境界 | 対象が単一関数などで外部接点がない |
| Structure (`components`) | 責務を持つ構成要素と、意味つきの依存 | debugger 向けの狭い説明で、関係する経路だけを示す場合は経路上の要素に限る |
| Runtime | 代表 scenario の trigger、手順、例外経路 | 静的な設定・データ定義だけが対象 |
| State | 状態を持つ要素の状態と遷移 | 状態を持たない、または状態が説明の問いに関係しない |
| Data | 主要データの保存先、書き手、読み手 | データの所有や流れが問いに関係しない |
| Decision | 設計判断、理由、trade-off、代替案 | 問いに関係する判断がない。判断は確認できても理由に根拠がなければ、理由を作らず `rationale.status` を `unknown` にして `unknowns` に置く |
| Invariant | 常に成り立つべき条件と、それを強制している箇所 | 問いに関係する不変条件がない |
| Code | `code_locations` と `evidence` による file / symbol / line | 不要な場合はない |
| Change Impact | 変更を起点にした affected / unaffected / requires verification | 読者の目的に変更理解が含まれない（newcomer の初回 orientation など） |
| Unknown | Source Truth から判断できない問い | 判断できない点がない場合だけ空にする |

State と Data は独立した Claim ではなく、`status` を持たない。State は状態の定義と Evidence 付き transition、Data は保存先・書き手・読み手と解決可能な `evidence` を持つ。Renderer が transition と Data に付ける `observed` badge は根拠が解決したことを示す表示上の状態であり、State / Data の semantic status ではない。推論や不明点は対応する Claim または `unknowns` で表す。Data Flow の矢印ラベルには glossary の preferred term を使い、「セッションを書き込む」のように対象を明示する。

## Component の粒度

`level` を必ず付ける。同じ view に並べる要素は同じ `level` にそろえる（[visualization-selection.md](visualization-selection.md) の抽象度規則）。`responsibility` は「何を担うか」を一文で書き、名前の言い換え（`UserRepository` → 「User のリポジトリ」）にしない。

`depends_on.meaning` には、依存の意味（「認証済み user id を要求」「refresh token を保存」）を書く。HTML の矢印ラベルはここから作る。

既存コードを変更した場合は、`change_impacts.before` と `after` に利用者から見える振る舞いと条件を別々の claim として記録する。両方に Evidence Rules を適用する。`source.base_revision` に旧版、`source.revision` に新版を識別できる値を記録する。git では base / head SHA、旧実装をユーザーが提供した場合は旧資料名も版の識別子としてよい。各 `evidence.revision` は、その根拠が支える側の版に合わせる。diff は旧版と新版に対応する evidence 行を分け、同じ diff を参照する場合も `revision` で旧側・新側を区別する。`source.materials` は参照資料の一覧として併記できるが、版の識別子の代わりにはしない。変更前の Observed は旧版のコード・テスト・commit・diff・ユーザー提供の旧実装で、変更後の Observed は新版の根拠で裏付ける。`unaffected` は変わらないこと、`requires_verification` は人間の確認点に使う。差分の行順を説明しない。旧版の Source Truth がない場合は `before.status` を `unknown`、`before.evidence` を空にし、`unknowns` で対応する `before.id` を指す。表示は「変更前のbehaviorは、現在提供されているSource Truthからは確認できません」とする。

## Controlled terminology

`explanation-model.json` の `glossary` だけを canonical terminology の正本にする。表示する主要 concept ごとに行を作る。`concept` は `components`、`context.actors`、`data` などの安定した id を指す。`preferred` は本文・図・表・caption・矢印で使う名称、`code_terms` は変更しない source identifier、`aliases` は初出の対応付けや文脈上許容する既知の別名、`avoid` は別 concept と誤認させる名称である。`meaning` は名称の言い換えではなく責務や意味を示す。`evidence` は concept と identifier の対応を支える。HTML や validator に concept ごとの別の用語表を持たせない。

```json
{"id":"term-session-store","concept":"cmp-session-store","preferred":"セッションストア","code_terms":["SessionStore"],"aliases":[],"avoid":["セッション管理機構"],"meaning":"ユーザーのセッションを保存する component","evidence":["ev-session-store"]}
```

renderer は concept id で `glossary.preferred` を引き、主要な表示名に `data-concept="cmp-session-store"` を付ける。初出の「セッションストア（`SessionStore`）」は preferred term と code identifier を別々の要素にし、それぞれに同じ `data-concept` を付ける。SVG では node の `<title>` に preferred term と `data-concept` を置き、可視ラベルも同じ glossary から生成する。本文・図・caption・表・矢印ごとに名称を考え直さない。validator の `--model` は、この明示された表示名を同じ glossary と照合する。未注釈の文章や言い換えの意味までは保証しない。日本語の文面は [language-clarity.md](language-clarity.md) に従って確認する。

## 構築手順

1. **subject と scope を決める。** 依頼文から「何について、どこまで」を一文にする。対象外も書く。
2. **Evidence を集める。** entry point（route、main、DI 登録、公開 API）、責務の境界（module、interface、protocol）、代表 scenario の呼び出し経路、テスト、設定、関連する commit を読む。読んだ箇所ごとに evidence を記録する。
3. **component と scenario を組み立てる。** 呼び出し経路を実際に辿り、各 step に evidence を付ける。辿れない step は `inferred` または `unknown` にする。
4. **decision、invariant、change impact を検討する。** コメント、ADR、commit message、テスト名に根拠がある判断だけを `observed` にする。
5. **unknown を確定する。** 推測で埋めたくなった箇所を `unknowns` に移し、解消方法（誰に聞くか、何を読めばよいか）を書く。
6. **reader question と主要用語を確定する。** 表示する concept の preferred term と identifier を `glossary` に記録し、図・本文・表へ同じ語を投影する。

大きなリポジトリでは、subject に関係する範囲だけを読む。全ファイルを読むことは、正確さの条件ではない。

## Review / Improve での逆算

既存 HTML から次を抽出し、同じ schema に入れる。

- 資料が主張している subject、audience、scope（明示されていなければ「不明」と記録する）
- 図と本文に現れる component、関係、scenario、decision、invariant
- 各 claim に付いている根拠の有無と、その根拠が指す file / symbol

逆算した model と、Source Truth から作った model を claim 単位で比較し、各 claim を `verified` / `contradicted` / `unsupported` / `not-checkable` に分類する。この比較結果が Review の Accuracy と Evidence Integrity の根拠になる。
