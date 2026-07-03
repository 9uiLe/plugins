---
name: codex-handoff
description: "Operate handoff-driven delegation to external agents such as Codex: write canonical handoff instructions, run through headroom wrap codex, design gates, and audit evidence. Japanese triggers: 「Codex に作業させて」「指示書を作成して委譲して」「headroom wrap codex で」「外部エージェントに実装させて」「監督とレビューを担当して」."
---

# Codex ハンドオフ運用規律

外部エージェントへ作業を委譲するとき、指示書・停止点・監査証跡を先に固定してから実行する。

この文書で `PLUGIN_ROOT` と書く場合は、Claude Code では `${CLAUDE_PLUGIN_ROOT}`、Codex ではこの `SKILL.md` の 2 階層上にある `agent-ops` プラグインルートを指す。リファレンスはすべて `PLUGIN_ROOT/references/` 配下。

## 0. 原則

**委譲先の自己報告は成果物ではない。検証可能な証拠だけを受け入れる。**

役割は分離する。自分は指示書作成・監督・監査を担当し、委譲先 (Codex 等) は実装を担当する。

## 1. 既存プラグインとの境界

`model-strategy` は、どのモデル・effort・委譲先を選ぶかを判断する。`codex-handoff` は、選んだ後の委譲の運用規律 (指示書・ゲート・監査) を担う。

Codex の価格・モデル判断は、インストールされていれば `model-strategy` の `references/07-codex.md` を参照し、このスキルでは重複させない。

## 2. フロー

1. **実行経路を確認する**: 外部エージェントは必ずトークン計測プロキシ (`headroom wrap codex`) 経由で起動する。直接起動してしまった場合は即停止し、痕跡がないことを確認してから正しい経路で再実行する。
2. **指示書を作成する**: `PLUGIN_ROOT/references/00-handoff-template.md` のテンプレートに従う。
3. **ゲートを設計する**: 失敗コストが大きい・技術的不確実性がある場合は、本実装の前に Go/No-Go スパイクを挟む。長い作業はマイルストーンに分割し、各末尾で委譲先を停止させ承認を待つ。
4. **実行する**: 起動形態・フラグは `PLUGIN_ROOT/references/02-execution-codex.md` に従う。
5. **監査する**: `PLUGIN_ROOT/references/01-audit-checklist.md` を適用する。指摘は重大度順に列挙して差し戻すか、証拠を確認して受け入れる。

## 3. リファレンス

| ファイル | いつ読むか |
| --- | --- |
| `references/00-handoff-template.md` | 指示書を作るとき |
| `references/01-audit-checklist.md` | 委譲先の成果物を受け入れる前 |
| `references/02-execution-codex.md` | Codex を起動する前 |
