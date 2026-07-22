# Architecture Decision Records (ADRs)

このディレクトリは本リポジトリの **Architecture Decision Records (ADR)** を MADR
形式 (HTML) で保管する。共通アセット (デザインシステム) は `system/` 配下に
vendored 済みで、既存 ADR のレンダリングはこのディレクトリだけで自己完結する。

## 一覧

| 番号 | 状態 | タイトル | 日付 |
|---|---|---|---|
| [0001](./0001-release-automation.html) | Accepted | リリース自動化 (scripts + CI verify) | 2026-06-04 |
| [0002](./0002-vendor-prism-mermaid.html) | Accepted | 生成 HTML の Prism / Mermaid を CDN から vendor 同梱へ移行 | 2026-06-05 |

## 番号付与ルール

- **採番は 4 桁ゼロ埋め** (`0001`, `0002`, …)。
- **欠番は許容**する: 別ブランチで採番した ADR が後から master に入る前提があるため。
  欠番が発生したら本 README の表に「(欠番)」行を追加し、由来を 1 行で残す。
- **renumber しない**: いったん commit した ADR の番号は変えない (リンク切れ防止)。
  Superseded の場合は新規 ADR を起こし、旧 ADR の Status を `Superseded` に更新する。

## 新規 ADR の作成

> **Note:** 生成に使っていた `tech-docs` プラグイン (`create-adr` Skill) は
> 2026-07 の棚卸しで削除された (未使用のため)。新規 ADR は既存 ADR
> (`0001-*.html` / `0002-*.html`) をテンプレートとしてコピーし、本文を
> 書き換えて作成する。`system/` 配下の共通アセットはそのまま参照できる。
> 過去の生成手順が必要な場合は git 履歴 (`plugins/tech-docs/`) を参照。

## 関連

- デザインシステム (vendored): `docs/adr/system/`
- vendor 配下の third-party 帰属: `docs/adr/system/vendor/LICENSES.md`
