---
name: quality-review
description: "Review EXISTING code, a diff, a PR, or a repository against the ISO/IEC 25010:2023 product quality model, producing severity-rated findings and a quality scorecard. Always runs deterministic static analysis before any LLM judgement. Reviewing whether the EXISTING design itself is sound (design review / design-validity assessment of existing code) is part of THIS skill — see §1 step 2.5 — not `quality-architecture`. Japanese triggers: 「品質観点でレビューして」「25010 でレビュー」「実装をレビューして」「PR を品質特性で見て」「指摘して」「この設計は妥当か」. For designing a NEW/replacement architecture (not yet existing code), use `quality-architecture` instead."
---

# quality-review — ISO/IEC 25010 でコード/差分を網羅レビューする

このスキルは **対象コードを 9 特性・40 副特性で網羅的にレビュー**し、
重大度付きの指摘とスコアカードを出力する。**各指摘の推奨には、学術論文／公式文書を必ず引用する。**

AI の揺らぎを抑えるため、**測れる指標は静的解析ツールに委譲し（決定論パート）**、
LLM の判断は数値化できない残余（考察パート）に閉じ込める。詳しくは
`$PLUGIN_ROOT/references/static-evaluation.md`、設定は
`$PLUGIN_ROOT/quality-gates.yml` を参照する。

リファレンス・ライブラリ: プラグインルート相対の `references/`
（索引は `00-overview.md`、各特性は `01`〜`09`、静的評価方法論は `static-evaluation.md`。各特性ファイルに「コードレビュー チェックリスト」がある）

この文書で `PLUGIN_ROOT` と書く場合は、Claude Code では `${CLAUDE_PLUGIN_ROOT}`、Codex ではこの `SKILL.md` の 2 階層上にある `quality-architect` プラグインルートを指す。

**スキル選択と決定論ファースト原則は `00-overview.md §5.1（プラグイン共通の絶対規律）` がカノン。本ファイルの §0 と §1 step 3 はその反映であり、矛盾があれば §5.1 を優先する。**

---

## 0. このスキルを使ってよいかの判定（必須・最初に実行）

### 0.1 設計依頼の逆ハンドオフ

ユーザが「設計したい／新規アーキテクチャを考えたい／非機能要件をこれから決めたい／ADR を書きたい」と言っており、対象として既存コードを与えていない場合は、本スキルではなく `quality-architecture` に切り替える。

### 0.2 プロジェクト資産の検出（必須・LLM 出力の前に Bash で実行）

対象リポジトリのルートで次の Bash を必ず実行し、**出力（または「リポジトリパス未指定」の旨）をレポート冒頭の「### 0. プロジェクト資産インベントリ」に転記する**:

```bash
{ test -f quality-gate-result.json && echo "HAS quality-gate-result.json"; \
  test -f coupling-gate-result.json && echo "HAS coupling-gate-result.json"; \
  test -f .swiftlint.yml && echo "HAS .swiftlint.yml"; \
  test -f .periphery.yml && echo "HAS .periphery.yml"; \
  test -f Mintfile && echo "HAS Mintfile"; \
  test -f Package.swift && echo "HAS Package.swift"; \
  ls .github/workflows 2>/dev/null | grep -iE 'quality|lint|coverage|coupling' | sed 's/^/HAS workflow: /'; \
  ls scripts 2>/dev/null | grep -iE 'quality-gate|coupling-gate' | sed 's/^/HAS script: /'; \
} 2>&1 | sort -u
```

- 対象がチャットに貼り付けられた差分のみで作業ディレクトリが該当リポジトリではない場合は、転記欄に `対象パス未指定（チャット入力のみ）` と書き、§1 step 3 のフォールバック（個別 `run` または全 skipped）に進む。
- 上のコマンドで `HAS quality-gate-result.json` が出た場合、§1 step 3 では **必ずそれを最優先で Read** する（再実行しない）。
- 上のコマンドで `HAS .swiftlint.yml` や `HAS Package.swift` が出た場合、**プロジェクト側の `.swiftlint.yml` のしきい値を尊重** し、プラグイン同梱の `quality-gates.yml` の値は二次扱いとする。

---

## 1. 進め方（必ずこの順番で）

1. **レビュー範囲の確定**
   - 対象を確認する: 作業ツリーの差分 (`git diff`)、特定 PR、ディレクトリ、リポジトリ全体のいずれか。
   - 指定がなければ「現在の差分」を既定とし、合意を取る。大規模な場合は重点特性を絞る提案をする。

