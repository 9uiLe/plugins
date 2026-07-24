---
name: second-opinion
description: "Summon an external second-opinion reviewer over the CURRENT Claude Code or Codex session. Mechanically extract the conversation (no summarising by you) and send it unedited to Codex and/or Fable for a fixed five-section verdict: blind spots, convergence, ship/no-ship, decisive constraint, strongest counterargument. Backend, model, and effort are chosen at call time; if model/effort are unspecified, ask the user. Japanese triggers: 「セカンドオピニオンが欲しい」「アドバイザーに相談」「第三者の意見が欲しい」「Codex に見てもらって」「Fable に見てもらって」「この方針でいいか外部レビューして」「詰まったので別の視点が欲しい」."
---

# second-opinion — 外部アドバイザー召喚

Claude Code ビルトインの `advisor` と同じ狙い。**今の作業セッション全体を、盲点を持つ本人（あなた）が編集しないまま**、より独立した外部レビュアー（Codex / Fable）へ渡し、鋭い第二意見を得る。

## 0. 大原則: 作業エージェントはコンテキストを要約しない

advisor の価値は「盲点を持つ当人が curate していない生のコンテキスト」にある。**セッションを要約して渡してはならない。** 抽出は `scripts/second-opinion.mjs` が機械的に行う。Claude Code では生の assistant 出力、Codex では transcript に平文保存された reasoning summary と assistant 出力を含める（暗号化された reasoning は復号・推測しない）。仕事は「backend / model / effort を決め、スクリプトを起動し、結果をユーザーへ渡す」ことだけ。

## 1. いつ使うか

- 実質的な作業に着手する前（方針を固める前）
- 詰まったとき（エラーが再発する・収束しない）
- アプローチ変更を検討するとき
- 「完了した」と思ったとき（ship 判断の前）

## 2. フロー

### 2.1 backend を決める

ユーザーの言い方から判断する。判断できなければ、ホストで利用可能な質問 UI または通常の会話で聞く。

| ユーザーの意図 | `--backend` |
| --- | --- |
| 「Codex に見て」 | `codex` |
| 「Fable に見て」 | `fable` |
| 「両方に」「セカンドオピニオン」（無指定） | `both`（2体の独立レビュー。和集合が最優先の材料） |

### 2.2 model / effort を決める（無指定なら必ずユーザーへ確認）

引数で model / effort が与えられていればそれを使う。**与えられていなければ、利用可能な質問 UI（なければ通常の会話）で質問し、backend に応じた選択肢を出す**:

- **effort**（1問で可。ただし**受理される値は backend と、codex ではモデルごとに異なる** — スクリプトが dispatch 前に capability テーブルで検証し、非対応値は何も起動せず失敗する）:
  - 共通で使える値: `high`（推奨）/ `medium` / `xhigh` / `low`
  - fable: 上記 + `max`（`claude --help` 2026-07-23 確認: low/medium/high/xhigh/max）
  - codex `gpt-5.6-sol`（既定モデル。実機 probe 検証済みの唯一のエントリ）: 上記 + `max` / `ultra`。`minimal` はサーバー側で HTTP 400 拒否（2026-07-23 実機 probe 済み）
  - 検証テーブルにない codex モデル（Terra / Luna / 5.4/5.5 系を含む）は事前検証せず警告付きでサーバー判定に委ねる（effort の受理はサーバーがモデル別に強制する。ファミリー名からの一般化はしない）
  - `--backend both` では fable と codex 解決モデルの両方が受理する値のみ有効。黙示のリマッピング（例: `minimal`→`low`）は要求セマンティクスを変えるため行わない
- **model（codex 選択時のみ）**:
  - `gpt-5.6-sol（既定・推奨）` … second-opinion が `--model gpt-5.6-sol` を**明示的に**渡す。上位モデルを保証し、app-server の陳腐化した既定（`config.toml` を起動時にしか読まない常駐プロセス）に左右されない。実体は `scripts/second-opinion.mjs` の `CODEX_MODEL` 定数（環境変数 `SECOND_OPINION_CODEX_MODEL` で上書き可）。
  - `spark（gpt-5.3-codex-spark）` … 注: ChatGPT アカウント連携の Codex では非対応のことがある。失敗したら `gpt-5.6-sol` に戻す
  - その他（ユーザーが gpt-5 系の識別子を直接入力）
- **model（fable）**: 常に `claude-fable-5` 固定。質問不要。

