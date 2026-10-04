# Visualization Selection

可視化は記法から選ばない。audience が持つ問いを先に決め、その問いに答える view を選ぶ。C4、arc42、UML、sequence diagram の考え方は使ってよいが、記法そのものを目的にしない。

```text
Audience → Reader questions → View per question → Visual grammar → HTML
```

## 1. Audience から問いを決める

audience が指定されていなければ、依頼文の語（「新規参加者向け」「修正担当」「レビュー」「原因」など）と対象資料から推定し、推定理由を `audience.inferred_from` に記録する。

| Profile | Scope × Depth | 優先する問い |
| --- | --- | --- |
| newcomer | Wide + Shallow | これは何か / 誰・何と接続するか / 主な構成要素は何を担うか / 代表的な処理はどう流れるか / 用語の意味 |
| implementer | Focused + Deep | 担当範囲の責務と interface / 実行時の流れと状態 / コードとテストの場所 / 守るべき invariant |
| reviewer | Focused + Medium | 境界と依存の向き / 実行時の流れ / 設計判断と trade-off / risk / 変更の影響範囲 |
| architect | Wide + Medium | context と制約 / 構成と品質特性 / 設計判断と trade-off / risk |
| debugger | Narrow + Very Deep | 観測された症状 / 問題の起きる runtime sequence / 状態の変化 / code path / 破られた invariant / 失敗点 |

依頼の目的に必要な問いだけを選び、Explanation Plan として順序を付ける。基本の情報階層は Level 1 Orientation（何か、解く問題、主な component / flow）→ Level 2 Runtime（trigger、step、条件、例外）→ Level 3 Implementation（file、symbol、test、設定）→ Level 4 Reasoning（判断、trade-off、変更影響、Unknown）。各 level は必要な問いがある場合だけ表示する。debugger では症状から入り、関係しない system 全体の説明を置かない。

## 2. 問いから view を選ぶ

| 読者の問い | View | Model から読む要素 | 主な表現 |
| --- | --- | --- | --- |
| これは何か | Overview | purpose, subject | 2〜3 行の説明 + 小さな context 図 |
| 誰・何と接続しているか | System Context | context.actors, external_systems, boundaries | `.map` と `.boundary`、または SVG。対象 system と外部を分け、境界を明示 |
| 何が何を担当しているか | Component / Responsibility Map | components（同一 level）, depends_on | SVG または `.map` の格子。box に責務、矢印に意味 |
| 実行時にどう動くか | Sequence / Runtime Flow | runtime_scenarios | `.seq` の lifeline 表または `.flow` の番号付き step。例外経路を分岐で示す |
| 状態がどう変化するか | State Machine | states | SVG または `.states` の遷移表。遷移に `event [guard] / action` |
| データがどう流れるか | Data Flow | data | SVG。data store と、データ名つきの流れ |
| なぜこの設計なのか | Decision / Trade-off View | decisions, unknowns | `.decision` カード。context / decision / rationale / trade-off / 根拠 |
| コードのどこに存在するか | Code Map | components.code_locations, evidence | `.codemap` の表。component → file → symbol → 関連 claim |
| 変更すると何に影響するか | Change Impact Map | change_impacts, invariants | `.impact` の木。affected / unaffected / requires verification を文字と線種で区別 |
| 実装変更で振る舞いがどう変わったか | Before / After | change_impacts, runtime_scenarios, invariants, evidence | 変更前 → 変更後 → 変わらないこと → 確認が必要なこと。該当項目だけ表示 |
| どこへ配置されるか | Deployment View | boundaries（process / node） | SVG。node と process の境界 |
| アルゴリズムの内部を知りたい | Annotated Code / Step View | runtime_scenarios.steps, invariants | 抜粋コード + 番号付き注釈 |

同じ問いに複数の view が候補になる場合は、要素間の空間的な関係が理解の中心なら SVG、順序や対応表が中心なら HTML の表・リストを選ぶ。HTML の表・リストは折り返しと検索に強く、SVG より壊れにくい。

## 3. One diagram, one question

各 view は 1 つの問いだけに答える。図の `data-question` 属性と caption に、その問いを読者の言葉で書く（例: 「access token が期限切れのとき、どの順で refresh されるか」）。問いを一文で書けない図は、複数の問いを抱えているため分割する。

## 4. 抽象度をそろえる

1 つの view に並べる要素は、同じ抽象度にそろえる。次の組み合わせは同じ図に並べない。

- actor（人）と、コード上の class
- application / process と、database の table
- module の構成と、関数内部の手順

異なる抽象度をつなぐ必要がある場合は、Overview から Focused View へ drill-down させる（[html-structure.md](html-structure.md)）。Code Map と Annotated Code は、component からコードへ降りるための view であり、file と symbol を並べてよい。

## 5. 情報量を制御する

1 つの view の主要要素がおよそ 5〜9 個を超えて読みにくくなる場合は、`Overview → Focused View` に分割する。この数は認知負荷を疑うための目安であり、合否の閾値ではない（validator は超えた figure に warning を出す）。分割するかどうかは「問いに答えるために、その要素が今必要か」で判断する。

## 6. First view

ページを開いた直後は orientation だけを与える。AI が実装・変更した機能を reviewer が読む場合、「約 30 秒で理解できる」は設計目標であり、時間を測る機械的な合否基準ではない。該当する情報が Source Truth にあるとき、first view だけから次に答えられるかを確認する。

1. 何を実装または変更したか。
2. 何を解決するか。
3. 主要な runtime flow は何か。
4. behavior 上の主要な変更は何か。
5. reviewer が最初に確認すべき点は何か。

該当しない問いは無理に埋めず、省いた理由を Explanation Plan に記録する。Unknown は推測で埋めない。

- タイトル
- この仕組みが何かを 2〜3 行で説明する文
- primary visualization を 1 つ（通常は小さな Overview / System Context）
- Key takeaway

変更前後や確認点が主要な問いなら、first view に短い要点を置き、後続 section へのリンクを添える。リンク先だけを読まなければ答えられない状態にはしない。first view に diff、詳細な file 一覧、全 component、詳細な code path は置かない。

詳細な component map、全 scenario、全 class の図を最初に置かない。

## 7. 選択の記録

Explanation Plan では、view ごとに次を記録する。HTML ではこれを caption と `data-question` に反映する。

```text
view id / 答える問い / view type / 使う model 要素 / 抽象度 / 省いた要素とその理由
```

Review では、この記録を既存 HTML から逆算し、問いと view type が対応しているかを確認する。