2. **対象の把握と言語の特定**
   - `git diff` / 対象ファイルを Read し、変更の意図・技術スタック・実行環境を把握する。
   - **対象言語を特定**する（不明なら確認）。`quality-gates.yml` に該当 profile があるか確認する。

2.5. **設計妥当性トリアージ（考察パート・最初のトップダウン評価／このステップが「レビューでまず設計を見る」を満たす）**
   - 個別の欠陥を探す前に、まず **「この差分／コードが採用しているアーキテクチャ・設計判断そのものが、要件・文脈に照らして妥当か」をトップダウンで評価する**。「レビューでも結局まず設計の妥当性を考えるべき＝それなら architecture スキルでは？」という疑問への答えはここ: **既存コードの設計レビューは本スキルの責務であり、`quality-architecture` ではない**（判別軸は「対象が既に在るか」。00-overview §5.2）。
   - 観点は 25010 の重点特性で 2〜4 点に絞る: 採用方式に妥当な代替はあったか／主要なトレードオフ（例: 性能効率性⇄保守性、セキュリティ⇄使用性、可用性⇄一貫性）を設計が正しく解決しているか／境界・責務分割は妥当か。
   - **このフェーズの出力は全て「推測(judgment)」**であり決定論パートではない。数値しきい値はここで判定しない（step 3 / 4 に委ねる）。設計上の懸念が大きい特性は step 4-0 の関連度トリアージで「精査対象」へ寄せる。
   - **前方ハンドオフ（review → architecture）**: 設計そのものを作り直す提案（置換アーキの新規設計）が主目的になったら、それは `quality-architecture` の領域。「現状コードの設計レビューはこのまま継続する／置換アーキを“設計”したいなら quality-architecture へ」と 1 行で提示する。これは §0.1 がブロックする後方向（既存コードのレビューを architecture で受ける）とは別物の、正当な前方遷移（00-overview §5.2）。

3. **静的評価レイヤー（決定論パート）を先に実行**
   - **【必須チェックポイント】このステップに入る前に、§0.2 のインベントリ結果を踏まえ、ユーザー確認を 1 回行う**（Claude Code では AskUserQuestion、Codex では通常の確認応答を使う。**二重質問禁止 — 1 ゲート / 1 セッション**）。文面テンプレ:
     > 「決定論パートの実行方針を確認します。検出した資産: <0.2 の転記内容>。
     >  1. 既存 `quality-gate-result.json` (+ あれば `coupling-gate-result.json`) を採用（再実行なし・最速）
     >  2. `$PLUGIN_ROOT/scripts/quality-gate-swift.sh` を実行（`swift test --enable-code-coverage`, `trivy fs` 等を走らせる。数分かかる）
     >  3. 個別 `run` コマンドを実行（部分的に skipped になり得る）
     >  4. 静的解析をスキップして LLM 考察のみで進める（決定論パートは「未実施」と明記される）
     >
     > **追加オプション（保守性 / モジュール性の深掘りが必要な場合のみ）**: 上記に加えて結合の深掘り (07a 補論) シグナルも計測する。
     >  - 2a / 3a. 上記 2 / 3 と同時に `$PLUGIN_ROOT/scripts/coupling-gate-swift.sh` も実行（`git log --since`, `jscpd`, `semgrep` 等を走らせる）。出力 `coupling-gate-result.json` を考察パートで参照。
     >  - 既定はオフ。`07-maintainability.md` の検出 finding に対する severity 下方修正候補がある場合のみ提案する」
   - **auto-mode（質問を省略してよい唯一の条件）**: 0.2 で `HAS quality-gate-result.json` が出ており、かつそのファイルの mtime が 24 時間以内、かつユーザが事前に「CI 結果でよい／最速で」を明言している場合のみ、選択肢 1 を採用して質問を省く。それ以外は **必ず質問する**。`coupling-gate-result.json` の存在は auto-mode を発火させない（追加判断材料は§3 で考慮）。
   - **CI の結果があればそれを最優先**: 選択肢 1 が選ばれたら `quality-gate-result.json` を Read して数値をそのまま採用する（最も再現性が高い）。`HAS coupling-gate-result.json` も検出されていれば、それも Read して merge contract (§2) に従い 07-maintainability 指摘に attach する。
   - **無ければ／選択肢 2 ならラッパースクリプトを実行**: Swift なら `bash "$PLUGIN_ROOT/scripts/quality-gate-swift.sh" <対象>` を Bash で実行し、出力 JSON を採用する。スクリプトがツール実行・パース・しきい値判定まで行うため、LLM の解釈揺れが入らない。
   - **2a / 3a が選択された場合**: 続けて `bash "$PLUGIN_ROOT/scripts/coupling-gate-swift.sh" --since=<window>` を実行し、`coupling-gate-result.json` を取得。**シグナル数値は `推測` ラベル付きで採用**（07a §5 / §9 H5）。観測ウィンドウ `--since=<window>` を本文に必ず併記（H5）。
   - 選択肢 3 ならスクリプトを使わず `quality-gates.yml` の `run` コマンドを個別に実行する。
   - **ツールが未インストール／実行不可なら、その項目を「未実行(skipped)」と明記する。数値を推測・捏造しない。** 全項目 skipped のとき、または選択肢 4 が選ばれたときは結果を `inconclusive` とし、決定論パートは「未実施」と報告する（**「未実施」を `pass` と誤読させない**）。
   - 取得した数値を `threshold` と機械的に突き合わせ、超過を決定論的な指摘とする（同じコードなら毎回同じ結果）。

