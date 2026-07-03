# Codex 実行経路

外部エージェントとして Codex を使う場合は、必ずトークン計測プロキシ経由で起動する。

## 起動形態

対話:

```bash
headroom wrap codex
```

非対話:

```bash
headroom wrap codex -- exec -C <repo> --full-auto "<プロンプト>"
```

プロンプトには指示書ファイルの絶対パスを渡し、「最初に全文読んでから作業する」ことを明記する。

## 長時間実行

- 長時間の実行はバックグラウンドで走らせ、完了後にログを確認する。
- 並行作業が必要な場合は worktree で分離してから委譲する。
- サンドボックスは `workspace-write` が基本。書き込み先が workspace 外なら失敗するため、指示書で書き込み先を明記する。

## 境界

モデル・effort・価格の判断はここには書かない。インストールされていれば `model-strategy` の `references/07-codex.md` を参照する。
