# コントリビューションガイド

このリポジトリでは、Claude Code / Codex 用の `quality-architect`、`model-strategy`、`speakerdeck-knowledge` を配布しています。プラグインの用途と構成は [README](./README.md) を参照してください。

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
| 品質特性の定義・設計やレビューの観点 | `plugins/quality-architect/references/` |
| 品質指標・測定ツール・しきい値 | `plugins/quality-architect/quality-gates.yml` と `scripts/` |
| モデル・委譲の判断資料 | `plugins/model-strategy/references/` |
| 操作の振り分け・警告・委譲先の動作 | `plugins/model-strategy/scripts/`、`hooks/`、`agents/` |
| GitHub の報告・PR フォーム | `.github/ISSUE_TEMPLATE/`、`.github/PULL_REQUEST_TEMPLATE.md` |
| リリース手順 | `RELEASING.md`、`scripts/`、`.github/workflows/verify-versions.yml` |

スキルやプラグインを設計する際は、[コンテキスト効率を考慮した設計指針](./docs/context-efficient-skill-design.md) を参照してください。リリース手順を変更する場合は、手順書・スクリプト・CI の仕様を同じ PR で揃えます。

## プラグインの登録とバージョン

新規プラグインは `plugins/<name>/` に作成し、次を用意します。

- Claude Code 用マニフェスト: `.claude-plugin/plugin.json`
- Codex 用マニフェスト: `.codex-plugin/plugin.json`
- スキル本体: `skills/<skill>/SKILL.md`
- 利用案内: `README.md`

ルートの `.claude-plugin/marketplace.json` と `.agents/plugins/marketplace.json` に配布エントリを追加し、ルート README のプラグイン一覧にも掲載します。

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

CI の検証コマンドはリポジトリのルートで実行できます。必要なツールは Bash、Git、jq、Node.js、ShellCheck です。

```bash
bash scripts/verify-versions.sh
bash scripts/tests/verify-versions-completeness.test.sh
node --test plugins/model-strategy/tests/*.test.mjs
shellcheck -S warning -x scripts/*.sh scripts/lib/*.sh scripts/tests/*.sh
```

マニフェストや配布対象の変更には `verify-versions.sh`、検証スクリプトの変更にはそのテスト、model-strategy の処理変更には Node.js のテストを実行してください。CI の定義は [verify-versions.yml](./.github/workflows/verify-versions.yml) にあります。

## Pull Request を送る

1. Fork または書き込み権限のある作業コピーで、変更用ブランチを作成します。
2. 対象ファイルを変更し、変更内容に対応する検証を実行します。
3. 変更の目的をコミットメッセージに記載します。`fix:`、`feat:`、`docs:` などの接頭辞で種別を示します。
4. ブランチを push し、`master` 向けの Pull Request を作成します。
5. [PR テンプレート](./.github/PULL_REQUEST_TEMPLATE.md) に、成果と検証手順・結果を記載します。関連 Issue があれば `Closes #123` などで紐付けます。

誤字や文書の修正は Issue なしでも提出できます。仕様に影響する変更は、Issue で方針を相談してから進めることを推奨します。マージはリポジトリのブランチ保護ルールに従い、承認レビューを受けて行います。
