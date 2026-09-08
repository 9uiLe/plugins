# SpeakerDeck Knowledge

SpeakerDeck の公開スライドから、実務で使う判断基準・適用条件・作業手順・検証方法を抽出する Claude Code / Codex 用プラグインです。AI への実装依頼に使う Markdown と、初めて資料を読むチームメンバー向けの HTML を作成します。

## 依頼する

```text
$speakerdeck-knowledge
URL: https://speakerdeck.com/kgsi/pdeconf2026-design-harness
出力: Markdown と HTML
適用先: 既存プロダクトの画面レビュー
```

URL は必須です。形式の指定がなければ Markdown と HTML の両方を作成します。適用先が未指定なら架空の実践例を使い、実案件で確認すべき前提を明示します。

保存先を指定する場合は `保存先: docs/design-harness` のように依頼へ記載します。指定先に追加の階層は付けません。相対パスはスキル実行開始時の作業ディレクトリを基準にします。

## 成果物の保存先と内容

保存先が未指定の場合は、作業ディレクトリの `ai-knowledge/` 配下に、スライドごとのディレクトリを作成します。ディレクトリ名は URL の最後のパス要素で、クエリとフラグメントを除きます。

```text
作業ディレクトリ/
└── ai-knowledge/
    ├── pdeconf2026-design-harness/
    │   ├── knowledge.md
    │   └── guide.html
    └── another-deck/
        ├── knowledge.md
        └── guide.html
```

| ファイル | 内容 |
| --- | --- |
| `knowledge.md` | 知識の正本。根拠、判断理由、適用条件、作業、具体例、検証、限界、AI 作業指示 |
| `guide.html` | 同じ知識を PC で読む共有資料。原図と読み解き、比較表、手順、目次、凡例 |

形式を指定した場合は指定形式だけを作成します。必要な検証記録や配布用画像も、その資料のディレクトリへまとめます。同じ資料の再生成では同じ場所を使い、別資料と名前が重なる場合は著者の URL 識別子を付けて区別します。

取得した HTML・本文・スライド画像一式は一時ディレクトリに保存します。プラグインの配置先や `examples/` は通常利用時の保存先には使いません。

## 資料の設計

「原資料」「画像観察」「応用提案」の表示で、講演の説明、図から確認した事項、独自の適用方法を区別します。各知識に出典ページと行動・確認方法を付け、AI 作業指示には入力、作業順、受入条件、停止・相談条件を記載します。

HTML は PC 向けの単体ファイルを基本とします。左側の追従サイドバーに目次と凡例を置き、関連する情報を余白・見出し・整列でまとめます。Divider は目次に載る本文セクション間だけに使用します。原図の配置・形・強弱が根拠になる箇所は画像と説明を使い、必要な図には拡大表示を付けます。

文字起こしのないスライドは画像から読解します。取得した範囲と実際に読んだ範囲を成果物に記録し、仮説や提案の効果は観測済みの成果と区別します。資料の作成には、対象プロジェクトの実装や外部への公開・送信は含みません。

## 構成と実行環境

本文と画像を理解できる AI エージェント、公開 URL の閲覧手段、表示確認用のブラウザが必要です。取得補助は Python 3 標準ライブラリと curl を使います。

以下のパスは `skills/speakerdeck-knowledge/` 内にあります。

| ファイル | 責務 |
| --- | --- |
| `SKILL.md` | 入出力、保存先、ワークフロー、完了条件 |
| `references/acquisition.md` | 中間資料の取得と画像読解 |
| `references/knowledge-contract.md` | 両形式で共有する知識の構造 |
| `references/html-guide.md` | PC 向け資料の構成、表現、操作、検証 |
| `assets/guide.css` | HTML に埋め込むスタイルの土台 |
| `scripts/fetch_deck.py` | ページ別本文・画像・書誌情報の取得と保存 |

取得スクリプトの `--out` は中間資料の保存先です。最終成果物の保存先決定と執筆は、スキルを実行する AI が担当します。

## サンプルと検証

`examples/` は、通常利用時の `ai-knowledge/` と同じく資料ごとに成果物をまとめたサンプル置き場です。サンプル名は説明用に付けています。

| 資料 | 取得形式 | 成果物と検証範囲 |
| --- | --- | --- |
| 原 佑一『いいUIとは？』 | 本文と画像・30ページ | [Markdown](examples/ui-design/knowledge.md) / [HTML](examples/ui-design/guide.html) / [検証結果](examples/ui-design/validation.md) |
| こぎそ『デザインハーネス』 | 画像のみ・33ページ | [Markdown](examples/design-harness/knowledge.md) / [HTML](examples/design-harness/guide.html) / [検証結果](examples/design-harness/validation.md) |

リポジトリルートから取得処理と配布登録を検証します。

```bash
rtk proxy python3 -m unittest discover -s plugins/speakerdeck-knowledge/tests -v
rtk proxy bash scripts/verify-versions.sh
```

サンプルの `validation.md` は読解範囲と表示・操作の確認結果です。通常利用時の必須出力ではありません。独立した読者の理解度や実案件での改善効果は、別途評価する必要があります。ローカル導入は [コントリビューションガイド](../../CONTRIBUTING.md#ローカルで検証する) を参照してください。
