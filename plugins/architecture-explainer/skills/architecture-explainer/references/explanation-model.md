# Explanation Model

HTML を書く前に作る中間表現。Source Truth から集めた Evidence を、読者の mental model に必要な要素へ整理する。HTML はこの model の一部を audience に合わせて描いたものにすぎない。

```text
Source Truth → Evidence → Explanation Model（用語を含む）→ Reader Questions → Explanation Plan → HTML
```

## 保存形式

成果物 HTML と同じディレクトリに `explanation-model.json` として保存する。Review / Improve では、既存 HTML から逆算した model も同じ形式で作り、Source Truth から作った model と比較する。

- すべての要素に安定した `id` を付ける。HTML の anchor（`id`）と同じ値を使うと、説明から model とコードへ辿れる。
- 該当しない要素は空配列にする。セクションを埋めるために内容を作らない。
- 各 claim は `status`（`observed` / `inferred` / `unknown`）と `evidence`（evidence id の配列）を持つ。分類規則は [evidence-rules.md](evidence-rules.md) に従う。
- `status` が `unknown` の claim には、`unknowns` に `about` がその claim の `id` を指す行を置く。claim 自体の `evidence` は空にする。
- decision は、判断の内容（`status`）と理由（`rationale.status`）を別々に分類する。実装から判断は確認できても、理由は Unknown であることが多い。
- `source.revision` には、git 管理下なら commit SHA、そうでなければ資料名や取得日など版を識別できるものを書く。識別できなければ空にする。

## Schema

```json
{
  "subject": {"title": "", "question": "この資料が答える問い", "scope": {"in": [], "out": []}},
  "source": {"root": "", "revision": "", "materials": []},
  "audience": {"profile": "newcomer|implementer|reviewer|architect|debugger", "familiarity": "", "goal": "", "inferred_from": ""},
  "purpose": {"problem": "", "responsibility": "", "status": "", "evidence": []},
  "context": {
    "actors": [{"id": "", "name": "", "role": "", "status": "", "evidence": []}],
    "external_systems": [{"id": "", "name": "", "interaction": "", "status": "", "evidence": []}],
    "boundaries": [{"id": "", "kind": "app|module|process|data|external|trust", "contains": []}]
  },
  "components": [{
    "id": "", "name": "", "level": "system|container|module|class|function",
    "responsibility": "", "depends_on": [{"target": "", "meaning": ""}],
    "code_locations": [{"file": "", "symbol": "", "line": 0}],
    "status": "", "evidence": []
  }],
  "runtime_scenarios": [{
    "id": "", "name": "", "trigger": "",
    "steps": [{"from": "", "to": "", "action": "", "status": "", "evidence": []}],
    "exceptional_paths": [{"at_step": 0, "condition": "", "result": "", "status": "", "evidence": []}]
  }],
  "states": [{"id": "", "owner": "", "name": "", "transitions": [{"event": "", "guard": "", "to": "", "evidence": []}]}],
  "data": [{"id": "", "name": "", "stored_in": "", "written_by": [], "read_by": [], "evidence": []}],
  "decisions": [{
    "id": "", "context": "", "decision": "", "status": "", "evidence": [],
    "rationale": {"text": "", "status": "", "evidence": []},
    "tradeoffs": [], "alternatives": []
  }],
  "invariants": [{"id": "", "description": "", "enforced_by": "", "status": "", "evidence": []}],
  "change_impacts": [{
    "id": "", "change": "",
    "before": {"id": "", "behavior": "", "status": "", "evidence": []},
    "after": {"id": "", "behavior": "", "status": "", "evidence": []},
    "affected": [{"target": "", "reason": "", "evidence": []}],
    "unaffected": [{"target": "", "reason": "", "evidence": []}],
    "requires_verification": [{"target": "", "reason": ""}]
  }],
  "glossary": [{"id": "", "concept": "", "preferred": "", "code_terms": [], "aliases": [], "avoid": [], "meaning": "", "evidence": []}],
  "unknowns": [{"id": "", "about": "", "question": "", "reason": "", "how_to_resolve": ""}],
  "evidence": [{"id": "", "kind": "code|test|doc|config|commit|issue", "file": "", "symbol": "", "line": 0, "note": ""}]
}
```

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

## Component の粒度

`level` を必ず付ける。同じ view に並べる要素は同じ `level` にそろえる（[visualization-selection.md](visualization-selection.md) の抽象度規則）。`responsibility` は「何を担うか」を一文で書き、名前の言い換え（`UserRepository` → 「User のリポジトリ」）にしない。

`depends_on.meaning` には、依存の意味（「認証済み user id を要求」「refresh token を保存」）を書く。HTML の矢印ラベルはここから作る。

既存コードを変更した場合は、`change_impacts.before` と `after` に利用者から見える振る舞いと条件を claim として記録する。`unaffected` は変わらないこと、`requires_verification` は人間の確認点に使う。差分の行ごとの説明に置き換えず、変更前の挙動も旧版のコード・テスト・commit で裏付ける。確認できない変更前の挙動は Unknown とし、作らない。

## Controlled terminology

既存の `glossary` を用語の正本にする。表示する主要 concept ごとに行を作る。`concept` は `components`、`context.actors`、`data` などの安定した id を指す。`preferred` は本文・図・表・caption で使う名称、`code_terms` は変更しない source identifier、`aliases` は初出の対応付けや文脈上許容する既知の別名、`avoid` は別 concept と誤認させる名称である。`meaning` は名称の言い換えではなく責務や意味を示す。`evidence` は concept と identifier の対応を支える。

```json
{"id":"term-session-store","concept":"cmp-session-store","preferred":"セッションストア","code_terms":["SessionStore"],"aliases":[],"avoid":["セッション管理機構"],"meaning":"ユーザーのセッションを保存する component","evidence":["ev-session-store"]}
```

HTML では主要 concept の表示名に `data-concept="cmp-session-store"` を付ける。初出の「セッションストア（`SessionStore`）」は preferred term と code identifier を別々の要素にし、それぞれに同じ `data-concept` を付ける。validator の `--model` は、この明示された表示名を glossary と照合する。未注釈の文章や言い換えの意味までは保証しない。日本語の文面は [language-clarity.md](language-clarity.md) に従って確認する。

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
