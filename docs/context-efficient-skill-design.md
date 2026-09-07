# コンテキスト効率を考慮した Skill / Plugin 設計

最終確認日: 2026-09-07

## 目的

Skill や Plugin は、タスクの完遂を助ける一方で、それ自身の instruction、hook、委譲がコンテキストやリクエストの主要な消費源になってはならない。選択したモデルの単価だけでなく、タスク完了までの総利用量を最適化する。

```text
総利用量 ≈ 各 turn で処理されるメインセッションのコンテキスト
          + 各 turn で処理される subagent のコンテキスト
          + reasoning と出力
```

これはベンダーの課金式ではなく、設計判断のためのモデルである。モデル単価を下げても、turn、コンテキスト複製、agent 起動が増えれば総利用量は下がらない、という点が重要である。

## 根拠の分類

コスト最適化を文書化するときは、次の3種類を混同しない。

- **製品仕様**: 現行のベンダー公式ドキュメントに明記された挙動。
- **ローカル観測**: ローカルのセッション記録から得た測定値。問題発見には使えるが、普遍的な閾値や因果関係を証明するものではない。
- **設計上の推論**: 製品仕様とローカル観測から導いたリポジトリ方針。トレードオフを明記し、後から更新可能にする。

### この指針の契機になったローカル観測

2026-09-07 に提供された直近30日分の集計は238セッションを対象としていた。1 turn あたりのコンテキスト中央値は173k tokens、100k tokens 超の turn は79%、`/compact` は19回だった。また、sleep によるポーリング237回、`model-effort-guide` の手動実行52回、Agent呼び出し363回、tool・設定エラーの反復が記録されていた。

これらはこのリポジトリの優先順位を決める根拠にはなるが、一般的な製品上限を示すものではない。特に次の点に注意する。

- 150k tokens での compact 検討はローカルな運用上の目安であり、Claude Code や Codex の製品上限ではない。
- 「subagent-heavy session」のような表示はセッション特性との関連を示すものであり、agent別の因果的な消費内訳ではない。
- Claude Code では、同一内容の Skill を再実行しても本文全体は再追加されず、読み込み済みであることを示す短い注記が追加される。主な問題は、余分な turn、条件付き reference の再読込、動的出力、そして読み込んだ Skill 本文が後続コンテキストに残ることである。

## 一次資料で確認した製品挙動

### 常駐 instruction は継続的にコンテキストを使う

Claude Code のコンテキストには、プロジェクトルートの `CLAUDE.md`、Skill description、tool情報、会話履歴、読み込んだファイル、コマンド出力が含まれる。ルートの `CLAUDE.md` はセッション開始時に読み込まれ、compact後にも再注入される。Anthropicは、各 `CLAUDE.md` を簡潔にし、200行未満を目安にすることを推奨している。`@` import による分割は整理には役立つが、起動時に展開されるためコンテキスト削減にはならない。

