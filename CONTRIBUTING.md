# コントリビューションガイド

`9uiLe/plugins` をご利用いただきありがとうございます。
このリポジトリは [Claude Code](https://claude.com/claude-code) / Codex 用プラグインの Marketplace です。
不具合の報告・改善提案・Pull Request はいつでも歓迎します。

- [不具合 / 改善を報告する（Issue の起票）](#不具合--改善を報告するissue-の起票)
- [報告前のチェックリスト](#報告前のチェックリスト)
- [良い報告の書き方](#良い報告の書き方)
- [Pull Request を送る](#pull-request-を送る)
- [リポジトリ構成と修正のヒント](#リポジトリ構成と修正のヒント)
- [セキュリティ上の問題の報告](#セキュリティ上の問題の報告)

---

## 不具合 / 改善を報告する（Issue の起票）

1. リポジトリの **Issues** タブを開き、**「New issue」** をクリックします。
2. 目的に合ったテンプレートを選びます。
   - **🐞 バグ報告 / Bug report** … プラグインが期待どおり動かない場合。
   - **✨ 改善・機能要望 / Feature request** … 新機能の提案や既存機能の改善。
   - 使い方の質問は Issue ではなく **Discussions**（または README）をご利用ください。
3. フォームの各項目を埋めて送信します。**項目を空のままにせず**、分かる範囲で具体的に記入してください。

> テンプレートの実体は [`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/) にあります。

## 報告前のチェックリスト

- [ ] [既存の Issue](https://github.com/9uiLe/plugins/issues?q=is%3Aissue) を検索し、重複がないか確認した。
- [ ] プラグイン / Claude Code / Codex を最新版に更新しても再現するか確認した。
- [ ] 機微な情報（APIキー・社内コード・個人情報など）がログやスクリーンショットに含まれていないか確認した。

## 良い報告の書き方

修正担当者が**追加の質問なしに着手できる**よう、以下を意識してください。
これらはバグ報告フォームの項目に対応しています。

| 項目 | ポイント |
| --- | --- |
| 対象プラグイン / Skill | `quality-architect` / `model-strategy` / `second-opinion` などどのプラグインか、`quality-review` などどの Skill かを明記する。 |
| 再現手順 | 「どのコマンドを実行し、Claude Code / Codex に何を指示したか」を番号付きで。第三者が同じ操作をたどれること。 |
| 期待 / 実際の挙動 | 「こうなるはず」と「実際はこうなった」を分けて書く。 |
| 環境情報 | Claude Code のバージョン（`/status` または `claude --version`）または Codex のバージョン、OS、実行環境、インストール方法。 |
| ログ・成果物 | エラーメッセージや、生成された HTML / レビュー結果の該当箇所を貼る。スクリーンショットも有効。 |

機能要望の場合は、**「解決したい課題」と「提案する解決策」を分けて**書くと、議論や設計判断がしやすくなります。

## Pull Request を送る

軽微な修正（誤字・ドキュメント）は Issue なしの PR でも構いませんが、
仕様に影響する変更は先に Issue で方針を相談することを推奨します。

1. リポジトリを Fork し、作業ブランチを作成します（例: `fix/chart-rendering`、`feat/custom-adr-template`）。
2. 変更を加え、[動作確認](#リポジトリ構成と修正のヒント)を行います。
3. PR を作成すると [Pull Request テンプレート](./.github/PULL_REQUEST_TEMPLATE.md) が表示されるので、各項目を埋めます。
4. 関連 Issue を `Closes #123` のように紐付けます。

コミットメッセージは `fix:` / `feat:` / `docs:` などの prefix を付けると変更種別が伝わりやすくなります。

## リポジトリ構成と修正のヒント

```
.
├── .claude-plugin/
│   └── marketplace.json        ← Claude Code Marketplace マニフェスト
├── .agents/
│   └── plugins/
│       └── marketplace.json    ← Codex Marketplace マニフェスト
├── plugins/
│   └── quality-architect/
│       ├── .claude-plugin/plugin.json
│       ├── .codex-plugin/plugin.json
│       ├── skills/<skill>/SKILL.md   ← 各 Skill の本体（プロンプト/手順）
│       ├── references/               ← ISO/IEC 25010 各特性のリファレンス
│       ├── scripts/                  ← 品質ゲート用スクリプト
│       └── README.md
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

修正時に押さえておくと良いポイント:

- **Skill の挙動を変える** → 対象プラグインの `skills/<skill>/SKILL.md` を編集します。Skill の説明や手順はここに記述されています。
- **品質モデルの基準（quality-architect）** → `plugins/quality-architect/references/` の各 Markdown を編集します。
- **新しいプラグインを追加する** → `plugins/<name>/` を作成し、Claude Code 用の `.claude-plugin/plugin.json`、Codex 用の `.codex-plugin/plugin.json`、ルートの `.claude-plugin/marketplace.json` / `.agents/plugins/marketplace.json` にエントリを追加します。`README.md` の収録プラグイン表も更新してください。
- **バージョンを上げる** → 該当 `.claude-plugin/plugin.json`、`.codex-plugin/plugin.json`、Claude Code 側 `marketplace.json` の `version` を揃えて更新します。**リリース作業全体の手順は [`RELEASING.md`](./RELEASING.md) を参照** してください（`scripts/release-prepare.sh` で自動化されています）。
- **リリース手順を変える** → `RELEASING.md` / `scripts/**` / `.github/workflows/verify-versions.yml` は同一 PR で更新します（仕様ドリフト防止）。

### ローカルでの動作確認

リポジトリをローカルパスとして Marketplace に登録し、実際に Skill を実行して確認できます。

```
/plugin marketplace add /path/to/this/repo
/plugin install <plugin-name>@9uile-plugins
```

```bash
codex plugin marketplace add /path/to/this/repo
codex plugin add <plugin-name>@9uile-plugins
```

JSON（`plugin.json` / `marketplace.json`）を編集した場合は、構文エラーがないことと `scripts/verify-versions.sh` が通ることを確認してください。

## セキュリティ上の問題の報告

脆弱性や機微な情報を含む不具合は、**公開 Issue を作成せず**、[SECURITY.md](./SECURITY.md) に記載の手順（GitHub Private Vulnerability Reporting）でご連絡ください。
公開リポジトリに詳細を投稿すると、修正前に悪用されるおそれがあります。

---

ご協力ありがとうございます！🎉
