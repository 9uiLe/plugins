# Explanation Model

HTML を書く前に作る中間表現。Source Truth から集めた Evidence を、読者の mental model に必要な要素へ整理する。HTML はこの model の一部を audience に合わせて描いたものにすぎない。

```text
Source Truth → Evidence → Explanation Model → Explanation Plan → HTML
```

## 保存形式

成果物 HTML と同じディレクトリに `explanation-model.json` として保存する。Review / Improve では、既存 HTML から逆算した model も同じ形式で作り、Source Truth から作った model と比較する。

- すべての要素に安定した `id` を付ける。HTML の anchor（`id`）と同じ値を使うと、説明から model とコードへ辿れる。
- 該当しない要素は空配列にする。セクションを埋めるために内容を作らない。
- 各 claim は `status`（`observed` / `inferred` / `unknown`）と `evidence`（evidence id の配列）を持つ。分類規則は [evidence-rules.md](evidence-rules.md) に従う。

## Schema

```json
{
  "subject": {"title": "", "question": "この資料が答える問い", "scope": {"in": [], "out": []}},
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
    "id": "", "context": "", "decision": "", "rationale": "", "tradeoffs": [],
    "alternatives": [], "status": "", "evidence": []
  }],
  "invariants": [{"id": "", "description": "", "enforced_by": "", "status": "", "evidence": []}],
  "change_impacts": [{
    "id": "", "change": "",
    "affected": [{"target": "", "reason": "", "evidence": []}],
    "unaffected": [{"target": "", "reason": "", "evidence": []}],
    "requires_verification": [{"target": "", "reason": ""}]
  }],
  "glossary": [{"term": "", "meaning": "", "evidence": []}],
  "unknowns": [{"id": "", "question": "", "reason": "", "how_to_resolve": ""}],
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
| Decision | 設計判断、理由、trade-off、代替案 | 根拠がない判断は理由を作らず `unknowns` へ置く |
| Invariant | 常に成り立つべき条件と、それを強制している箇所 | 問いに関係する不変条件がない |
| Code | `code_locations` と `evidence` による file / symbol / line | 不要な場合はない |
| Change Impact | 変更を起点にした affected / unaffected / requires verification | 読者の目的に変更理解が含まれない（newcomer の初回 orientation など） |
| Unknown | Source Truth から判断できない問い | 判断できない点がない場合だけ空にする |

## Component の粒度

`level` を必ず付ける。同じ view に並べる要素は同じ `level` にそろえる（[visualization-selection.md](visualization-selection.md) の抽象度規則）。`responsibility` は「何を担うか」を一文で書き、名前の言い換え（`UserRepository` → 「User のリポジトリ」）にしない。

`depends_on.meaning` には、依存の意味（「認証済み user id を要求」「refresh token を保存」）を書く。HTML の矢印ラベルはここから作る。

## 構築手順

1. **subject と scope を決める。** 依頼文から「何について、どこまで」を一文にする。対象外も書く。
2. **Evidence を集める。** entry point（route、main、DI 登録、公開 API）、責務の境界（module、interface、protocol）、代表 scenario の呼び出し経路、テスト、設定、関連する commit を読む。読んだ箇所ごとに evidence を記録する。
3. **component と scenario を組み立てる。** 呼び出し経路を実際に辿り、各 step に evidence を付ける。辿れない step は `inferred` または `unknown` にする。
4. **decision、invariant、change impact を検討する。** コメント、ADR、commit message、テスト名に根拠がある判断だけを `observed` にする。
5. **unknown を確定する。** 推測で埋めたくなった箇所を `unknowns` に移し、解消方法（誰に聞くか、何を読めばよいか）を書く。

大きなリポジトリでは、subject に関係する範囲だけを読む。全ファイルを読むことは、正確さの条件ではない。

## Review / Improve での逆算

既存 HTML から次を抽出し、同じ schema に入れる。

- 資料が主張している subject、audience、scope（明示されていなければ「不明」と記録する）
- 図と本文に現れる component、関係、scenario、decision、invariant
- 各 claim に付いている根拠の有無と、その根拠が指す file / symbol

逆算した model と、Source Truth から作った model を claim 単位で比較し、各 claim を `verified` / `contradicted` / `unsupported` / `not-checkable` に分類する。この比較結果が Review の Accuracy と Evidence Integrity の根拠になる。
