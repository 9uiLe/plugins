# ios-build-optimization

大規模 iOS アプリ(Swift / SwiftPM / Xcode)のビルド時間とモジュール構成を、計測データと依存グラフに基づいて評価・改善する Skill を提供するプラグインです。

## 提供する Skill

### `ios-build-optimization`

- Build Timeline / ビルドログからボトルネックを分類(SwiftCompile / EmitSwiftModule / Link / Run Script / Resource ...)
- Target / Package / linkage(Static / Dynamic / Mergeable / Binary)の判断を、依存グラフの構造指標(critical path、fan-in × 変更頻度)と変更履歴で評価
- すべての提案に根拠ラベル(`FACT` / `MEASURED` / `INFERENCE` / `HYPOTHESIS` / `RISK` / `EXPERIMENT`)を付与
- 計測データがない claim では断定せず、シナリオ B01〜B14 に基づく計測計画へフォールバック

トリガー例: 「ビルドが遅い」「ビルド時間を改善して」「モジュール分割を評価して」「マルチモジュール設計をレビューして」「Build Timeline を見て」

非対象: アプリ実行中の CPU/GPU 最適化、Bazel / Tuist 移行判断、ビルド目的を持たない一般アーキテクチャレビュー(→ `quality-architect`)。

## 構成

```
ios-build-optimization/
├── .claude-plugin/plugin.json
├── .codex-plugin/plugin.json
├── skills/ios-build-optimization/SKILL.md   # 手順 + ガードレール(断定ゲート・根拠ラベル)
└── references/                              # 知識(必要時ロード)
    ├── facts.md                    # 一次資料 12 事実(F1〜F12、出典・引用付き)
    ├── terms-and-model.md          # 用語境界とビルド時間分解モデル
    ├── design-tradeoffs.md         # 分割/統合基準、API/Impl、Package 戦略
    ├── linkage.md                  # Static/Dynamic/Mergeable/Binary
    ├── antipatterns.md             # Common 問題とアンチパターン集
    ├── diagnostics.md              # Build Timeline 診断分岐
    ├── measurement.md              # 計測シナリオ B01〜B14 と統計規律
    ├── roadmap-and-checklists.md   # Phase 0〜6 とレビューチェックリスト
    └── templates.md                # 入出力仕様と提案テンプレート
```

## 設計方針

> Optimize the dependency graph, not the module count.

モジュール数ではなく、変更頻度・依存方向・クリティカルパス・固定費を含む依存グラフ全体を最適化します。効果量(秒数・%)は対象プロジェクトで計測されるまで断定しません。

参照知識の調査日は 2026-07-22 です。一次資料(WWDC セッション、SwiftPM / Swift 公式ドキュメント 9 件)の URL はすべて到達確認済みですが、Xcode リリースにより挙動が変わる項目は利用環境での再確認を Skill が指示します。

## インストール

```
/plugin install ios-build-optimization@9uile-plugins
```

```bash
codex plugin add ios-build-optimization@9uile-plugins
```

## リリース前検証(未了・引き継ぎ事項)

- [ ] Claude Code / Codex 両ランタイムでのローカルインストール実験(CONTRIBUTING 記載手順)
- [ ] フィクスチャ 3 種(計測なし / 計測あり / greenfield 設計)での forward test: フィクスチャ入力とアサーションは [`tests/fixtures/`](./tests/) に整備済み。実行(手動またはエージェント)が未了
