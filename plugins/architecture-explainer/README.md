# Architecture Explainer

ソースコードとアーキテクチャを、読者が正しい mental model を作れる HTML 説明資料にする Claude Code / Codex 用プラグインです。読者は、目的、構成、実行時の動き、コードの場所、設計理由、変更の影響を順に辿れます。各 claim は、コードで確認した事実（Observed）、推論（Inferred）、不明（Unknown）に分けて示します。

## インストール

```text
/plugin marketplace add 9uiLe/plugins
/plugin install architecture-explainer@9uile-plugins
```

```bash
codex plugin marketplace add 9uiLe/plugins
codex plugin add architecture-explainer@9uile-plugins
```

## 依頼する

| Mode | 依頼例 | 成果物 |
| --- | --- | --- |
| Create | 「この Repository の認証アーキテクチャを、新規参加者向けに HTML で説明して」 | `explainers/<topic>/index.html`、`explanation-model.json`、`presentation-ir.json` |
| Create（焦点を絞る） | 「この concurrency bug の原因と修正後の仕組みを、実装担当者向けに可視化して」 | 同上（runtime と state が中心） |
| Review | 「この architecture.html が、コードを知らない開発者に理解しやすいか評価して。コードとの不一致も確認して」 | Hard Gate、claim 照合、修正優先順位を含む review report（回答として返し、ファイルは変更しない） |
| Improve | 「この HTML は情報量が多く図も見づらい。コードと照合して説明資料自体を改善して」 | `<元の名前>.improved.html` と model、Presentation IR、改善前後の評価。元の HTML は残す |

読者（newcomer / implementer / reviewer / architect / debugger）を指定しない場合は、依頼と対象から推定し、推定理由を報告します。保存先は依頼で指定できます。

次の依頼には使いません。汎用の HTML 作成や Web design、データの可視化、要求からの設計資料作成、通常の PR review、コードの実装・変更、コードの単なる要約です。

## 資料の設計と Evidence

コードを読んだ後、Explanation Model（`explanation-model.json`）を作ります。Purpose、Context、Components、Runtime、State、Decision、Invariant、Change Impact、Unknown、Evidence を持つ semantic truth です。問い、view、表示順、theme は別の `presentation-ir.json` で指定し、専用 renderer が standalone HTML を生成します。モデルは HTML、CSS、SVG 座標を書きません。

- 図は「読者のどの問いに答えるか」から選び、1 つの図では 1 つの問いだけに答えます。
- first view は、何を実装し、何を解決するかを短い文と図 1 つで示します。変更の説明では主要フロー、振る舞いの差、確認点へすぐ辿れるようにします。詳細は drill-down で開きます。
- ASD-STE100 の controlled-language principles を参考に、日本語の技術説明でも概念ごとの名称と文の構造を一貫させます。日本語の説明を ASD-STE100 準拠とは扱いません。
- 主要 concept の preferred term、code identifier、許容する alias を model に記録し、本文・図・表・caption でそろえます。動作には actor、条件、結果を明示します。
- canonical terminology の正本は `explanation-model.json` だけです。HTML の表示名は model から取り、validator も同じ model と照合します。
- 主要な claim から file と symbol へ辿れます。
- 設計意図、採用理由、要件などは、コメント・設計資料・commit などの明示的な根拠がなければ Unknown とし、解消方法を添えます。コードから推測した理由を事実として書きません。
- Before / After は旧版・新版それぞれの Source Truth と結びます。旧版がない場合、変更前の behavior は Unknown と表示します。
- HTML は CSS と SVG を inline した単体ファイルです。閲覧時に React や外部 CDN は不要です。`technical` / `cards` theme は説明内容と独立して切り替えられます。

Review と Improve は、見た目より先に、コードとの一致と根拠を評価します。7 つの Hard Gate（事実の捏造、主要 claim の根拠、図の問い、抽象度、対象・読者の明示、コードとの対応、重大な用語混同）に違反がある場合は、見た目に関係なく受け入れ不可とします。

plugin 自体の改善では `plugins/architecture-explainer/**` を変更します。この skill が説明対象として読むリポジトリの source code は read-only です。

## 既知の制限

- claim が正しいかは、Skill を実行するモデルが Source Truth を読んで判断します。renderer は model の claim と Evidence を投影します。独立した validator は構造に加えて、注釈された名称と model の不一致、Before / After の根拠 ID と版の対応、曖昧表現、抽象的な矢印ラベルを検出します。根拠の内容が claim を支えるか、日本語全体が明確かまでは保証しません。Code Reference の `Class.method` は各部分が source file にあるかを調べるため、別々の箇所に現れる同名の部分を完全には区別しません。
- 大きなリポジトリでは、依頼の subject に関係する範囲だけを読みます。範囲外の構成は説明に含まれません。
- 表示確認はブラウザを使える環境で行います。使えない環境では、validator の構造検査だけになります。

