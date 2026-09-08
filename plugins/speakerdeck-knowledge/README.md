# SpeakerDeck Knowledge

SpeakerDeck の公開スライドを、実務で使える判断基準・適用条件・作業手順・検証方法に変換する Claude Code / Codex 用プラグインです。知識を実装へ引き継ぐ AI と、資料を初めて読むチームメンバーを対象にしています。

## 使い方

```text
$speakerdeck-knowledge
次の SpeakerDeck から実務に使える知識を抽出してください。
出力: AI 向け Markdown とチーム共有用 HTML
適用先: 社内ツールのフォーム改善
URL: https://speakerdeck.com/author/deck
```

URL を必須入力とし、出力形式・適用先・保存先は指定できます。形式を省略すると両方を作成します。適用先が未指定の場合は、架空の実践例を明示し、実案件で確認する入力条件を残します。

| 成果物 | 用途と内容 |
| --- | --- |
| `knowledge.md` | 知識の正本。根拠ページ、判断理由、条件、作業、検証、限界、AI への作業指示 |
| `guide.html` | PC 向け共有資料。同じ知識を、原図と読み解き、表、手順、見出しと余白で構成 |

HTML は単体で開ける形式を基本とします。左側に追従する目次と凡例を置き、必要な原図には出典と拡大表示を付けます。関連する情報を余白と整列でまとめ、区切り線は目次に載る本文セクションの境界に限定します。スマートフォン用レイアウトは対象に含みません。

## 知識の扱い

「原資料」「画像観察」「応用提案」の表示によって、講演の説明、画像から確認した事項、実務への独自提案を区別します。主要な知識には適用条件と確認方法を付け、講演者の仮説や提案した改善効果は、観測済みの成果と区別します。

図の配置・形・強弱が根拠となる箇所は、原図と観察箇所の説明を使います。文言の比較には表、作業の順序には番号付き手順など、伝える関係に合った表現を選びます。AI への作業指示には、必要な入力、調査と変更の順序、受入条件、停止・相談条件を記載します。

## 構成と実行環境

以下のパスは `skills/speakerdeck-knowledge/` を起点とします。

| ファイル | 責務 |
| --- | --- |
| `SKILL.md` | 入力、完了条件、取得から納品までの手順 |
| `references/acquisition.md` | ページ取得、画像読解、取得できない場合の扱い |
| `references/knowledge-contract.md` | Markdown と HTML が共有する知識構造 |
| `references/html-guide.md` | PC 向け資料の情報設計、表現、操作、検証 |
| `assets/guide.css` | 共有資料に埋め込むスタイルの土台 |
| `scripts/fetch_deck.py` | メタデータ、ページ別本文、画像の取得補助 |

取得補助は Python 3 標準ライブラリと curl で動作します。知識抽出には本文と画像を理解できる AI エージェント、HTML の表示確認にはブラウザが必要です。取得スクリプトの出力は読解用の中間資料です。

確認したページと精読範囲を成果物に記載します。原文・取得キャッシュは一時ディレクトリで管理し、共有資料には説明に必要な引用画像だけを含めます。抽出の依頼で行う作業は資料の作成までです。対象プロジェクトの実装や外部への公開・送信には、その作業の依頼が必要です。

## サンプルと検証

原 佑一『いいUIとは？初心者向けに事例をもとにUIデザインを分解』を使用したサンプルです。

- [実装・作業に使う Markdown](examples/ui-design/knowledge.md)
- [PC 向け共有 HTML](examples/ui-design/guide.html)
- [検証条件と結果](examples/ui-design/validation.md)

文字起こしのない資料には、こぎそ氏の『デザインハーネス』を使用しています。

- [実務向け Markdown](examples/design-harness/knowledge.md)
- [PC 向け共有 HTML](examples/design-harness/guide.html)
- [画像からの読解と検証結果](examples/design-harness/validation.md)

リポジトリルートから実行します。

```bash
rtk proxy python3 -m unittest discover -s plugins/speakerdeck-knowledge/tests -v
rtk proxy bash scripts/verify-versions.sh
```

ローカル導入の手順は [コントリビューションガイド](../../CONTRIBUTING.md#ローカルで検証する) を参照してください。
