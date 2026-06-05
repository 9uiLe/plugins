# Releasing

このリポジトリのリリース手順の **正本** です。`scripts/` 配下のシェルスクリプトと CI ワークフローがこの手順を機械化しています。

設計判断の根拠は [`docs/adr/0001-release-automation.html`](./docs/adr/0001-release-automation.html) を参照してください。

---

## 前提

- ローカルに以下がインストールされている: `bash` `git` `jq` `gh` ([forge](https://github.com/9uiLe/forge) は任意)
- `gh auth status` が成功している
- 作業ブランチに移っていない `master` 上にいる
- ワークツリーが clean（未コミットの変更がない）

---

## バージョンの二軸

このリポジトリは **2 種類のバージョン番号**を持ちます。混同しないでください。

| 軸 | どこに書かれるか | 何を表すか |
| --- | --- | --- |
| **プラグイン版** | `plugins/<name>/.claude-plugin/plugin.json`<br>`.claude-plugin/marketplace.json` の `plugins[].version` | 個別プラグインの互換性追跡 |
| **リリース版** | `.claude-plugin/marketplace.json` の `metadata.version`<br>git tag `vX.Y.Z` / `releases/vX.Y.Z.md` / `CHANGELOG.md` の `[X.Y.Z]` 見出し | リポジトリ全体のスナップショット番号 |

整合性ゲート: **リリース版 ≥ max(プラグイン版)**（`verify-versions.sh` が CI で検査）。

---

## 手順（推奨フロー）

### 1. リリース対象を決める

- どのプラグインを bump するか（例: `quality-architect`）
- プラグインの bump 種別（`patch` / `minor` / `major`）
- リリース版の bump 種別（同じ。デフォルト `patch`）
- 例: `quality-architect` を patch、リリース版を patch → quality-architect 0.1.1 → 0.1.2、リポジトリ v0.1.1 → v0.1.2

### 2. dry-run で差分を確認

```bash
scripts/release-prepare.sh --plugin quality-architect --bump patch --release-bump patch --dry-run
```

ファイルは書き換えず、CHANGELOG・plugin.json・marketplace.json・releases/*.md の差分プレビューが流れます。

### 3. 本番実行（PR 作成まで）

```bash
scripts/release-prepare.sh --plugin quality-architect --bump patch --release-bump patch
```

実行内容:

1. 前提チェック（`gh`/`jq`/`git`、clean、`master`、tag 重複なし）
2. `release/vX.Y.Z` ブランチを作成
3. `plugin.json` と `marketplace.json` の version を bump
4. `CHANGELOG.md` の `[Unreleased]` を `[X.Y.Z] - YYYY-MM-DD` に繰り上げ＋ compare リンク差し替え
5. `releases/vX.Y.Z.md` 雛形を生成
6. `verify-versions.sh` で事後検証
7. **タイプ確認プロンプト**（バージョン文字列を再入力）
8. `chore(release): vX.Y.Z` でコミット & push
9. `forge gh pr-create` で PR を作成

途中で失敗・中断した場合は ERR/INT トラップが `git restore` + 作業ブランチ削除を自動実行します（push 前のみ）。

### 4. リリースノートのハイライトを加筆

`releases/vX.Y.Z.md` の `## ハイライト` セクションに、1〜3 行で主要な変更点を手で書き加え、PR にプッシュしてください。

### 5. ローカルで動作確認

```bash
/plugin marketplace add /Users/<you>/workspace/plugins
/plugin install <plugin-name>@9uile-plugins
```

対象 Skill を 1 回実行し、回帰がないか確認します。

### 6. PR レビュー & マージ

PR がレビュー・CI green を経てマージされたら、ローカルで `master` を pull。

```bash
forge git checkout master
forge git fetch-base
git pull --ff-only
```

### 7. タグ + GitHub Release を公開

```bash
scripts/release-publish.sh --version X.Y.Z
```

実行内容:

1. `master` clean / origin と一致 / tag 未存在を検証
2. **タイプ確認プロンプト**
3. annotated tag `vX.Y.Z` を作成・push
4. `gh release create` で `releases/vX.Y.Z.md` を本文に公開

---

## オプション

| フラグ | 用途 |
| --- | --- |
| `--dry-run` | ファイル書き換えと git/gh 操作をスキップし、差分プレビューだけ表示する（初回は必ずこれ） |
| `--yes` | すべての確認プロンプトをスキップする（CI 等の無人実行向け。**通常は使わない**） |
| `--release-bump <patch\|minor\|major>` | リリース版（`metadata.version`）の bump 種別。デフォルト `patch` |
| `--release-version <X.Y.Z>` | リリース版を明示指定（プラグイン版を一気に上げる時など。`--release-bump` と排他） |
| `--no-pr` | `release-prepare` で push までで止め、PR は手動で作る |

---

## 整合性ゲート（CI）

`.github/workflows/verify-versions.yml` が PR ごとに以下を実行します。

- `shellcheck -x scripts/**/*.sh`
- `bash scripts/verify-versions.sh`
  - 各プラグインの `plugin.json.version` と `marketplace.json.plugins[].version` の一致
  - `marketplace.json.metadata.version` が最大プラグイン版以上であること

ローカルでも手動実行できます:

```bash
bash scripts/verify-versions.sh
```

---

## トラブルシューティング

| 症状 | 原因 / 対処 |
| --- | --- |
| `working tree is not clean` | 未コミットの変更がある。`git status` で確認し、コミットか `git stash` してから再実行 |
| `current branch is '...', expected 'master'` | `git checkout master` で master に戻ってから再実行 |
| `local master is not in sync with origin/master` | `git pull --ff-only` で同期してから再実行 |
| `tag vX.Y.Z already exists` | 同じバージョンの tag が既に存在する。バージョン番号を見直す |
| `[Unreleased] section is empty` | `CHANGELOG.md` の `## [Unreleased]` 直下に変更点を記入してから再実行 |
| `new version X.Y.Z is not greater than previous Y.Y.Y` | bump 方向 / 引数を見直す |
| `plugin version X.Y.Z is greater than release version A.B.C` | プラグイン版がリリース版を超えている。`--release-version X.Y.Z`（プラグイン版以上）で再実行 |
| 途中で abort された | push 前なら ERR トラップで自動巻き戻し済み。push 後の場合は手動で `git push origin --delete release/vX.Y.Z` してリトライ |

---

## やってはいけないこと

- ❌ `--yes` をデフォルトで使う（誤操作の保護機能を無効化する）
- ❌ `master` に直接 push する（必ず PR 経由）
- ❌ `release-publish` を PR マージ前に実行する（tag が宙ぶらりんになる）
- ❌ `releases/vX.Y.Z.md` のハイライトを `TODO` のままマージする
- ❌ スクリプト・ドキュメント・CI ワークフローを別 PR で更新する（同一 PR で揃える — 仕様ドリフト防止）

---

## スクリプト構成

```
scripts/
├── lib/
│   ├── common.sh         # ログ・前提チェック・確認プロンプト・rollback
│   ├── version.sh        # plugin.json / marketplace.json の version 読み書き
│   ├── changelog.sh      # CHANGELOG セクション繰り上げ + compare リンク
│   └── release-notes.sh  # releases/vX.Y.Z.md 雛形生成
├── release-prepare.sh    # ブランチ → 編集 → コミット → PR
├── release-publish.sh    # tag → GH Release
└── verify-versions.sh    # 整合性ゲート（CI + ローカル）
```

詳細な設計判断は [ADR-0001](./docs/adr/0001-release-automation.html) を参照。