## 構成と実行環境

コードを読める AI エージェントと、表示確認用のブラウザが必要です。同梱する `architecture-explainer` executable の対象は **Apple Silicon macOS（arm64）** です。Intel Mac、Linux、Windows は対象外です。利用時に Bun、Node.js、Python、npm、shadcn CLI のインストールは不要です。開発・build には Bun を使います。

以下のパスは `skills/architecture-explainer/` 内にあります。

| ファイル | 責務 |
| --- | --- |
| `SKILL.md` | mode 判定、保存先、workflow、報告内容 |
| `references/explanation-model.md` / `schemas/explanation-model.schema.json` | semantic truth と実行時 schema |
| `references/evidence-rules.md` | Observed / Inferred / Unknown の分類と traceability |
| `references/language-clarity.md` | 日本語の用語統制と明確な文・手順の指針 |
| `references/visualization-selection.md` | audience と問いから view を選ぶ規則 |
| `references/presentation-ir.md` / `schemas/presentation.schema.json` | 表示指示、view と source の対応、実行時 schema |
| `references/visual-grammar.md` | 要素・関係・status の一貫した視覚表現 |
| `references/html-structure.md` | ページ構成、drill-down、code linking、accessibility |
| `references/evaluation-rubric.md` | Hard Gate、評価次元、severity、修正優先順位、完了条件 |
| `src/components/ui/` | 公式 shadcn CLI から取り込んで所有する Card、Badge、Alert、Separator、Table |
| `src/components/architecture/` | Overview、graph、runtime、decision、impact、code map 等の意味付き view |
| `src/renderer/` / `styles/globals.css` | TSX 静的描画、Dagre 配置、日本語ラベル計測、inline CSS と theme token |
| `src/validator/` | HTML を外部契約として検査する独立 validator |
| `src/cli.ts` | `render`、`validate`、`inspect`、`lint` の入口 |

## 検証

```bash
cd plugins/architecture-explainer/skills/architecture-explainer
bun ci
bun run verify
dist/architecture-explainer render --model path/to/explanation-model.json --presentation path/to/presentation-ir.json --output path/to/index.html
dist/architecture-explainer validate path/to/index.html --source-root path/to/repo --model path/to/explanation-model.json
```

`bun run verify` は test、typecheck、build を実行し、build 前後の `dist/architecture-explainer` が byte 単位で一致することを確認します。続いて executable を一時ディレクトリに移し、Bun / Node.js を PATH に置かずに render / validate して error と warning が 0 件であることを確かめます。`bun ci` は依存の取得に network を使う場合がありますが、その後の CSS 生成と build はインストール済みの依存だけを使います。`--target=bun-darwin-arm64` で配布対象を固定します。source を変更した場合は `bun run build` で配布 executable を更新し、source とともに commit してください。リポジトリ標準の `bash scripts/verify.sh` からもこの検証を実行します。Skill の説明の正確さと Hard Gate は Source Truth を使った LLM 評価でも確認します。手順は [tests/eval/README.md](tests/eval/README.md) にあります。

## Component の所有と更新

`components.json` は開発時に必要な component だけを公式 shadcn CLI から取り込む設定です。Card、Badge、Alert、Separator、Table は shadcn CLI 4.21.1 で 2026-10-05 に取得しました。現在の source はこの repository が所有します。Badge の Slot と variant、Alert の live region、Separator の Radix dependency、未使用の Card / Table subcomponent を削り、静的資料と accessibility に合わせました。上流の更新は自動適用せず、上流 source と所有 source の diff を確認して手動で取り込みます。コピー元のライセンスは [SHADCN-LICENSE.md](skills/architecture-explainer/src/components/ui/SHADCN-LICENSE.md) にあります。

## 制約

Validator は claim の根拠 ID と版、HTML の構造と用語、Code Reference の file / symbol / line を検査します。Evidence が claim を実際に支えるか、Source Truth の調査が十分か、Reader Questions の選択が適切かは agent が [evaluation-rubric.md](skills/architecture-explainer/references/evaluation-rubric.md) の Hard Gate に沿って判断します。Graph の幅は文字種に基づく見積もりなので、未知の font や特殊な合字はブラウザで確認します。配布 executable は約 64 MB で、commit ごとに Git 履歴が増えます。将来の release asset 化は follow-up です。section patch と追加 template は未実装です。