一次資料: [Claude Codeのコンテキストウィンドウ](https://code.claude.com/docs/en/context-window)、[Claude Codeのメモリ](https://code.claude.com/docs/en/memory)。

### Skill は段階的に読み込まれるが、読み込み後は寿命が長い

既定では、Skill description は候補判定のため常時コンテキストに入り、`SKILL.md` 本文は実行時に読み込まれる。Claude専用の手動Skillでは、`disable-model-invocation: true` によって通常セッションからdescriptionを除外できる。ただし、このキーは全ランタイムが受理する共通Agent Skills frontmatterではない。対象validatorがすべて対応している場合を除き、Claude/Codex共有Skillには追加せず、Claude Code側の `skillOverrides` またはClaude専用パッケージを使う。

読み込まれたSkill本文は会話に残る。compact後には、新しいものからSkillごとに最大5,000 tokens、合計25,000 tokensまで再注入される。また、subagentにpreloadしたSkillは起動時に本文全体が入る。

一次資料: [Claude Code Skills](https://code.claude.com/docs/en/skills)。

### Subagent はファイル読込を隔離できるが、すべてのコストを消すわけではない

通常のClaude Code subagentは独立した新しいコンテキストで開始し、要約をメインへ返す。そのため、広域なファイル読込をメイン会話から隔離できる。一方、forkは親会話を継承する。通常のcustom subagentも、適用対象の `CLAUDE.md` 階層とpreloadされたSkillを読み込み、コンテキスト上限は自身のモデルで決まる。したがって、委譲がcontext firewallとして有効なのは、入力範囲と戻り値が有界な場合に限られる。

一次資料: [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents)。

### Hook の出力はコンテキストになる

`SessionStart`、`UserPromptSubmit` など、コンテキストを追加できるhookが出力したテキストや `additionalContext` はClaudeのコンテキストへ入る。`UserPromptSubmit` はすべてのユーザーpromptで実行されるため、静的なルーティング規則を注入すると、最も頻度の高いライフサイクル地点でコンテキスト生成処理を繰り返すことになる。hookは決定的な強制には適するが、何もしない正常系では無出力にする。

一次資料: [Claude Code Hooks reference](https://code.claude.com/docs/en/hooks)。

### コンテキスト量は主要なコストレバーである

Anthropicは、token使用量がコンテキスト量に応じて増えると説明し、無関係なタスク間での `/clear`、対象を指定した `/compact`、単純なsubagent taskでの安価なモデルを推奨している。OpenAIも、`AGENTS.md` による永続的なリポジトリ指針と、長いCodexセッションのcompactionを案内している。

一次資料: [Claude Codeのコスト管理](https://code.claude.com/docs/en/costs)、[How OpenAI uses Codex](https://cdn.openai.com/pdf/6a2631dc-783e-479b-b1a4-af0cfbd38630/how-openai-uses-codex.pdf)、[Introducing upgrades to Codex](https://openai.com/index/introducing-upgrades-to-codex/)。

## 設計原則

### 1. 情報を必要最小限の寿命へ配置する

| 情報 | 配置先 | 読み込み方 | 設計規則 |
| --- | --- | --- | --- |
| ほぼ全タスクで必要な不変条件 | ルート `CLAUDE.md` / `AGENTS.md` | 常駐 | 短く、具体的で、非手順的にする |
| 起動条件とルーティング境界 | Skill description | 通常は候補判定用に常駐 | 識別力を高め、catch-all表現を避ける |
| 再利用するworkflow | `SKILL.md` 本文 | 実行時に読み込まれ、その後残る | 入口を短くし、不可逆な制約を先頭へ置く |
| mode・provider固有の手順 | `references/` | 明示的に読んだ場合だけ | 読む条件を正確にリンクへ添える |
| 反復する決定的な変換 | `scripts/` | 実装全文をcontextへ入れず実行 | 手順を毎回文章で再生成しない |
| file種別・subtree固有の規則 | path-scoped rule / nested instruction | 関連時のみ | 発見性だけを理由にルートへ昇格しない |
| 外部状態の通知 | monitor / event | event駆動 | 会話turnによるpollingで代用しない |

大きな設計文書をルート `CLAUDE.md` から `@import` しない。importは起動時に読み込まれる。通常のMarkdownリンクだけを置き、読む条件を指示する。

### 2. Skill discoveryを予算として設計する

- descriptionには、Skillの役割、肯定的なtrigger、最も近い非triggerを書く。
- 少しでも関係しそうな機能を列挙しない。広すぎるdescriptionは誤起動を招く。
- Claude専用の手動Skillには `disable-model-invocation: true` を使う。Claude/Codex共有Skillではportableなfrontmatterを維持し、Claude Codeの `skillOverrides` またはランタイム別パッケージを使う。
- subagentが大部分を必要としない限り、大きなSkillをpreloadしない。
- compact後のSkill再注入は末尾が切られる可能性があるため、必須instructionを先頭に置く。

### 3. 軽量経路と高保証経路を分ける

通常経路には、日常作業に必要な判断だけを置く。manifest、多段judge、証拠schema、網羅的audit表は、明示的な高保証modeの後ろへ分離する。

これにより、安全性・監査用workflowが小さなタスクすべての固定費になることを防ぐ。独立判定、追跡可能性、規制対応の証拠が受け入れ条件に含まれる場合は、高保証modeを使う価値がある。

### 4. 委譲の損益分岐を判定する

次のすべてを満たす場合だけ委譲する。

1. 作業が自己完結している。
2. 範囲、停止条件、受け入れ条件を最初の委譲messageに書き切れる。
3. 戻り値を短い結論と証拠pointerにできる。
4. メインコンテキストの増加を防ぐ効果が、agent起動と結果統合のコストを上回る。

この原則から、次の運用を導く。

- 既知の短いReadや小さなコマンドは直接実行する。
- 同じ目的の検索・検証コマンドは、1回の有界なscout依頼にまとめる。
- モデルコストを理由に委譲する場合は、modelを固定したcustom agentを使う。
- forkは親会話を継承するため、コンテキスト隔離には使わない。
- 通常はqueueし、wall-clock短縮の価値が同時消費を上回る場合だけ並列化する。
- 継続が本当に必要な場合は、最初から起動し直さずresume可能なagentを再開する。

### 5. 戻りコンテキストを小さく保つ

Agent promptには、入力境界と出力境界の両方を定義する。

- 調査可能なdirectory・file。
- 検索語またはcommand。
- 最大深度、hit数、turn数。
- 停止条件。
- 結論、`file:line`、未解決事項などの出力schema。
- 成果物として明示されていない限り、生log、file全文、巨大diffを返さない規則。

### 6. Hookを無出力・event駆動にする

- Hookは決定的なライフサイクル強制に使い、繰り返しの文章指示には使わない。
- 何もしない正常系では、stdoutや `additionalContext` を出さず正常終了する。
- 静的な `UserPromptSubmit` 注入を避ける。小さな不変条件はルートinstruction、手順はSkillへ置く。
- 長時間動く外部状態には、background monitor、notification、channel、runtimeのwait primitiveを使う。
- cache維持やtick表示だけを目的としたmodel turnを作らない。

Anthropicはpluginのbackground monitorを、出力が発生したときにClaudeへ通知し、Claude自身にpollingを指示する必要をなくす仕組みとして説明している。一次資料: [Claude Code Plugins](https://code.claude.com/docs/en/plugins#add-background-monitors-to-your-plugin)。

### 7. Retryとerror loopを制限する

tool-not-found、permission-denied、wrapper使用法の誤りを繰り返すと、新しい証拠なしにturnだけが増える。次の停止規則を設ける。

- 最初の失敗後に、errorと公式の呼び出し方法・設定を確認する。
- 条件を変えずに同じ失敗操作を繰り返さない。
- 具体的な変更を行った後だけ1回再試行する。
- 同じ失敗が残る場合は、pollingせずblockerを報告するか、許可された範囲の設定を修復する。

### 8. セッション境界を意図的に置く

- 無関係な作業へ移るとき、またはPR・Phaseが完了したときは `/clear`。
- 継続性には価値があるが、蓄積した詳細が不要なときは、対象を指定した `/compact`。
- 長時間タスクが正確な決定やtest結果に依存する場合は、compact前に永続的なrepository artifactへ状態を保存する。
- transcript長から推測するだけでなく、`/context` で実際の構成を確認する。

このリポジトリの150k tokensでの事前compactは、見直しを始めるtriggerであり、必須の打ち切り値ではない。測定によってより良い閾値が得られた場合は更新する。

## レビューチェックリスト

Skill / Pluginを公開する前に確認する。

- [ ] descriptionに狭いtriggerと、近接する非triggerがある。
- [ ] Claude専用の手動Skillは `disable-model-invocation: true` を使っている。または、共有SkillがClaude側overrideを使う理由を記録している。
- [ ] `SKILL.md` の入口には、共通workflowと必須制約だけがある。
- [ ] 各referenceに明示的な読込条件があり、正本が重複していない。
- [ ] Subagent定義で適切なmodelを固定し、範囲・turn・出力を制限している。
- [ ] forkは親会話の継承が意図された場合だけ使っている。
- [ ] 静的contextを全promptへ注入するhookがない。
- [ ] 外部状態の待機に会話型sleep/poll loopを使っていない。
- [ ] Error retryには、新しい証拠または条件変更が必要になっている。
- [ ] 高保証orchestrationは、domain要件がない限り明示opt-inになっている。
- [ ] manifest、frontmatter、script、観測可能な挙動を検証している。
- [ ] 製品仕様、ローカル観測、設計上の推論を区別している。

## この指針の更新

Claude CodeやCodexのSkill読込、compaction、subagent起動、hook、model選択が変わった場合は、リンクした一次資料を再確認する。日付付きのローカル測定値は、明示的かつ更新可能なheuristicへ抽象化しない限り、規範的なルールへ直接埋め込まない。
