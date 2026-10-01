# Architecture Explainer

ソースコードとアーキテクチャを、読者が正しい mental model を作れる HTML 説明資料にする Claude Code / Codex 用プラグインです。読者は、目的、構成、実行時の動き、コードの場所、設計理由、変更の影響を順に辿れます。各 claim は、コードで確認した事実（Observed）、推論（Inferred）、不明（Unknown）に分けて示します。

## 依頼する

| Mode | 依頼例 | 成果物 |
| --- | --- | --- |
| Create | 「この Repository の認証アーキテクチャを、新規参加者向けに HTML で説明して」 | `explainers/<topic>/index.html` と `explanation-model.json` |
| Create（焦点を絞る） | 「この concurrency bug の原因と修正後の仕組みを、実装担当者向けに可視化して」 | 同上（runtime と state が中心） |
| Review | 「この architecture.html が、コードを知らない開発者に理解しやすいか評価して。コードとの不一致も確認して」 | Hard Gate、claim 照合、修正優先順位を含む review report |
| Improve | 「この HTML は情報量が多く図も見づらい。コードと照合して説明資料自体を改善して」 | `<元の名前>.improved.html` と model、改善前後の評価 |

読者（newcomer / implementer / reviewer / architect / debugger）を指定しない場合は、依頼と対象から推定し、推定理由を報告します。保存先は依頼で指定できます。Improve は、上書きを依頼された場合を除き、元の HTML を残します。

## 資料の設計

コードを読んだ後、HTML の前に Explanation Model（`explanation-model.json`）を作ります。Purpose、Context、Components、Runtime、State、Decision、Invariant、Change Impact、Unknown、Evidence を持つ中間表現です。HTML はこの model を audience に合わせて描いたものです。

- 図は「読者のどの問いに答えるか」から選び、1 つの図では 1 つの問いだけに答えます。
- 抽象度の異なる要素を同じ図に並べません。box には責務を、矢印には意味を書きます。
- first view は、何の説明かを示す短い文、図 1 つ、要点だけにします。詳細は drill-down で開きます。
- 主要な claim から file と symbol へ辿れます。設計意図や要件など、根拠のない内容は Unknown として、解消方法を添えます。
- HTML は CSS と SVG を inline した単体ファイルです。外部 CDN を必須にしません。

Review と Improve は、見た目より先に、コードとの一致と根拠を評価します。6 つの Hard Gate（事実の捏造、主要 claim の根拠、図の問い、抽象度、対象・読者の明示、コードとの対応）に違反がある場合は、見た目に関係なく受け入れ不可とします。

## 構成と実行環境

コードを読める AI エージェントと、表示確認用のブラウザが必要です。validator は Python 3 標準ライブラリだけで動きます。

以下のパスは `skills/architecture-explainer/` 内にあります。

| ファイル | 責務 |
| --- | --- |
| `SKILL.md` | mode 判定、保存先、workflow、報告内容 |
| `references/explanation-model.md` | 中間表現の schema と構築・逆算手順 |
| `references/evidence-rules.md` | Observed / Inferred / Unknown の分類と traceability |
| `references/visualization-selection.md` | audience と問いから view を選ぶ規則 |
| `references/visual-grammar.md` | 要素・関係・status の一貫した視覚表現 |
| `references/html-structure.md` | ページ構成、drill-down、code linking、accessibility |
| `references/evaluation-rubric.md` | Hard Gate、評価次元、severity、修正優先順位、完了条件 |
| `assets/explainer-base.css` | HTML に inline するスタイル |
| `scripts/validate_explainer.py` | 構造・リンク・standalone・簡易 accessibility・code ref の検証 |

## 検証

```bash
python3 -m unittest discover -s plugins/architecture-explainer/tests -v
bash scripts/verify-versions.sh
```

自動テストは validator の動作を検証します。claim の正しさや説明の分かりやすさは validator では判定できないため、Source Truth と照合して評価します。ローカル導入は [コントリビューションガイド](../../CONTRIBUTING.md#ローカルで検証する) を参照してください。
