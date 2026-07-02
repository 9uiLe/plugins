---
name: quality-review
description: "Review EXISTING code, diffs, PRs, and repositories against the ISO/IEC 25010:2023 product quality model. Produces severity-rated findings, design-vs-implementation labels, deterministic static-analysis scorecards, and cited recommendations. Always attempts deterministic measurement before LLM judgement. Existing-code design validity reviews belong here; new or replacement architecture design belongs in `quality-architecture`. Japanese triggers: 「品質観点でレビューして」「25010 でレビュー」「実装をレビューして」「PR を品質特性で見て」「指摘して」「この設計は妥当か」."
---

# quality-review

既存コード、差分、PR、リポジトリを ISO/IEC 25010:2023 の 9 特性・40 副特性でレビューする。測れるものは先に静的解析ツールへ委譲し、LLM の判断は数値化できない残余に閉じ込める。各指摘には重大度、層、箇所、根拠リファレンスを付ける。

`$PLUGIN_ROOT` は、Claude Code では `${CLAUDE_PLUGIN_ROOT}`、Codex ではこの `SKILL.md` の 2 階層上（`quality-architect` ディレクトリ）を指す。

必ず `$PLUGIN_ROOT/references/00-overview.md` §5.1 と `$PLUGIN_ROOT/references/static-evaluation.md` を読む。矛盾があれば `00-overview.md` §5.1 を優先する。指摘に使う特性だけ `$PLUGIN_ROOT/references/0N-*.md` を読む。設定とプロファイルは `$PLUGIN_ROOT/quality-gates.yml` を読む。

## 0. 入口と資産検出

新規アーキテクチャ、非機能要件、ADR、まだ存在しない設計案の比較は `quality-architecture` へハンドオフする。既存コードの設計妥当性レビューはこのスキルで扱う。design-level 指摘が支配的で局所修正では解けない場合だけ、置換設計の検討として `quality-architecture` への前方ハンドオフを報告に書く。

レビュー対象が指定されなければ現在の差分を既定にする。大規模なら重点特性を提案する。trivial diff なら §2.1 の軽量フォーマットを使える。

最初に対象リポジトリで資産を検出し、出力冒頭へ転記する。チャット貼り付けのみで対象パスが無い場合は `対象パス未指定（チャット入力のみ）` と書く。

```bash
{
  test -f quality-gate-result.json && echo "HAS quality-gate-result.json";
  test -f coupling-gate-result.json && echo "HAS coupling-gate-result.json";
  find . -maxdepth 2 -type f \( -name 'quality-gate-*.sh' -o -name 'coupling-gate-*.sh' \) 2>/dev/null | sed 's/^/HAS script: /';
  find .github/workflows -maxdepth 1 -type f 2>/dev/null | grep -Ei 'quality|lint|coverage|security|coupling' | sed 's/^/HAS workflow: /';
  for f in Package.swift .swiftlint.yml .periphery.yml Mintfile package.json pnpm-workspace.yaml tsconfig.json pyproject.toml requirements.txt go.mod Cargo.toml pom.xml build.gradle build.gradle.kts; do
    test -f "$f" && echo "HAS manifest/config: $f";
  done
} 2>&1 | sort -u
```

## 1. 手順

1. **範囲と言語を確定する**
   - `git diff`、対象ファイル、PR、ディレクトリ、リポジトリ全体のどれかを明記する。
   - 対象言語を特定し、`quality-gates.yml` に該当 profile があるか確認する。profile が無い言語は `profile: none` とし、step 3 のフォールバックを使う。
   - 版は原則 `ISO/IEC 25010:2023`。ユーザーが 2011 版を明示した場合だけ `2011` と書く。

2. **設計妥当性を先に見る**
   - 個別欠陥の前に、採用されている設計判断、境界、依存方向、失敗モード、制約との整合をトップダウンに評価する。
   - この所見は考察パートとして扱い、決定論パートで確定した measured / threshold / verdict を上書きしない。
   - design-level / implementation-level は重大度と直交するラベルとして全指摘に付ける。

