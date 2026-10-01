---
name: architecture-explainer
description: Create, review, and improve evidence-backed HTML explanations of source code and software architecture that let readers build a correct mental model - purpose, context, structure, runtime behavior, code locations, design rationale, and change impact. Use when asked to explain a repository, subsystem, feature, or bug mechanism as a visual HTML document for newcomers, implementers, reviewers, architects, or debuggers; to evaluate an existing architecture or code explanation HTML against the actual code; or to redesign such an HTML explanation. Japanese triggers - アーキテクチャを HTML で説明, 新規参加者向けに仕組みを可視化, 不具合の原因と修正後の仕組みを図解, この architecture.html をコードと照合して評価, 説明資料を改善. Do not use for generic HTML pages or web design, data charts, requirement-to-design documents, routine PR review, writing or changing code, or a plain summary of what code does.
---

# Architecture Explainer

ソースコードとアーキテクチャを、読者が正しい mental model を作れる HTML 説明資料にする。目的は図を描くことではなく、読者が「何のために存在するか → どう構成されているか → 実行時にどう動くか → コードのどこにあるか → なぜその設計か → 変更すると何に影響するか」を辿れるようにすることである。HTML は最終的な表示形式にすぎない。

```text
Source Truth → Evidence → Explanation Model → Explanation Plan（audience × 問い × view）→ HTML → Evaluation → Improvement
```

## 必須制約

1. **HTML を直接書かない。** コードを読んだら、まず Explanation Model を作り `explanation-model.json` に保存する。HTML はその model から作る。
2. **Evidence を分ける。** すべての claim を Observed / Inferred / Unknown に分類し、根拠のない設計意図や要件を推測で埋めない。分類規則は [evidence-rules.md](references/evidence-rules.md) が正本。
3. **問いから view を選ぶ。** 1 view で 1 つの問いに答える。規則は [visualization-selection.md](references/visualization-selection.md) が正本。
4. **standalone HTML にする。** 外部 CDN を必須にしない。技術方針は [html-structure.md](references/html-structure.md) が正本。
5. **Hard Gate 違反があれば完了にしない。** 見た目が良くても、違反があれば受け入れない。
6. **作業範囲を守る。** 対象リポジトリのコードは変更しない。既存 HTML は、上書きを依頼された場合だけ上書きする。外部への公開・送信は、別途その依頼がある場合だけ行う。

## Mode を判定する

| Mode | 判定の手がかり | 成果物 |
| --- | --- | --- |
| Create | 説明資料がまだなく、作成を依頼されている | HTML + `explanation-model.json` |
| Review | 既存 HTML の評価・確認・不一致の検出を依頼され、変更は依頼されていない | Review report |
| Improve | 既存 HTML の改善・作り直し・見やすくする作業を依頼されている | 改善版 HTML + `explanation-model.json` + 改善前後の評価 |

既存 HTML について「見て」とだけ依頼された場合は Review とし、改善が必要なら最後に提案する。

## 入力と保存先

- **Source Truth**: 対象リポジトリ（指定がなければ作業ディレクトリ）、指定された設計資料、diff、commit。git 管理下なら `git rev-parse --short HEAD` の値を `explanation-model.json` の `source.revision` に記録する。
- **Create の保存先**: 指定された場所。指定がなければ、作業ディレクトリの `explainers/<topic-slug>/index.html` と、同じディレクトリの `explanation-model.json`。
- **Improve の保存先**: 上書きの依頼がなければ、元ファイルと同じディレクトリに `<元の名前>.improved.html` と `<元の名前>.explanation-model.json` を作る。
- **Review**: report を回答として返す。保存先を指定された場合だけファイルに書く。

## Workflow

script のパスは、この `SKILL.md` があるディレクトリからの相対パスで書いてある。