4. **特性ごとのチェック（9 特性を網羅・考察パート）**
   - **4-0. 関連度トリアージ（リファレンス Read の前に必ず実行）**: 9 特性それぞれについて、step 2 で把握した差分の内容と `00-overview.md` の特性一覧だけを根拠に、**「精査対象」か「該当薄（低リスク）」かを判定**する。この時点では各特性ファイル（`0N-*.md`）本体を**まだ読まない**。判定結果を 2 群に分けて明示する（例: 精査対象=保守性・セキュリティ / 該当薄=移植性・互換性…）。差分が広範囲・判断に迷う特性は精査対象に寄せる（取りこぼし防止を優先）。
   - **4-1. 精査対象のみ Read**: 「精査対象」と判定した特性に**限って** `$PLUGIN_ROOT/references/0N-*.md` を**実際に Read し**、「コードレビュー チェックリスト」を適用する。該当薄の特性のリファレンス本体は読み込まない（コンテキスト節約）。
   - **該当薄の特性も省略しない**: スコアカードには 9 特性すべてを載せ、該当薄は「該当なし/低リスク（1 行で根拠）」と明記して網羅を示す。リファレンスを読んでいないこと自体は問題ない（差分に当該観点の表面が無いという判定の表明）。
   - **決定論パートで既に確定した項目は再判断しない**（数値をそのまま採用）。ここでは静的化できない観点のみを評価し、**「推測」であることを明示**する（profile の `judgment` を参照）。
   - 副特性レベルで具体的に見る（例: セキュリティ → 機密性なら機微データの暗号化/ログ出力、真正性なら認証実装）。

5. **指摘の構造化**
   - 各指摘を以下で記録する:
     - **特性 / 副特性**（25010 のどこか）
     - **層**: `design-level`（設計・方式・境界そのものの誤り。step 2.5 由来）/ `implementation-level`（許容できる設計内の局所的欠陥）。重大度とは直交する軸で、両方を必ず付ける。
     - **重大度**: Critical / High / Medium / Low
     - **箇所**: `path:line`
     - **問題**と**推奨**（具体的な修正方針）
     - **根拠リファレンス**（`0N-*.md` の学術/公式文献を引用）
   - **design-level の指摘が支配的で、局所修正では解消しない**と判断したら、step 2.5 の前方ハンドオフ（置換アーキの設計は `quality-architecture`）を報告に明記する。

6. **スコアカード（決定論／考察を分離）**
   - **決定論パート**: ツール名・実測値・しきい値・判定を表で示す（再現可能）。
   - **考察パート**: 9 特性ごとの所見と相対評価（◎/○/△/× 等）。各所見が決定論パート由来か LLM 判断（推測）かを明示。
   - Critical/High を上位に並べた指摘一覧を添える。

7. **報告**
   - 最重要の指摘 3〜5 件と全体評価を要約する。`--comment` 等で PR へ投稿する指示があれば従う。

---

## 2. 出力フォーマット（必須）

以下の章立てを **省略・空欄不可** で出力する。特に「決定論パート」「スコアカード」は省略禁止。