3. **決定論パートの source を選ぶ**
   - 検出したプロジェクト側の lint / coverage / build 設定がしきい値を持つ場合は、プラグイン同梱 `quality-gates.yml` の既定値より優先する。
   - `ci-artifact`: 既存 `quality-gate-result.json` を最優先で読む。mtime が 24 時間以内か、`commit_sha` があれば `git rev-parse HEAD` と一致するか、`target` が対象範囲と矛盾しないかを確認する。不一致なら使わず `artifact mismatch` と書いて次へ進む。メタデータが無い場合は `artifact-integrity: unknown` と明記して採否理由を書く。
   - `wrapper`: profile があり `$PLUGIN_ROOT/scripts/quality-gate-<profile>.sh` が存在する場合、ユーザー確認または事前許可の上で実行する。
   - `individual`: wrapper が無い場合、`quality-gates.yml` の profile 内 `run` を個別に実行する。profile が無い言語では lizard、jscpd、Trivy、Semgrep など言語横断ツールが利用できれば `measured-only` として実測値だけ載せ、threshold 未定義の PASS/FAIL を作らない。
   - `none`: いずれも不可なら全行 `未実行 (skipped: <理由>)` とし、総合 `inconclusive` を宣言する。

4. **実行確認と非対話フォールバック**
   - ビルド、テスト、ネットワーク、依存インストール、長時間実行を伴うコマンドは事前確認を取る。ただしユーザーが既に実行許可を明言している場合は確認を省ける。
   - 質問できない環境では、検証済み artifact を採用し、次に副作用の小さいローカル静的ツールだけを試し、最後は `none` に落とす。確認なしにビルド、テスト、ネットワーク実行へ進まない。

5. **差分帰属を付ける**
   - 差分/PR レビューで repo-wide 計測を使う場合、各 FAIL に `diff-caused` / `pre-existing` / `unknown` を付ける。
   - `path:line` が差分 hunks に含まれる、または base/head の両方を測って head だけ悪化した場合は `diff-caused`。差分外の既存箇所なら `pre-existing`。判定材料が無ければ `unknown`。
   - `pre-existing` は品質リスクとして報告してよいが、その PR の回帰として断定しない。

6. **9 特性トリアージを行う**
   - `00-overview.md` の特性一覧だけを使い、9 特性それぞれを `精査対象` / `該当薄` に分類する。各行に 1 行根拠を書く。
   - 精査対象の特性ファイルだけ読む。該当薄もスコアカードには残し、「見ていない」のではなく「低リスク判断」として可視化する。

7. **指摘を構造化する**
   - 必須項目: 特性/副特性、層、重大度、箇所 `path:line`、問題、推奨、根拠リファレンス、数値根拠、差分帰属。
   - 重大度: Critical / High / Medium / Low。Critical はデータ漏洩、認証回避、全断、データ破壊、安全上の重大危険など即時対応が必要な欠陥。High は本番障害、重要経路のセキュリティ/契約破壊、局所修正不能な設計境界誤り。Medium は局所的な不具合、劣化、将来リスク。Low は可読性、軽微な規約、低確率リスク。保守性では、変更不能、局所修正不能な境界誤り、広範な障害誘発、修正コストの非線形増大を High 以上の根拠にできる。単なる閾値超過だけで Critical にしない。
   - 結合、凝集、複雑度、モジュール境界の指摘では `$PLUGIN_ROOT/references/07a-coupling-deep-dive.md` §6.3.1 の catalog を読み、下げる軸と具体手順を 1〜2 行で書く。

8. **07a 結合シグナルは必要時だけ読む**
   - `coupling-gate-result.json` を採用する、または coupling wrapper を明示的に実行する場合だけ `$PLUGIN_ROOT/references/07a-review-integration.md` を読む。
   - 未検出/未選択なら 07a merge contract は読まず、報告に `07a: 未適用` とだけ書く。

9. **報告する**
   - 最重要指摘 3〜5 件と全体評価を要約する。
   - `--comment` などで PR 投稿を指示された場合は、`path:line` がある指摘を inline comment 候補として重複に注意して投稿する。

## 2. 出力フォーマット

通常レビューでは以下を省略しない。

