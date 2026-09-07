# リポジトリ指針

## コンテキスト効率を考慮した Plugin / Skill 設計

- turnとagentを横断して処理される総コンテキスト量を、主要な利用量予算として扱う。モデル単価は二次的なレバーである。
- このルートファイルには、ほぼ全タスクで必要な不変条件だけを書く。手順はSkill、条件付きの詳細はreferenceへ置き、大きな文書をここから `@import` しない。
- Skill descriptionには狭いtriggerと近接する非triggerを書く。`disable-model-invocation: true` はClaude専用パッケージだけで使い、Claude/Codex共有Skillはportableなfrontmatterを保って、必要ならClaude側overrideを使う。
- `SKILL.md` の入口を短く保ち、必須制約を先頭へ置く。各referenceは明示的な条件を満たす場合だけ読む。
- 委譲は、自己完結しており、メインコンテキストの削減量がagent起動・統合コストを上回る作業だけに使う。コストを理由に委譲する場合は安価なmodelを固定し、context隔離にforkを使わない。
- 委譲する範囲、停止条件、turn、戻り値を制限する。生logや全文ではなく、結論と証拠pointerを優先する。
- 正常系のhookは無出力にする。静的な指示を毎回の `UserPromptSubmit` で注入せず、会話型sleep pollingではなくevent-driven monitorやruntimeのwait primitiveを使う。
- manifest、judge chain、網羅的auditは、タスクの受け入れ条件が必要としない限り、明示的な高保証modeの後ろへ置く。
- Tool・設定の同じ失敗を再試行する場合は、その前に新しい証拠または条件変更を要求する。
- PR・Phase完了時は `/clear` を推奨する。継続性に価値がありcontextが蓄積した場合は、状態を保存して対象を指定した `/compact` を使う。150k tokensはローカルな見直しtriggerであり、製品上限ではない。

Skill / Pluginを作成・更新・レビューするときは、`docs/context-efficient-skill-design.md` の該当節とレビューチェックリストを読む。それ以外のタスクでは読み込まない。

# Compact時に保持する情報

Compact時は、現在の目的、ユーザー制約、変更file、未解決の判断、検証commandと結果、次の具体的な作業を保持する。生log、失敗済みの試行、完了済みタスクの詳細は破棄する。