```
## 品質レビュー（ISO/IEC 25010）

### 0. プロジェクト資産インベントリ
（§0.2 のコマンド出力をそのまま転記。何も無い場合は「該当資産なし」と明記）

### サマリ
- 対象 / 範囲 / 版(2011|2023) / 言語・適用 profile
- 決定論パートの source: ci-artifact / wrapper / individual / none(全 skipped)
- 設計妥当性トリアージ（step 2.5）の所見: 採用設計は妥当 / 要再考（design-level 指摘 N 件・うち再設計提案の有無）
- 最重要指摘 Top N

### 決定論パート（静的解析ツール由来・再現可能）
| 指標 | ツール | measured（実測値） | threshold（しきい値） | 判定 |
| --- | --- | --- | --- | --- |
| 循環的複雑度(最大) | lizard | 23 | ≤10 high / ≤20 critical | ✗ Critical |
| 依存脆弱性(Crit/High) | Trivy | 0 | 0 | ✓ |
| カバレッジ | swift test | 0.62 | ≥ 0.70 | ✗ High |
| ハードコード密度 | （未実行） | 未実行 (skipped: ツール未導入) | — | skipped |

注意:
- **measured 列はいかなる行でも空欄にしない**。数値、または `未実行 (skipped: <理由>)` のいずれかを必ず書く。
- `未実行` を書いた行は判定 `skipped`（pass ではない）。全行 skipped の表は許容するが、サマリで `inconclusive` を必ず宣言する。
- 数値しきい値を本文の指摘で引用する場合、その指標は **必ずこの表に行を持つ**。表に行が無いしきい値引用は §5 違反。

### スコアカード（考察パート）
| 特性 | 評価 | 主な所見 | 根拠 |
| --- | --- | --- | --- |
| 機能適合性 | ○ | … | 決定論(カバレッジ measured=0.62) |
| セキュリティ | △ | SAST 深掘りは推測 | 推測(judgment) |
| …（9 特性すべて） | | | |

所見で数字を引用する場合は決定論パートの行を参照する。

### 指摘一覧（重大度順）
#### [Critical] <タイトル> — セキュリティ/機密性
- 層: design-level / implementation-level
- 箇所: path:line
- 問題: …
- 推奨: …
- 根拠: （ISO/IEC 25010; OWASP ASVS など）
- 数値根拠: 決定論パートの行（例: `循環的複雑度(最大)` 行、measured=23）／無ければ「数値根拠なし(推測)」と明記
- （任意）07a 補足: 結合の深掘り (07a) シグナルが attach されている場合のみ。例: `Khononov Distance: cross-service (推測; module_unit=spm-target, --since=6.months)` — 重大度の **下方修正のみ** 可（07a §9 H9）。
```

### 2.1 結合の深掘り (07a) シグナルの merge contract 【EXPERIMENTAL / Phase 2】

> ⚠️ 07a の結合シグナル (`coupling-gate-result.json`) は **experimental layer**（`quality-gates.yml` の `planned-deterministic.coupling: experimental: true`）である。**既定はオフ**。verdict 確定権を持たず、寄与できるのは severity の **下方修正のみ**。決定論パート表には行を追加せず、考察パートの所見 attach に閉じる。

`HAS coupling-gate-result.json` が検出されているか、§1 step 3 で 2a/3a が選ばれた場合のみ、本セクションを適用する。**未検出/未選択時は本セクションを丸ごとスキップ**（既存挙動を保つ）。

- **dedup キー**: `(path:line, finding_kind)`。同一の保守性 finding に対し、07-maintainability 由来の row と 07a 由来の補足 row が衝突した場合は **1 件に統合**する。
- **precedence**: 既存 07/08 の決定論パート行が **verdict precedence**（PASS/FAIL の確定権）を持つ。07a 由来の SIGNAL は **補足として attach** され、verdict の反転や severity 上方修正には使えない（07a §9 H9 規律）。
- **severity 下方修正のみ可**: 例えば 07-maintainability で `CBO=15` が `High` 判定された場合、`coupling-gate-result.json` の `intrusive_hits=0` + `distance-level=intra-namespace` + `volatility-proxy=stable` が同時に成立しているなら、当該 finding の severity を `Medium` に **下げる根拠** にはなる。逆に CBO=8（PASS）を 07a 由来で `High` に **上げてはならない**。
- **intrusive override の特例**: `coupling-gate-result.json.intrusive_override = true` の場合、Khononov BALANCE 観点での「常時 FAIL」を補足コメントに明記する。ただし 07/08 のしきい値判定がそれによって反転するわけではない（precedence ルール維持）。
- **観測ウィンドウの明示**: 07a 由来の volatility 数値を引用するときは `--since=<window>` を 1 件 1 件の attach 内に併記する（H5）。一括省略禁止。
- **共有要素の明示**: Integration Strength 段を attach に書くときは `(symbol: ...) / (type: ...) / (contract: ...)` を併記する。書けないなら段名を attach に書かず、SIGNAL 数値のみ参照する（H3）。
- **Khononov の決定論扱い禁止**: 07a シグナルは全て `推測` ラベル付きで採用。考察パート由来の所見扱いとし、決定論パート表の行として記載しない（**07a SIGNAL は §2 決定論パート表に行を追加しない**。考察パートの所見・指摘内 attach に閉じる）。

