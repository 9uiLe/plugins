# LLM evaluation

Skill の振る舞い（説明の正確さ、Unknown の扱い、Review の指摘、Improve の作り直し）は、モデルを実行しないと確認できない。そのため通常の CI には入れず、Skill の `SKILL.md`、`references/`、`assets/`、`scripts/` を変更したときに手動で実行する。CI が実行するのは `tests/test_*.py` の決定的なテストだけである。

| 層 | 対象 | 実行 |
| --- | --- | --- |
| Deterministic | validator の規則、fixture の再構成と bug の再現 | CI（`python -m unittest discover -s plugins/architecture-explainer/tests`） |
| LLM evaluation | Case A〜D の生成物・review | このファイルの手順で手動 |
| Visual QA | 生成 HTML の表示 | `visual_check.mjs` と screenshot の目視 |

評価結果へ影響する Skill の変更をした後は、変更前の生成物を acceptance の根拠に使わない。該当する Case を再実行する。

## Fixture

`fixtures/auth-service/` は、login・refresh token rotation・client SDK を持つ小さな認証サービスである。次を含む。

- client の並行 refresh で session が失効する concurrency bug と、その修正 commit（`fix(client): share one in-flight token refresh`）
- 理由がどこにも書かれていない設計判断（独自 token 形式、in-memory session、再利用検出で session 全体を失効）
- 意図的に欠陥を入れた `docs/architecture.html`（存在しない Redis / API Gateway、JWT RS256・bcrypt・PostgreSQL・7 日などの誤り、根拠のない設計理由と要件、抽象度の混在した 14 要素の図、外部 CDN）

## 手順

1. Case ごとに fixture repository を作る。SHA は固定 identity・日時で再現される。

   ```bash
   RUN=/tmp/architecture-explainer-eval
   for c in a b c d; do python3 plugins/architecture-explainer/tests/fixture_repo.py "$RUN/case-$c"; done
   ```

2. 各 Case を、Skill を読み込んだ agent に実行させる。作業ディレクトリは `$RUN/case-<x>`。Case C は review を `$RUN/case-c/review.md` にも保存させる。
3. `python3 plugins/architecture-explainer/tests/eval/check_outputs.py "$RUN"` で機械的な確認をする。Create の `index.html` は同じディレクトリの `explanation-model.json`、Improve の `architecture.improved.html` は `architecture.explanation-model.json` と組にして検査する。対応する model がない場合は `missing-model` と報告する。
4. 生成 HTML ごとに `node plugins/architecture-explainer/tests/eval/visual_check.mjs <html> "$RUN/shots" 390 500 1024 1280` を実行する。横方向の overflow がないこと、`identifierWrap` で Code Map の識別子が区切り文字以外で折れていない（`nonSemanticBreaks`、`orphanLines` が 0）ことを確かめ、screenshot を読む。
5. 下表の観点を、生成物を読んで確認する。`check_outputs.py` の `fabrication_contexts` は、欠陥 HTML にしかない語が訂正・Unknown 以外の文脈で使われていないかを人が読むための抜粋である。

## Cases

| Case | 依頼 | 確認する観点 |
| --- | --- | --- |
| A Create / newcomer | この Repository の認証アーキテクチャを、新規参加者向けに HTML で説明してください。 | Purpose から始まる / first view に巨大な図がない / context と責務が分かる / 代表 runtime flow がある / code location へ辿れる / 設計理由を捏造せず Unknown が残る |
| B Focused Create | この concurrency bug（`fix(client): share one in-flight token refresh` の commit で修正されたもの）の原因と修正後の仕組みを、実装担当者向けに可視化してください。 | system 全体を説明しない / runtime と state が中心 / bug の因果の連鎖 / invariant / 修正コードと commit への trace / change impact |
| C Review | この docs/architecture.html が、コードを知らない開発者に理解しやすいか評価してください。コードとの不一致も確認してください。 | 見た目だけで評価しない / source と claim を照合 / Hard Gate / 仕込んだ欠陥の検出（`check_outputs.py` の `review_found`） / 修正優先順位 |
| D Improve | この docs/architecture.html は情報量が多く、図も見づらいです。コードと照合したうえで説明資料自体を改善してください。 | CSS だけで終えない / IA の再設計 / 図の分割と view type の変更 / source と一致 / 改善後の再評価 / 元ファイルが残る |