```text
## 品質レビュー（ISO/IEC 25010）

0. プロジェクト資産インベントリ
<§0 の検出結果。無ければ「該当資産なし」>

サマリ
- 対象 / 範囲 / 版(2011|2023) / 言語・適用 profile
- 決定論パート source: ci-artifact | wrapper | individual | none
- artifact-integrity: verified | mismatch | unknown | not-used
- 設計妥当性: 妥当 | 要再考（design-level 指摘 N 件）
- 07a: 未適用 | artifact | wrapper
- 総合: pass | fail | inconclusive | review-only

### 決定論パート（静的解析ツール由来・再現可能）
| 指標 | ツール | measured | threshold | 判定 | scope | attribution | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cyclomatic-complexity | lizard | 23 | >20=fail | fail | repo-wide | diff-caused | wrapper |
| dependency-vulnerabilities | Trivy | 未実行 (skipped: tool missing) | HIGH,CRITICAL=0 | skipped | repo-wide | unknown | individual |
| generic-complexity | lizard | 12 | threshold未定義(profileなし) | measured-only | target-only | unknown | individual |

### 9 特性トリアージ
| 特性 | 判定 | 根拠 |
| --- | --- | --- |
| 機能適合性 | 精査対象 | API 契約変更あり |
| 性能効率性 | 該当薄 | 実行経路変更なし |
| ...9 特性すべて... | | |

### スコアカード（考察パート）
| 特性 | 評価 | 根拠種別 | 所見 |
| --- | --- | --- | --- |
| 保守性 | △ | deterministic+LLM(推測) | 最大 CCN 超過、境界責務が不明瞭 |

### 指摘
1. [High][design-level][保守性/モジュール性] path/to/file.swift:42
   - 問題:
   - 推奨:
   - 削減アクション:
   - 根拠:
   - 数値根拠:
   - 差分帰属:
```

`measured` は空欄禁止。数値または `未実行 (skipped: <理由>)` のどちらかを書く。profile が無く閾値未定義の場合は、`measured` に実測値を書き、`判定` を `measured-only` にする。全行 skipped ならサマリで `inconclusive` を宣言する。本文でしきい値を引用する場合、その指標は決定論パートに同じ measured/threshold/source で存在していなければならない。

### 2.1 trivial diff fast-path

typo、コメント、ドキュメント、非実行メタデータのみの差分で、依存、設定、API、権限、ビルド、テスト、セキュリティ境界に影響しない場合は軽量フォーマットを使える。

- 資産インベントリ、サマリ、決定論パート source、設計妥当性は残す。
- 決定論パートは `review-only` または `none(全 skipped)` でよい。
- 9 特性は「精査対象」と「その他 8 特性: 該当薄（trivial diff のため）」のように圧縮してよい。
- High 以上の懸念が見つかった時点で通常フォーマットへ戻す。

## 3. 引用規律

全指摘に学術論文、規格、公式文書、または本プラグインの参照ファイルを引用する。参照ファイルに無い指摘は `根拠リファレンスなし（推測）` と明記し、断定を弱める。セキュリティは OWASP/NIST 等の一次情報を優先する。ISO/IEC 25010 の特性名だけを根拠にせず、可能なら該当副特性と品質測度も書く。

## 4. 成功基準

最終応答前に確認する。

- 決定論パートの数値は artifact または実行結果由来で、捏造が無い。
- 考察パートが決定論パートの measured / threshold / verdict を上書きしていない。
- skipped / measured-only / inconclusive が正しく表示されている。
- 9 特性の可視化があり、精査対象と該当薄の根拠がある。
- 各指摘に層、重大度、箇所、引用、数値根拠、差分帰属がある。
- 既存コードレビューと新規設計検討のルーティングが混ざっていない。

## 5. 禁止事項

- 決定論パートを試さずに LLM 単独で数値を出す。
- profile 未定義の言語で Swift 固有ツールや Swift しきい値を既定扱いする。
- repo-wide FAIL を差分起因と断定する。
- freshness/commit/target が不一致の artifact を verified として使う。
- 確認なしにビルド、テスト、ネットワーク実行へ進む。
- 07a シグナルで verdict を反転する、または severity を上方修正する。
