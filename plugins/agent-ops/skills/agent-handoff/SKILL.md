---
name: agent-handoff
description: "Operate handoff-driven delegation to model-strategy-selected external agents: write canonical handoff instructions, choose the target-specific headroom execution route, design gates, and audit evidence. Japanese triggers: 「Claude Code に作業させて」「Codex に作業させて」「指示書を作成して委譲して」「外部エージェントに実装させて」「監督とレビューを担当して」."
---

# agent-handoff 運用規律

外部エージェントへ作業を委譲するとき、指示書・停止点・監査証跡を先に固定してから実行する。

この文書で `PLUGIN_ROOT` と書く場合は、Claude Code では `${CLAUDE_PLUGIN_ROOT}`、Codex ではこの `SKILL.md` の 2 階層上にある `agent-ops` プラグインルートを指す。リファレンスはすべて `PLUGIN_ROOT/references/` 配下。

## 0. 原則

**委譲先の自己報告は成果物ではない。検証可能な証拠だけを受け入れる。**

役割は分離する。自分は指示書作成・監督・監査を担当し、委譲先の外部エージェントは実装を担当する。

## 1. 既存プラグインとの境界

`model-strategy` は、どのモデル・effort・委譲先を選ぶかを判断する。`agent-handoff` は、選んだ後の委譲の運用規律 (指示書・ゲート・監査) を担う。

委譲先の価格・モデル・effort 判断は、インストールされていれば `model-strategy` を参照し、このスキルでは重複させない。

## 2. フロー

0. **状態を読んで運用モードを宣言する**: `PLUGIN_ROOT/references/06-operating-protocol.md` に従い、対象プロジェクトの台帳 (`docs/handoff-ledger.md`) からフェーズと Fable-off カウンタを読み、最初の応答で今回のモード (著者・批評体制) を宣言する。以降の手順はユーザーに記憶させず、監督役が各ステップで次の行動を提示する。
1. **実行経路を確認する**: 外部エージェントは必ず委譲先に応じたトークン計測プロキシ経由で起動する。直接起動してしまった場合は即停止し、痕跡がないことを確認してから正しい経路で再実行する。
2. **指示書を作成する**: `PLUGIN_ROOT/references/00-handoff-template.md` のテンプレートに従う。著者を自分にするか Fable にするかは `PLUGIN_ROOT/references/05-fable-independence.md` のフェーズに従う。
3. **着手前ゲートを組み込む**: `PLUGIN_ROOT/references/03-preflight-gate.md` に従い、M0 (調査・作戦フェーズ) を指示書の先頭マイルストーンに置く。高リスク・新規タスク類型では、委譲前にアンサンブル批評を追加する。
4. **ゲートを設計する**: 失敗コストが大きい・技術的不確実性がある場合は、本実装の前に Go/No-Go スパイクを挟む。長い作業はマイルストーンに分割し、各末尾で委譲先を停止させ承認を待つ。
5. **実行する**: 起動形態・フラグは委譲先に応じて `PLUGIN_ROOT/references/02-execution-claude.md` または `PLUGIN_ROOT/references/02-execution-codex.md` に従う。M0 の「確認が必要」がゼロになるまで M1 を承認しない。
6. **監査する**: `PLUGIN_ROOT/references/01-audit-checklist.md` を適用する。指摘は重大度順に列挙して差し戻すか、証拠を確認して受け入れる。各指摘に「指示書起因かどうか」のタグを付ける。
7. **振り返る**: `PLUGIN_ROOT/references/04-retrospective-ledger.md` の形式で台帳に記録し、繰り返し現れた欠落はテンプレートへ還流する。

## 3. 著者体制と Fable 非依存化

このスキルの最終目標は、Fable が利用できなくなっても、自分の指示で同等の委譲品質を維持できる状態である。ベースライン記録・批評採掘・Fable-off 訓練・フェーズ移行は `PLUGIN_ROOT/references/05-fable-independence.md` に従う。

## 4. リファレンス

| ファイル | いつ読むか |
| --- | --- |
| `references/06-operating-protocol.md` | 発火直後 (運用モード判定と進行の自動化) |
| `references/00-handoff-template.md` | 指示書を作るとき |
| `references/03-preflight-gate.md` | 指示書を委譲する前 (M0 設計・アンサンブル批評) |
| `references/02-execution-claude.md` | Claude Code を起動する前 |
| `references/02-execution-codex.md` | Codex を起動する前 |
| `references/01-audit-checklist.md` | 委譲先の成果物を受け入れる前 |
| `references/04-retrospective-ledger.md` | 監査後、委譲 1 件を締めるとき |
| `references/05-fable-independence.md` | 著者体制を決めるとき / Fable-off 訓練のとき |
