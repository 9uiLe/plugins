# Architecture Decision Records (ADRs)

このディレクトリは本リポジトリの **Architecture Decision Records (ADR)** を MADR
形式 (HTML) で保管する。各 ADR は `tech-docs` プラグインのデザインシステムで
レンダリングされ、`system/` 配下に共通アセットをまとめて配置する。

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

```
/tech-docs:create-adr で「<決定したいこと>」をまとめて
```

`tech-docs:create-adr` Skill が雛形を展開し、`system/` 配下のアセットを自動配置する。
生成手順の詳細は `plugins/tech-docs/skills/create-adr/SKILL.md` を参照。

## 関連

- デザインシステム: `plugins/tech-docs/shared-assets/`
- vendor 配下の third-party 帰属: `plugins/tech-docs/shared-assets/vendor/LICENSES.md`
- vendor 検証 CI: `.github/workflows/verify-vendor.yml`