1. **Mode、audience、goal、scope を決める。** audience が指定されていなければ、依頼文と対象から推定し、推定理由を記録する。成果を左右する不明点（対象 subsystem の候補が複数あるなど）は質問し、回答に依存しない調査は先に進める。
2. **Evidence を集める。** [evidence-rules.md](references/evidence-rules.md) に従い、entry point、境界、代表 scenario の呼び出し経路、テスト、設定、関連 commit を読む。読むのは subject に関係する範囲だけにする。
3. **Explanation Model を作る。** [explanation-model.md](references/explanation-model.md) の schema で `explanation-model.json` を保存する。
4. **Explanation Plan を作る。** [visualization-selection.md](references/visualization-selection.md) に従い、audience の問いを選び、問いごとに view を選ぶ。
5. **HTML を作る。** [html-structure.md](references/html-structure.md) と [visual-grammar.md](references/visual-grammar.md) に従い、`assets/explainer-base.css` を `<style>` に inline する。first view は orientation だけにする。
6. **構造を検証する。** `python3 scripts/validate_explainer.py <html> --source-root <repo>` を実行し、error をすべて直す。warning は理由を確認し、直すか、直さない理由を記録する。ブラウザを使える場合は、PC 幅と狭い幅で表示し、横にはみ出す要素や重なりがないことを確認する。
7. **評価する。** [evaluation-rubric.md](references/evaluation-rubric.md) で Hard Gate と各次元を判定する。完了条件を満たさなければ、修正優先順位に従って直し、6 から繰り返す。繰り返しの止め方も rubric に従う。
8. **報告する。** 下記「報告」の内容を返す。

### Review の手順

1. 既存 HTML から Explanation Model を逆算する（subject、audience、scope、component、関係、scenario、decision、各 claim の根拠）。
2. Source Truth から Explanation Model を作る。
3. 2 つの model を claim 単位で照合し、`verified` / `contradicted` / `unsupported` / `not-checkable` に分類する。
4. validator を実行する。`--source-root` を付けると、code ref が実在するかも確認できる。
5. Hard Gate、次元別評価、修正優先順位を、[evaluation-rubric.md](references/evaluation-rubric.md) の report 形式で返す。見た目の評価は最後に置く。

### Improve の手順

1. Review の手順をすべて行い、理解上の gap を特定する。
2. 既存のページ構造を前提にしない。Source Truth から作った model と audience から Explanation Plan を作り直し、section と view を選び直す。図の分割、view type の変更、section の削除を行ってよい。
3. HTML を作り直し、Workflow の 6〜7 で検証・再評価する。
4. 改善前後の Hard Gate と主要次元の判定、構造の変更点（section・view の追加、分割、削除とその理由）を報告する。

CSS や配色の変更だけでは Improve にならない。内容・説明構造・可視化の gap を確認した結果、見た目だけが問題だった場合は、そのことを根拠つきで報告してから見た目を直す。

## Reference を読む条件

| Reference | 読む条件 |
| --- | --- |
| [explanation-model.md](references/explanation-model.md) | すべての mode。model の構築・逆算時 |
| [evidence-rules.md](references/evidence-rules.md) | すべての mode。Evidence 収集と claim 照合時 |
| [visualization-selection.md](references/visualization-selection.md) | Create / Improve の Plan 作成時。Review で view 選択を評価する時 |
| [html-structure.md](references/html-structure.md) | HTML を書く時。Review で構造を評価する時 |
| [visual-grammar.md](references/visual-grammar.md) | 図を描く時。Review で視覚表現の一貫性を評価する時 |
| [evaluation-rubric.md](references/evaluation-rubric.md) | すべての mode。評価と report 作成時 |

## 報告

- 成果物のパス（HTML、`explanation-model.json`）
- subject、scope、audience（推定した場合は推定理由）、Source Truth の版
- Explanation Plan の問いと、それぞれに答える view
- validator の結果、Hard Gate の判定、残った問題（severity つき）
- 主な Unknown と、その解消方法
- 成果に影響する仮定
