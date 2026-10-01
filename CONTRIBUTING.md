# コントリビューションガイド

このリポジトリでは、Claude Code / Codex 用のプラグインを配布しています。配布中のプラグインと用途・構成は [README](./README.md) を参照してください。

## 不具合・改善提案・質問

[GitHub Issues](https://github.com/9uiLe/plugins/issues) で既存の報告を検索し、該当する報告がなければ「New issue」からバグ報告または機能要望のテンプレートを選びます。使い方の相談は [Discussions](https://github.com/9uiLe/plugins/discussions) で受け付けています。

バグ報告には、次の情報を記載してください。ログや成果物に API キー、個人情報、非公開コードが含まれていないことも確認してください。

| 情報 | 記載内容 |
| --- | --- |
| 対象 | プラグイン名、スキル名、プラグインのバージョン |
| 環境 | Claude Code / Codex の種別とバージョン、OS、CLI・エディタ拡張などの実行環境 |
| 導入方法 | Marketplace の登録先、インストールに使ったコマンド |
| 再現手順 | 対象ファイルや設定、実行したコマンド、エージェントに渡した依頼 |
| 期待と結果 | 期待する出力、実際の出力、エラーや成果物の該当箇所 |
| 再現状況 | 最新版で確認したか、毎回起きるか、発生条件が分かっているか |

機能要望には、利用場面、解決したい課題、期待する挙動を記載してください。具体的な実装案や代替案があれば添えてください。

脆弱性や機微な情報を含む報告は、[SECURITY.md](./SECURITY.md) の非公開窓口を利用してください。

## 変更対象を選ぶ

スキルは依頼に応じて読み込まれる手順書、リファレンスは手順の実行中に必要な資料です。各ファイルの配置は [リポジトリ構成](./README.md#リポジトリ構成) を参照してください。

| 変更内容 | 対象 |
| --- | --- |
| スキルの起動条件・手順・出力 | `plugins/<name>/skills/<skill>/SKILL.md` |
| モデル・委譲の判断資料 | `plugins/model-strategy/references/` |
| 操作の振り分け・警告・委譲先の動作 | `plugins/model-strategy/scripts/`、`hooks/`、`agents/` |
| GitHub の報告・PR フォーム | `.github/ISSUE_TEMPLATE/`、`.github/PULL_REQUEST_TEMPLATE.md` |
| リポジトリの検証・CI | `scripts/verify.sh`、`scripts/tests/`、`.github/workflows/verify.yml` |
| リリース手順 | `RELEASING.md`、`scripts/release-*.sh`、`scripts/lib/` |

スキルやプラグインを設計する際は、[コンテキスト効率を考慮した設計指針](./docs/context-efficient-skill-design.md) を参照してください。リリース手順を変更する場合は、手順書・スクリプト・CI の仕様を同じ PR で揃えます。

## プラグインの登録とバージョン

新規プラグインは `plugins/<name>/` に作成し、次を用意します。

- Claude Code 用マニフェスト: `.claude-plugin/plugin.json`
- Codex 用マニフェスト: `.codex-plugin/plugin.json`
- スキル本体: `skills/<skill>/SKILL.md`
- 利用案内: `README.md`

ルートの `.claude-plugin/marketplace.json` と `.agents/plugins/marketplace.json` に配布エントリを追加し、ルート README の [プラグイン一覧](./README.md#プラグインを選ぶ) に `plugins/<name>/README.md` へのリンクを持つ行を追加します。配布対象の正本は `.claude-plugin/marketplace.json` で、Codex 側の登録と README の一覧がこれと一致することを `scripts/verify.sh` が検査します。プラグインを削除する場合も同じ 3 箇所から取り除きます。

個別プラグインのバージョンは、両環境の `plugin.json` と Claude Code 用 Marketplace の該当エントリで揃えます。リポジトリ全体のリリース版とは別に管理します。更新・公開の手順は [RELEASING.md](./RELEASING.md) に記載しています。

## ローカルで検証する

スキルや導入設定の変更は、リポジトリをローカルパスで登録して確認できます。`/path/to/this/repo` は作業コピーの絶対パス、`<plugin-name>` は対象プラグイン名に置き換えてください。

Claude Code の会話内:

```text
/plugin marketplace add /path/to/this/repo
/plugin install <plugin-name>@9uile-plugins
```

Codex 用のターミナルコマンド:

```bash
codex plugin marketplace add /path/to/this/repo
codex plugin add <plugin-name>@9uile-plugins
```

対象のスキルに再現手順や利用例を渡し、期待する出力を確認します。文書だけの変更は、説明と実装の一致、リンク先、コマンド例を確認します。

CI と同じ検証は、リポジトリのルートで次の 1 コマンドで実行します。CI の [verify.yml](./.github/workflows/verify.yml) もこのスクリプトを実行します。

```bash
bash scripts/verify.sh
```

必要なツールは Bash、Git、jq、ShellCheck、Node.js、Python 3 と Pillow（`python3 -m pip install Pillow`）です。スクリプトはツールをインストールしません。

`scripts/verify.sh` は ShellCheck、マニフェストとバージョンの整合性、README のプラグイン一覧と配布対象の一致を検査し、次の規約で置いたテストを自動で実行します。テストを追加・削除しても、スクリプトや CI を変更する必要はありません。

| テストの置き場所 | 実行方法 |
| --- | --- |
| `scripts/tests/*.test.sh` | `bash scripts/tests/<name>.test.sh` |
| `plugins/<name>/tests/*.test.mjs` | `node --test plugins/<name>/tests/*.test.mjs` |
| `plugins/<name>/tests/test_*.py` | `python3 -m unittest discover -s plugins/<name>/tests -v` |

特定の領域だけを確認する場合は、上の表のコマンドで個別に実行できます。プラグイン固有の手動確認や評価手順は、各プラグインの README を参照してください。

## Pull Request を送る

1. Fork または書き込み権限のある作業コピーで、変更用ブランチを作成します。
2. 対象ファイルを変更し、変更内容に対応する検証を実行します。
3. 変更の目的をコミットメッセージに記載します。`fix:`、`feat:`、`docs:` などの接頭辞で種別を示します。
4. ブランチを push し、`master` 向けの Pull Request を作成します。
5. [PR テンプレート](./.github/PULL_REQUEST_TEMPLATE.md) に、成果と検証手順・結果を記載します。関連 Issue があれば `Closes #123` などで紐付けます。

誤字や文書の修正は Issue なしでも提出できます。仕様に影響する変更は、Issue で方針を相談してから進めることを推奨します。マージはリポジトリのブランチ保護ルールに従い、承認レビューを受けて行います。
