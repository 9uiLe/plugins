---
name: second-opinion
description: "Summon an external second-opinion reviewer (advisor) over the CURRENT session. Mechanically extract the conversation (no summarising by you) and send it unedited to Codex and/or Fable, which return a fixed five-section verdict: blind spots, convergence, ship/no-ship, decisive constraint, strongest counterargument. Backend, model, and effort are chosen at call time; if model/effort are unspecified, ask the user. Japanese triggers: 「セカンドオピニオンが欲しい」「アドバイザーに相談」「第三者の意見が欲しい」「Codex に見てもらって」「Fable に見てもらって」「この方針でいいか外部レビューして」「詰まったので別の視点が欲しい」."
---

# second-opinion — 外部アドバイザー召喚

Claude Code ビルトインの `advisor` と同じ狙い。**今の作業セッション全体を、盲点を持つ本人（あなた）が編集しないまま**、より独立した外部レビュアー（Codex / Fable）へ渡し、鋭い第二意見を得る。

## 0. 大原則: あなたはコンテキストを要約しない

advisor の価値は「盲点を持つ当人が curate していない生のコンテキスト」にある。**あなたがセッションを要約して渡してはならない。** 抽出は `scripts/second-opinion.mjs` が機械的に行う（タスク定義・全ユーザー発言・思考の連鎖・全ツールエラーを固定フォーマットで抽出）。あなたの仕事は「backend / model / effort を決めて、スクリプトを起動し、結果をユーザーへ渡す」ことだけ。

## 1. いつ使うか

- 実質的な作業に着手する前（方針を固める前）
- 詰まったとき（エラーが再発する・収束しない）
- アプローチ変更を検討するとき
- 「完了した」と思ったとき（ship 判断の前）

## 2. フロー

### 2.1 backend を決める

ユーザーの言い方から判断する。判断できなければ AskUserQuestion で聞く。

| ユーザーの意図 | `--backend` |
| --- | --- |
| 「Codex に見て」 | `codex` |
| 「Fable に見て」 | `fable` |
| 「両方に」「セカンドオピニオン」（無指定） | `both`（2体の独立レビュー。和集合が最優先の材料） |

### 2.2 model / effort を決める（無指定なら必ず AskUserQuestion）

引数で model / effort が与えられていればそれを使う。**与えられていなければ `AskUserQuestion` で質問し、backend に応じた選択肢を出す**:

- **effort**（codex / fable 共通の設問。1問で可）:
  - `high`（推奨）/ `medium` / `xhigh` / `low`（`none` `minimal` は「その他」で受ける）
- **model（codex 選択時のみ）**:
  - `既定（未指定・推奨）` … Codex CLI の設定に委ねる（`--model` を渡さない）
  - `spark（gpt-5.3-codex-spark）` … 注: ChatGPT アカウント連携の Codex では非対応のことがある。失敗したら既定に切り替える
  - その他（ユーザーが gpt-5 系の識別子を直接入力）
- **model（fable）**: 常に `claude-fable-5` 固定。質問不要。

複数を一度に聞くときは AskUserQuestion の複数設問（最大4問）にまとめてよい。

### 2.3 深さ（stakes 連動）

盲点は初期の前提に潜む。既定の抽出は「タスク定義＋全ユーザー発言＋思考の連鎖＋全ツールエラー」を必ず含み、長すぎる思考連鎖のみ中央を間引く。**ship 判断前・詰まり時など高リスクなら `--full` を付けて全文を渡す**（コストは上がるが漏れを防ぐ）。軽い確認は既定（間引きあり）で十分。

### 2.4 起動する

```bash
SO="${CLAUDE_PLUGIN_ROOT:-}/scripts/second-opinion.mjs"
[ -f "$SO" ] || SO="$(find "$HOME/.claude/plugins" -path '*/second-opinion/scripts/second-opinion.mjs' 2>/dev/null | head -1)"
node "$SO" review \
  --backend <codex|fable|both> \
  [--model <model>] \
  [--effort <none|minimal|low|medium|high|xhigh>] \
  [--full]
```

（`${CLAUDE_PLUGIN_ROOT}` が空でもフォールバックでスクリプトを探す。以降の `setup` 等も同様に `$SO` の要領で解決してよい。）

- transcript は自動解決される（SessionStart hook が記録した env → codex の env → 最新 mtime の順）。解決に失敗したら `--source <path-to-jsonl>` を添えて再実行する。
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

- 初回や backend が動かないときは `/second-opinion:setup` を実行（依存 codex / claude の可用性、transcript 解決可否を点検し、不足を導入案内）。
- SessionStart hook は**プラグイン導入後の新しいセッションから**有効。導入直後の現行セッションは env 未設定のため、`resolve` が最新 mtime にフォールバックする（同時に複数セッションを開いていると誤選択の可能性 → その場合は `--source` で明示）。
