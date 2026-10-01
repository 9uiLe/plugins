# Releasing

このリポジトリのリリース手順の **正本** です。`scripts/` 配下のシェルスクリプトと CI ワークフローがこの手順を機械化しています。

---

## 前提

- ローカルに以下がインストールされている: `bash` `git` `jq` `gh`
- `gh auth status` が成功している
- 作業ブランチに移っていない `master` 上にいる
- ワークツリーが clean（未コミットの変更がない）

---

## バージョンの二軸

このリポジトリは **2 種類のバージョン番号**を持ちます。混同しないでください。

| 軸 | どこに書かれるか | 何を表すか |
| --- | --- | --- |
| **プラグイン版** | `plugins/<name>/.claude-plugin/plugin.json`<br>`plugins/<name>/.codex-plugin/plugin.json`<br>`.claude-plugin/marketplace.json` の `plugins[].version` | 個別プラグインの互換性追跡 |
| **リリース版** | `.claude-plugin/marketplace.json` の `metadata.version`<br>git tag `vX.Y.Z` / `releases/vX.Y.Z.md` / `CHANGELOG.md` の `[X.Y.Z]` 見出し | リポジトリ全体のスナップショット番号 |

1 回のリリースはリリース版を必ず 1 つ進め、プラグイン版は 0 件・1 件・複数件のいずれも変更できます。プラグインの追加・削除だけのリリースや、ドキュメント・スクリプトだけのリリースはプラグイン版を変更しません。

整合性ゲート: **リリース版 ≥ max(リリース後の全プラグイン版)**。`release-prepare.sh` が編集前（dry-run を含む）に検査し、`verify-versions.sh` が CI と事後条件で検査します。

---

## 手順（推奨フロー）

### 1. リリース対象を決める

- `CHANGELOG.md` の `[Unreleased]` に今回の変更点が書かれていること（空ならリリースできない）
- 版を変えるプラグインと、それぞれの変更（`patch` / `minor` / `major` の bump 種別、または `X.Y.Z` の明示版）。0 件でもよい
- リリース版の選び方（未指定なら現在の `metadata.version` の patch bump）

| リリースの種類 | コマンド例（`--dry-run` を付けて確認する） |
| --- | --- |
| プラグイン版を変えない | `scripts/release-prepare.sh` |
| 1 プラグイン | `scripts/release-prepare.sh --plugin model-strategy:patch` |
| 複数プラグイン | `scripts/release-prepare.sh --plugin model-strategy:minor --plugin speakerdeck-knowledge:patch` |
| プラグイン版を明示 | `scripts/release-prepare.sh --plugin model-strategy:0.5.0` |
| リリース版の bump 種別を指定 | `scripts/release-prepare.sh --plugin model-strategy:minor --release-bump minor` |
| リリース版を明示 | `scripts/release-prepare.sh --release-version 1.0.0` |

例: 現在 `metadata.version` が 0.7.2、`model-strategy` が 0.4.1 のとき、`--plugin model-strategy:patch` は model-strategy を 0.4.2、リポジトリを v0.7.3 にします。複数プラグインを指定してもリリース版は 1 つだけ進みます。

### 2. dry-run で差分を確認

```bash
scripts/release-prepare.sh --plugin model-strategy:patch --dry-run
```

ファイル・ブランチ・git を変更せず、本番実行と同じ入力（CHANGELOG の `[Unreleased]` 本文・直前のリリース版・日付）から作った CHANGELOG・Claude/Codex plugin.json・marketplace.json の差分、`releases/vX.Y.Z.md` の内容、stage するファイル、PR 本文を表示します。

### 3. 本番実行（PR 作成まで）

```bash
scripts/release-prepare.sh --plugin model-strategy:patch
```

実行内容:

1. 引数とリリース内容の検証（下記「リリース前に検証される条件」）
2. 前提チェック（`gh`/`jq`/`git`、clean、`master`、origin と一致、tag・ブランチ重複なし）
3. `release/vX.Y.Z` ブランチを作成
4. 指定した各プラグインの Claude/Codex `plugin.json` と `marketplace.json` の `plugins[].version`、および `metadata.version` を更新
5. `CHANGELOG.md` の `[Unreleased]` を `[X.Y.Z] - YYYY-MM-DD` に繰り上げ＋ compare リンク差し替え
6. `releases/vX.Y.Z.md` 雛形を生成
7. `verify-versions.sh` で事後検証
8. **タイプ確認プロンプト**（バージョン文字列を再入力）
9. `chore(release): vX.Y.Z` でコミット & push
10. `gh pr create` で PR を作成

リリースコミットに含まれるファイル:

- 常に: `.claude-plugin/marketplace.json`、`CHANGELOG.md`、`releases/vX.Y.Z.md`
- `--plugin` で指定したプラグインごとに: `plugins/<name>/.claude-plugin/plugin.json` と `plugins/<name>/.codex-plugin/plugin.json`（Claude 専用プラグインは前者のみ）

指定しなかったプラグインのマニフェストは変更・stage されません。

リリース前に検証される条件（違反するとファイルを変更する前に失敗します。dry-run でも同じ）:

- `--plugin` の値が `<name>:<patch|minor|major|X.Y.Z>` の形式で、`<name>` が `.claude-plugin/marketplace.json` に登録されている
- 同じプラグインを 2 回以上指定していない（どちらを採用するかが曖昧なため、上書きせず失敗する）
- 各プラグインの新しい版が現在の版より大きい
- `--release-bump` と `--release-version` を同時に指定していない
- リリース版が現在の `metadata.version` と CHANGELOG の直前のリリース版より大きい
- リリース版 ≥ max(リリース後の全プラグイン版)
- `CHANGELOG.md` の `[Unreleased]` が空でない
- `releases/vX.Y.Z.md` がまだ存在しない