---

## 3. リファレンス引用のルール（厳守）

- すべての推奨に **出典を併記**する。出典は `0N-*.md` の「リファレンス」節の**学術論文・公式文書のみ**。
- ブログ・出典不明の主張を根拠にしない。リファレンスに無い指摘は推測である旨を明示する。
- セキュリティ指摘は可能なら該当する OWASP/NIST 項目番号、保守性指摘はメトリクス（循環的複雑度・結合度等）を添える。
- **保守性指摘で結合度 / 凝集 / 連結度（Connascence）/ モジュール境界を扱う場合は、補論 `references/07a-coupling-deep-dive.md` を引用する**。本ファイル §0.2 で `HAS coupling-gate-result.json` が出ている場合は、決定論パートで proxy 数値（`observed_change_frequency`, `distance_level`, `intrusive_hits` 等）を採用する（`07a` §5 / §9 H5 規律により観測ウィンドウ `--since=<window>` を本文併記）。

---

## 4. 重大度の基準

- **Critical**: 本番で重大被害（データ漏洩・破壊、全断、認証回避）。
- **High**: 高確率で障害/脆弱性につながる、または保守を著しく阻害。
- **Medium**: 品質低下だが回避策あり。改善推奨。
- **Low**: 軽微・スタイル寄り。任意。

---

## 5. やってはいけないこと

- ❌ 9 特性の一部しか見ずに「レビュー完了」とする（網羅性を担保し、見ていない特性は明示）。
- ❌ 根拠リファレンス無しの「べき論」だけの指摘。
- ❌ 重大度を付けずに指摘を羅列する。
- ❌ 推測を断定として書く。確証がなければその旨を示す。
- ❌ 差分の意図を無視した一般論レビュー。
- ❌ **ツールを実行せずに複雑度・カバレッジ・脆弱性件数などの数値を“推測”で書く**。未実行なら「未実行」と明記する。
- ❌ 決定論パートで確定した数値を、考察パートで主観的に上書きする。
- ❌ §0.2 のプロジェクト資産インベントリを実行・転記せずに §1 以降に進む。
- ❌ §1 step 3 のユーザー確認（決定論パート実行方針の確認）を行わずに静的解析ツールを実行する／LLM 単独レビューを書く。
- ❌ 本文や指摘で数値しきい値（V(G) ≤ 10, カバレッジ ≥ 0.70 等）を引用したのに、§2 決定論パート表に対応行（measured 値または skipped）が存在しない。
- ❌ 全行 skipped の決定論パート表を出しながら、サマリで `inconclusive` を宣言せずに重大度付き指摘を断定的に書く。
- ⚠️ **Khononov の `Pain = Strength × Distance × Volatility` を「精密メトリクス」として本文に書く**。同式は書籍本文 verbatim（Ch.10 §10.2.1, 邦訳 p.182「メンテナンスの労力 ＝ 強度 ＊ 距離 ＊ 変動性」）だが、書籍自身が 2 値スケール前提（高=1/低=0）+「正確な科学ではない」警告（§10.3, p.184）を付している。引用時はこの 2 留保を必ず併記し、連続値の精密指標として提示しない。canonical 第一表現は `references/07a-coupling-deep-dive.md` §6.1 の `BALANCE = (STRENGTH XOR DISTANCE) OR NOT VOLATILITY`（こちらも書籍 verbatim）（07a §9 H2 規律）。
- ❌ **Robert C. Martin の Instability `I = Ce / (Ce + Ca)` を Khononov Integration Strength の代理として引用する**。Khononov 2024 は依存をカウントするアプローチを名指しで否定している（07a §9 H2 規律）。
- ❌ **Khononov 由来の指摘で `07-maintainability.md` / `08-flexibility.md` の既存しきい値・PASS/FAIL 判定を上書きする**。補論が寄与できるのは **重大度の下方修正 (downgrade) のみ**（07a §9 H9 規律）。verdict 反転や severity 上方修正は禁則。