> 上位モデル（Fable = `claude-fable-5` / Codex = `gpt-5.6-sol`）はアドバイザーの品質要件。codex は既定でも明示ピン留めされるため、未指定でも gpt-5.6-sol を下回らない。
> **フォールバック**: ピン留めモデルの失敗が**モデル不在エラー（改名・廃止・未ゲート等）と狭く分類できた場合に限り**、`runCodex` は `--model` なしで一度だけ再試行し、codex 既定へ退避する。ヘッダに `model=(codex default; pinned … not served)` と明示される。認証失敗・タイムアウト・ポリシーエラー・一時クラッシュでは**フォールバックせず失敗をそのまま返す**（モデル identity の黙示的すり替えを防ぐ）。`--no-fallback`（または `SECOND_OPINION_NO_FALLBACK=1`）で自動フォールバックを完全に無効化できる — **decision-council から使う場合は必須**（フォールバックは新しい参加者 identity であり新しい preflight を要するため。council 側 SKILL の "Never silently retry or fallback" 規律）。モデル ID を変えたいときは `CODEX_MODEL` 定数か `SECOND_OPINION_CODEX_MODEL` を更新する。

質問 UI が複数設問に対応する場合は、model / effort を一度に聞いてよい。

### 2.3 深さ（stakes 連動）

盲点は初期の前提に潜む。既定の抽出は「タスク定義＋全ユーザー発言＋transcript 上で可視な assistant 出力／reasoning summary＋全ツールエラー」を含み、長すぎる assistant 連鎖のみ中央を間引く。**ship 判断前・詰まり時など高リスクなら `--full` を付けて全文を渡す**（コストは上がるが漏れを防ぐ）。軽い確認は既定で十分。

### 2.4 起動する

```bash
SO=""
for ROOT in "${PLUGIN_ROOT:-}" "${CLAUDE_PLUGIN_ROOT:-}"; do
  [ -n "$ROOT" ] && [ -f "$ROOT/scripts/second-opinion.mjs" ] && SO="$ROOT/scripts/second-opinion.mjs" && break
done
[ -f "$SO" ] || SO="$(find "$HOME/.codex/plugins/cache" "$HOME/.claude/plugins" -path '*/second-opinion/scripts/second-opinion.mjs' 2>/dev/null | head -1)"

# Codex host: SessionStart の developer context に
# SECOND_OPINION_TRANSCRIPT_PATH="..." があれば、その値を正確にコピーする。
SOURCE_ARGS=()
# SOURCE_ARGS=(--source "/exact/path/from/SECOND_OPINION_TRANSCRIPT_PATH")

node "$SO" review \
  --backend <codex|fable|both> \
  [--model <model>] \
  [--effort <low|medium|high|xhigh|max | ultra(codex gpt-5.6-sol)>] \
  [--no-fallback] \
  "${SOURCE_ARGS[@]}" \
  [--full]
```

（Codex / Claude Code の plugin cache を順に探索する。以降の `setup` 等も同様に `$SO` を使う。）

- Claude Code では transcript は SessionStart hook が記録した env から自動解決される。
- Codex では SessionStart hook が developer context に出した `SECOND_OPINION_TRANSCRIPT_PATH` を編集せず `--source` へ渡す。transcript の形式は安定 API ではないため、抽出結果の counts がすべて 0 なら処理を止め、互換性エラーとして報告する。
- `--backend both` は Codex と Fable を順に走らせ、両者の指摘を並べる。**両方が挙げた点を最優先、片方だけの点は盲点候補として扱う。**

### 2.5 結果を渡す

スクリプトの出力（5セクション × backend）をユーザーへ提示する。あなたの意見で上書きせず、レビュアーの指摘をそのまま伝えたうえで、必要なら次アクションを1〜2行添える。

## 3. 5セクション契約（レビュアーが必ず返すもの）

1. **盲点** — 表面化していない前提・リスク
2. **収束判定** — アプローチは収束/発散のどちらか、根拠つきで
3. **ship / no-ship** — 出して良いか、決め手1つ
4. **決定的制約** — 勝敗を分ける制約はどれか
5. **最強の反論** — 現方針への最も強い反対論

契約はスクリプトが各 backend のプロンプト先頭に固定注入する。あなたが書き足す必要はない。

## 4. 準備 / トラブル時

- 初回や backend が動かないときは `node "$SO" setup` を実行する。Claude Code では `/second-opinion:setup` も利用できる。
- SessionStart hook は**プラグイン導入後の新しいセッションから**有効。Codex では `/hooks` で plugin hook を信頼してから新しいスレッドを開始する。
- 導入直後の Claude Code セッションは env 未設定のため、`resolve` が最新 mtime にフォールバックする。同時セッションがある場合は `--source` で明示する。
