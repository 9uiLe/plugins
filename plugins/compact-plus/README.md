# compact-plus

[Architecture](./docs/architecture.md)

> [u-ichi/compact-plus](https://github.com/u-ichi/compact-plus) (MIT License, v1.0.2) の移植版です。原著作者は Yuichi Uemura 氏。upstream からの変更点は [本移植版での変更点](#本移植版での変更点) を参照してください。

Codex を超えるセッション継続 (state 保存 + 復旧誘導 + skill 復元) を Claude Code の `/compact` に上乗せする透過型プラグイン。Claude Code の圧縮アルゴリズム自体は置き換えず、公式 hook 経路で圧縮前後を強化する。

## 何ができるか

- 圧縮前に transcript を backup し、LLM で 10 見出しの state file を書き出す
- 圧縮後に state file、plan file、原文再読 note を additionalContext として注入する
- state file から呼び出し済み skill 一覧を復元させる (Codex 標準にない機構)
- コンテキスト使用率が指定閾値 (default 60%) を超えたら、次の user prompt で `/compact` を推奨する通知を出す
- 通知と同時に state file の Active Plan / Current Phase / 直近 Session Decision を 3 行 additionalContext に注入し、圧縮直前まで agent が作業の大局を見失わないようにする (compact 動作そのものは変わらないが、warn 発火から実 `/compact` までの数ターンで agent が脱線するのを防ぐ focus 補助)
- `/compact-plus` skill で手動 state 保存もできる

## 使い方

インストール後は普通に `/compact` を実行するだけで動く。**追加の操作は不要**、完全透過型。

- 手動 `/compact` でも auto-compact でも同じ経路で hook が発火する
- 圧縮前: transcript backup と 10 見出し state file 生成が PreCompact hook で自動実行される
- 圧縮後: 次の user prompt で recovery guidance が UserPromptSubmit hook 経由で additionalContext に自動注入される
- agent が特定 skill を呼ぶ必要も、事前に何かを実行する必要もない

任意で強化する場合:

- `/compact 重要な設計判断は必ず残して` のように引数を付けると、その内容が state 生成 LLM への priority guidance になる
- 復旧メモを厚く残したい時は圧縮直前に `/compact-plus` を明示的に呼ぶと、agent 自身が構造化 state を書く手動 fallback 経路に入る

## 前提

- Claude Code v2.x 以降
- LLM backend として `claude -p` または `codex exec`
- default 構成では primary に `claude -p --model claude-sonnet-5 --effort medium`、fallback に `codex exec --model gpt-5.3-codex-spark` を使う
- fallback の Codex Spark は ChatGPT Pro が前提。`gpt-5.4` / `gpt-5.5` などへ切り替え可能

## インストール

Claude Code 上で次を実行してください:

```
/plugin marketplace add 9uiLe/plugins
```

その後、compact-plus をインストールします:

```
/plugin install compact-plus@9uile-plugins
```

## 設定

Claude Code plugin の標準に従い、`~/.claude/settings.json` の `env` block に env var を書く。session ごとの一時上書きは shell の `export` でもよい。

### backend 上書き

primary / fallback を丸ごと差し替える env var は 2 個。

| env var | 意味 |
|---|---|
| `COMPACT_PLUS_PRIMARY_BACKEND` | primary で実行する shell コマンド全体。空文字列 (`""`) で primary skip |
| `COMPACT_PLUS_FALLBACK_BACKEND` | fallback で実行する shell コマンド全体。空文字列で fallback skip |

コマンド内で参照できる env var:

- `$SYSTEM_PROMPT`: LLM 用 system prompt (`prompts/state-summary.md` の内容)
- `$SESSION_ID`: Claude Code session id
- `$TRANSCRIPT_PATH`: transcript JSONL path
- `$MAX_OUTPUT_TOKENS`: LLM 出力上限

デフォルト値は `hooks/precompact-state-summary.sh` に直書きしている。

`~/.claude/settings.json` 例。Haiku で安く済ませたい場合:

```json
{
  "env": {
    "COMPACT_PLUS_PRIMARY_BACKEND": "claude -p --model claude-haiku-4-5-20251001 --effort low --permission-mode dontAsk --output-format text --no-session-persistence --system-prompt \"$SYSTEM_PROMPT\""
  }
}
```

state 生成は要約タスクなので、`COMPACT_PLUS_PRIMARY_BACKEND` を Haiku に差し替えても実用上十分な場合が多い。「高価なモデルは判断に、安価なモデルは作業量に使う」という model-strategy プラグインの方針とも整合する使い分け。既定 (Sonnet, effort medium) は upstream のまま変更していない。

primary を Codex Spark に差し替える例 (ChatGPT Pro 前提、Cerebras 経由で高速):

```json
{
  "env": {
    "COMPACT_PLUS_PRIMARY_BACKEND": "tmp=$(mktemp \"${TMPDIR:-/tmp}/compact-plus-codex.XXXXXX\"); { printf \"%s\\n\\n\" \"$SYSTEM_PROMPT\"; cat; } | codex exec --model gpt-5.3-codex-spark --sandbox read-only --skip-git-repo-check --dangerously-bypass-hook-trust --ignore-user-config --ephemeral --output-last-message \"$tmp\" - >/dev/null && cat \"$tmp\"; status=$?; rm -f \"$tmp\"; exit \"$status\""
  }
}
```

Codex 経路は stdout に preamble が混ざる場合があるため、`--output-last-message "$tmp"` で最終メッセージだけ取り出す必要がある (これは default fallback の実装と同じ形)。

fallback を無効化する例:

```json
{
  "env": {
    "COMPACT_PLUS_FALLBACK_BACKEND": ""
  }
}
```

### transcript / squash / two-pass のチューニング env

| env var | default | 意味 |
|---|---|---|
| `COMPACT_PLUS_TRANSCRIPT_MODE` | `incremental` | `incremental` / `head-tail` / `tail` |
| `COMPACT_PLUS_TRANSCRIPT_HEAD_TURNS` | `5` | head 側で切り出す turn 数 |
| `COMPACT_PLUS_TRANSCRIPT_TAIL_TURNS` | `25` | tail 側で切り出す turn 数 |
| `COMPACT_PLUS_TRANSCRIPT_HEAD_KB` | `10` | head 側 byte cap (KB) |
| `COMPACT_PLUS_TRANSCRIPT_TAIL_KB` | `40` | tail 側 byte cap (KB) |
| `COMPACT_PLUS_INCREMENTAL_REFRESH` | `10` | N 回に 1 回、既存 state を保持したまま transcript を head/tail から再サンプリングして再生成 (incremental の差分読みで生じたドリフトの補正)。`0` で無効 |
| `COMPACT_PLUS_MAX_OUTPUT_TOKENS` | `4096` | LLM 出力上限。backend が参照する場合に使う |
| `COMPACT_PLUS_SQUASH_ENABLED` | `1` | tool_result squash on/off |
| `COMPACT_PLUS_SQUASH_READ_LINES` | `100` | Read tool `> N` 行で `[Read: N lines from path]` に置換 |
| `COMPACT_PLUS_SQUASH_BASH_CHARS` | `500` | Bash tool `> N` chars で `[Bash: exit code, N chars output]` に置換 |
| `COMPACT_PLUS_TWO_PASS` | `1` | 2-pass self-critique on/off |

### warn 通知の statusline 配線

upstream (u-ichi/compact-plus) は、warn マーカー (`${TMPDIR}/claude-compact-warn/<session_id>`) を作者 dotfiles の statusline.sh に書かせる前提だった。そのままではプラグイン単体で reminder hook (`userpromptsubmit-compact-plus-reminder.sh`) が動かないため、本移植版は `scripts/compact-warn-statusline.sh` を同梱し、自己完結で動くようにした。

> **注意**: プラグインは statusLine を自動注入できない (Claude Code の仕様)。使いたい場合は自分の `settings.json` に 1 度だけ配線する。

```json
{
  "statusLine": {
    "type": "command",
    "command": "/absolute/path/to/plugins/compact-plus/scripts/compact-warn-statusline.sh"
  }
}
```

> **注記**: `statusLine` はプラグイン外 (ユーザー/プロジェクトの `settings.json`) の設定のため、`${CLAUDE_PLUGIN_ROOT}` は展開されない。marketplace 経由でインストールした場合の実体は
> `~/.claude/plugins/cache/<marketplace名>/compact-plus/<version>/scripts/compact-warn-statusline.sh` に展開されるが、version 付きパスは更新のたびに変わるため、リポジトリ checkout のパスを直接指定するのが確実。

- 警告閾値は環境変数 `COMPACT_WARN_THRESHOLD` (既定 `60` = 使用率%) で変更できる。
- 使用率が閾値以上になった次回の statusline 呼び出しで warn マーカーを書く (cooldown マーカーが立っている間は書かない)。閾値未満に戻れば古い warn マーカーを削除する。
- コンテキスト使用率の表示自体を他プラグインに譲りたい場合 (例: model-strategy プラグインの `context-statusline.sh`) は、環境変数 `COMPACT_PLUS_STATUSLINE_DELEGATE` に**絶対パスで**そのコマンドを設定すると、同じ statusline JSON をそのコマンドへ委譲して表示する (`${CLAUDE_PLUGIN_ROOT}` が使えない事情は同上)。warn マーカーの生成・削除ロジックは委譲時も変わらず動く。
- `jq` が必要 (未インストールなら案内メッセージのみ表示し、statusline を壊さない。fail-open)。

**既に独自の statusLine を使っている場合の共存レシピ**: 表示を失わずに warn マーカー機能だけを足せる。

1. `statusLine.command` を compact-plus の `compact-warn-statusline.sh` の絶対パスに差し替える。
2. これまで使っていた statusLine スクリプトの絶対パスを、環境変数 `COMPACT_PLUS_STATUSLINE_DELEGATE` に設定する。

```json
{
  "env": {
    "COMPACT_PLUS_STATUSLINE_DELEGATE": "/absolute/path/to/your/existing-statusline.sh"
  },
  "statusLine": {
    "type": "command",
    "command": "/absolute/path/to/plugins/compact-plus/scripts/compact-warn-statusline.sh"
  }
}
```

compact-plus が先に warn マーカーの判定・生成を行い、その後まったく同じ statusline JSON を既存スクリプトへ委譲するので、表示はこれまでどおり保たれる。委譲先は自作スクリプトでも他プラグイン (例: model-strategy の `context-statusline.sh`) でもよい。

### `/compact` 引数

`/compact 重要な設計判断は必ず残して` のように任意の自然文引数を渡すと、state 生成 LLM に priority guidance として反映される。

## 本移植版での変更点

upstream v1.0.2 からこのリポジトリに移植するにあたり、以下を変更した:

- `scripts/get-session-id.sh` を同梱し、upstream が前提としていた作者 dotfiles (`~/.claude/scripts/get-session-id.sh`) への依存を解消した。
- `scripts/compact-warn-statusline.sh` を同梱し、warn マーカー生成を自己完結化した (上の「warn 通知の statusline 配線」を参照)。
- `skills/compact-plus/SKILL.md` を日本語化した。`codex_description` frontmatter は削除 — このリポジトリの Codex 対応は SKILL.md frontmatter ではなく `.codex-plugin/plugin.json` と `.agents/plugins/marketplace.json` (Codex マニフェスト) で行う方式のため (CONTRIBUTING.md 参照)。
- バージョンを upstream の `1.0.2` から `0.1.0` として再スタートした (このリポジトリのリリースゲート「リリース版 ≥ max(プラグイン版)」に合わせるため)。

移植後のレビューで確認された以下の点についても、upstream のロジックに手を加えて修正した (このリポジトリ独自の変更点であり、upstream には反映されていない):

- tool-output squash が実際の Claude Code transcript (tool_result 行に tool 名が含まれない形式) でも機能するよう、`hooks/precompact-state-summary.sh` に tool_use_id → tool 名のマップと `toolUseResult` 由来のテキスト抽出を追加した。
- state 生成 backend の出力検証を「先頭行 `# Compact Prep State` のみ」から「必須 10 見出し全部が揃っているか」に強化した。検証に落ちたら fallback backend に切り替わる。
- state file の書き込みに失敗した場合、offset/counter を進めないようにした (未保存範囲を次回スキップしてしまう不具合の防止)。
- refresh 周期でも既存 state を LLM に渡すようにした (incremental の差分読みで生じたドリフトを refresh のタイミングで補正できるようにするため)。
- warn マーカーの削除とcooldown マーカーの作成の順序を入れ替え (cooldown 作成 → warn 削除)、二重通知になり得るレースを予防した。
- `COMPACT_PLUS_TWO_PASS=0` を指定した場合に self-critique パスを実際にスキップするよう、`prompts/state-summary.md` に一文追記した (従来はプロンプト側が常に two-pass を指示していた)。
- statusLine 配線例を絶対パス指定に修正した (`${CLAUDE_PLUGIN_ROOT}` は statusLine のコマンド文字列としては展開されないため)。
- `skills/compact-plus/SKILL.md` の frontmatter から、Claude Code の documented key ではない `strict_procedure` を削除した (本文の「strict-procedure プロファイル」節はそのまま維持)。

## 動作フロー

1. **PreCompact hook**
   - `precompact-transcript-backup.sh` が transcript JSONL を `~/.claude/backups/transcripts/` にコピーする
   - `precompact-state-summary.sh` が transcript を semantic chunking + tool output squash 後、primary / fallback backend で LLM を呼び、10 見出しの state file を書く
2. **PostCompact hook**
   - `compaction-recovery.sh` が recovery marker を書き、warn cooldown をリセットする
3. **UserPromptSubmit hook**
   - `userpromptsubmit-compaction-recovery.sh` が marker を検知して state file と plan file への参照、および「memory / rule / skill 言及は圧縮 summary の要約であり原文が authoritative」という factual note を additionalContext に注入する
   - state file に `## Skills Invoked` があれば、skill 一覧の参照案内も追加する
   - `userpromptsubmit-compact-plus-reminder.sh` が warn marker 検知時に軽い notification と state 3 行 recitation を additionalContext に注入する
4. **手動 fallback (`/compact-plus` skill)**
   - agent 自身が SKILL.md の 10 見出し手順に従って state file を書く

## state file 見出し構成

`# Compact Prep State` から始まる 10 見出し。SKILL.md 手動手順と LLM 生成の両方で同じ順序を使う。

1. `## Active Plan`
2. `## Current Phase`
3. `## TaskList Summary`
4. `## Session Decisions`
5. `## Constraints and Blockers`
6. `## Worker Topology`
7. `## Skills Invoked`
8. `## Editing Files`
9. `## Failed Attempts`
10. `## Recovery Notes`

## marker ファイル

| path | writer | reader | 目的 |
|---|---|---|---|
| `${TMPDIR}/claude-compact-state/<session_id>.md` | `precompact-state-summary.sh` / `/compact-plus` skill | recovery hook / agent | 圧縮前 state |
| `${TMPDIR}/claude-compact-state-offset/<session_id>` | `precompact-state-summary.sh` | `precompact-state-summary.sh` | incremental 用 byte offset |
| `${TMPDIR}/claude-compact-state-counter/<session_id>` | `precompact-state-summary.sh` | `precompact-state-summary.sh` | refresh cycle counter |
| `${TMPDIR}/claude-compacted/<session_id>` | `compaction-recovery.sh` | `userpromptsubmit-compaction-recovery.sh` | PostCompact marker |
| `${TMPDIR}/claude-compact-warn/<session_id>` | `scripts/compact-warn-statusline.sh` (`statusLine` に配線した場合のみ) | `userpromptsubmit-compact-plus-reminder.sh` | 閾値超過通知 |
| `${TMPDIR}/claude-compact-warned/<session_id>` | `userpromptsubmit-compact-plus-reminder.sh` | statusline / recovery hook | 通知 cooldown |
| `${TMPDIR}/claude-active-plan/<session_id>` | plan-management hook | recovery hook | active plan path |

## セキュリティ

- hooks は transcript の全文コピーを `~/.claude/backups/transcripts/` に保存する (直近 20 世代を session id ごとに保持)。
- PreCompact hook (`precompact-state-summary.sh`) は transcript の断片を外部 LLM CLI (`claude -p` または `codex exec`) に渡して state file を生成する。backend の差し替えやサンドボックス方針は「backend 上書き」を参照。
- 詳細な脆弱性報告手順は、このリポジトリ全体の [SECURITY.md](../../SECURITY.md) を参照。

## Architecture

設計、Claude Code / Codex CLI の compact 仕様比較、marker file の所有関係は [docs/architecture.md](./docs/architecture.md) を参照。

## Development Checks

```bash
python3 -m json.tool .claude-plugin/plugin.json >/dev/null
python3 -m json.tool ../../.claude-plugin/marketplace.json >/dev/null
python3 -m json.tool hooks/hooks.json >/dev/null
bash -n hooks/*.sh scripts/*.sh
```