ブランチ作成後、push が完了する前に失敗・中断（Ctrl-C を含む）した場合は、変更したファイルを元に戻し、`master` に戻って作業ブランチを削除します。push 後の失敗（PR 作成など）では巻き戻しません。

### 4. リリースノートのハイライトを加筆

`releases/vX.Y.Z.md` の `## ハイライト` セクションに、1〜3 行で主要な変更点を手で書き加え、PR にプッシュしてください。

### 5. ローカルで動作確認

```bash
/plugin marketplace add /Users/<you>/workspace/plugins
/plugin install <plugin-name>@9uile-plugins
```

```bash
codex plugin marketplace add /Users/<you>/workspace/plugins
codex plugin add <plugin-name>@9uile-plugins
```

対象 Skill を 1 回実行し、回帰がないか確認します。

### 6. PR レビュー & マージ

PR がレビュー・CI green を経てマージされたら、ローカルで `master` を pull。

```bash
git checkout master
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
| `--plugin <name>:<patch\|minor\|major\|X.Y.Z>` | プラグイン 1 件の版の変更。プラグインごとに 1 回ずつ繰り返し指定する。省略するとプラグイン版を変えないリリースになる |
| `--release-bump <patch\|minor\|major>` | リリース版（`metadata.version`）の bump 種別。`--release-bump` と `--release-version` のどちらも指定しなければ `patch` |
| `--release-version <X.Y.Z>` | リリース版を明示指定（プラグイン版がリリース版を超える時など）。`--release-bump` と排他 |
| `--dry-run` | ファイル書き換えと git/gh 操作をスキップし、差分プレビューだけ表示する（初回は必ずこれ） |
| `--yes` | すべての確認プロンプトをスキップする（CI 等の無人実行向け。**通常は使わない**） |
| `--no-pr` | `release-prepare` で push までで止め、PR は手動で作る |

---

## 整合性ゲート（CI）

CI（`.github/workflows/verify.yml`）は PR ごとにリポジトリ全体の検証 `scripts/verify.sh` を実行します。検証の内容とローカルでの実行方法は [CONTRIBUTING.md](./CONTRIBUTING.md#ローカルで検証する) を参照してください。

リリースに関わる不変条件は `scripts/verify-versions.sh` が検査します。`release-prepare.sh` も編集後の事後条件としてこれを実行します。

- 各プラグインの `.claude-plugin/plugin.json.version`、`.codex-plugin/plugin.json.version`、`marketplace.json.plugins[].version` の一致
- `marketplace.json.metadata.version` が最大プラグイン版以上であること
- filesystem ↔ marketplace の双方向完全性 (Issue #64)
  - `plugins/` 直下の各ディレクトリ（マニフェスト保有）が `.claude-plugin/marketplace.json` に登録されていること
  - `.codex-plugin/plugin.json` を持つプラグインが `.agents/plugins/marketplace.json` にも登録されていること
  - 両 marketplace の `source` パスが実在すること（dangling path 検出）
  - マニフェストを一切持たない `plugins/` 直下のディレクトリ（残骸）がないこと

---

## トラブルシューティング

| 症状 | 原因 / 対処 |
| --- | --- |
| `working tree is not clean` | 未コミットの変更がある。`git status` で確認し、コミットか `git stash` してから再実行 |
| `current branch is '...', expected 'master'` | `git checkout master` で master に戻ってから再実行 |
| `local master is not in sync with origin/master` | `git pull --ff-only` で同期してから再実行 |
| `tag vX.Y.Z already exists` | 同じバージョンの tag が既に存在する。バージョン番号を見直す |
| `release notes already exist: releases/vX.Y.Z.md` | そのリリース版のリリースノートが既にある。リリース版の指定を見直す |
| `[Unreleased] section is empty` | `CHANGELOG.md` の `## [Unreleased]` 直下に変更点を記入してから再実行 |
| `release version X.Y.Z is not greater than previous CHANGELOG release A.B.C` | `CHANGELOG.md` に X.Y.Z 以上のリリースが既にある。リリース版の指定を見直す |
| `plugin <name> version X.Y.Z is greater than release version A.B.C` | リリース後のプラグイン版がリリース版を超える。`--release-version X.Y.Z`（以上）か、より大きい `--release-bump` で再実行 |
| `specify at most one release selector` | `--release-bump` と `--release-version` はどちらか一方だけ指定する |
| `plugin <name> is specified more than once` | 同じプラグインの `--plugin` を 1 つにまとめる |
| `unknown plugin: <name>` | `.claude-plugin/marketplace.json` の `plugins[].name` を指定する |
| `invalid --plugin '...'` | `--plugin <name>:<patch\|minor\|major\|X.Y.Z>` の形式で指定する |
| 途中で abort された | push 前なら自動で巻き戻し済み（`master` に戻り、作業ブランチは削除される）。push 後の場合は手動で `git push origin --delete release/vX.Y.Z` してリトライ |

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
│   ├── version.sh        # Claude/Codex plugin.json / marketplace.json の version 読み書き
│   ├── changelog.sh      # CHANGELOG からのリリース内容の読み取り、セクション繰り上げ + compare リンク
│   └── release-notes.sh  # 渡されたリリース内容から releases/vX.Y.Z.md 雛形生成
├── tests/                # 受け入れテスト（*.test.sh）と共通 fixture（helpers.sh）
├── release-prepare.sh    # ブランチ → 編集 → コミット → PR
├── release-publish.sh    # tag → GH Release
├── verify.sh             # リポジトリ全体の検証（CI + ローカル）
├── verify-plugin-catalog.sh  # README のプラグイン一覧と配布対象の一致
└── verify-versions.sh    # バージョン・配布登録の整合性（verify.sh + リリースの事後条件）
```
