# 08. 移植性 / Portability

> ISO/IEC 25010 製品品質モデルの「移植性」に関する、調査・アーキテクチャ設計・コードレビュー用リファレンス。
> 本書は ISO/IEC 25010:2011 の用語体系に従う（2023 年版では "Flexibility" に改称されたが、副特性の実態は同等）。

---

## 1. 定義

**移植性 (Portability)** とは、一つの環境から別の環境へ、製品またはシステムを移し替えられる度合いである。
「環境」にはハードウェア・OS・ランタイム・クラウドプラットフォーム・構成設定・依存ライブラリなどあらゆる実行基盤が含まれる。

> *ISO/IEC 25010:2011, Clause 4.2.8*:
> "Degree of effectiveness and efficiency with which a system, product or component can be transferred from one hardware, software or other operational or usage environment to another."

なお、ISO/IEC 25010:2023 では同特性が **柔軟性 (Flexibility)** に改称され、スケーラビリティが副特性として追加された。本資料は 2011 年版の副特性体系（適応性・設置性・置換性）を基盤とし、2023 年版の文脈も補足する。

---

## 2. 副特性

### 2.1 適応性 (Adaptability)

#### 定義
異なるハードウェア・ソフトウェア・その他の運用環境または使用環境への適応に対して、製品やシステムが有効かつ効率的に適応できる度合い。

#### 調査観点
- 特定 OS・CPU アーキテクチャ・クラウドベンダへの固有依存がないか
- 環境変数・設定ファイルによる動作切り替えが可能か
- ランタイムバージョン（言語処理系・ライブラリ）の範囲は文書化されているか
- 国際化（i18n）・ロケール対応の仕組みが組み込まれているか

#### 設計タクティクス・パターン
- **設定の外部化**（Twelve-Factor App Factor III: Config）: 環境ごとに異なる値は環境変数に格納し、コードに埋め込まない
- **抽象化レイヤ / 依存性逆転原則 (DIP)**: 外部システム（DB・メッセージキュー等）へのアクセスをインタフェースで隠蔽し、実装を差し替え可能にする (Martin, 2017)
- **コンテナ化**: OCI Image Spec 準拠のコンテナイメージにより、ホスト環境差異を吸収する
- **ヘキサゴナルアーキテクチャ (Ports and Adapters)**: ドメインロジックをポートで分離し、駆動側・被駆動側のアダプタを交換可能に保つ (Cockburn, 2005)

#### コードレビューチェックリスト
- [ ] ファイルパス区切り文字が OS 非依存 API 経由で生成されているか
- [ ] 絶対パスや環境固有のディレクトリ（`/home/user/...`）がハードコードされていないか
- [ ] 接続文字列・エンドポイントが環境変数または設定ファイルから取得されているか
- [ ] CPU アーキテクチャ依存のバイナリ・シェル呼び出しが含まれていないか
- [ ] 条件分岐に `os.name`・`sys.platform` 等の OS 判定がある場合、その必要性を検討したか

#### 計測指標
| 指標 | 計算式 | 参照 |
|------|--------|------|
| 環境依存コード密度 | ハードコード設定行数 / 総行数 | ISO/IEC 25023:2016 §8.8 |
| 設定外部化率 | 外部化済み設定項目数 / 全設定項目数 | ISO/IEC 25023:2016 §8.8 |
| クロスプラットフォーム CI 成功率 | N プラットフォームでのビルド成功数 / N | 自組織定義 |

---

### 2.2 設置性 (Installability)

#### 定義
指定された環境において、製品やシステムをインストールまたはアンインストールできる度合い。

#### 調査観点
- インストール手順が自動化・文書化されているか
- 依存関係が宣言的に管理されており、バージョンが固定されているか
- アンインストール時にシステム側に残存物（レジストリ値・設定ファイル・キャッシュ）がないか
- オフライン環境・エアギャップ環境でのインストールに対応しているか

#### 設計タクティクス・パターン
- **宣言的依存関係管理**: `package.json`・`requirements.txt`・`go.mod` 等によるバージョン固定とロックファイルの管理
- **べき等インストールスクリプト**: 何度実行しても同じ結果になるスクリプト設計（Ansible playbook 等）
- **OCI 準拠コンテナ配布**: OCI Image Specification (v1.1) および OCI Runtime Specification に従い、環境を自己完結型イメージに封入する
- **クリーンアンインストール設計**: インストーラが行うすべての変更をログに記録し、逆順で除去できる機構を持つ

#### コードレビューチェックリスト
- [ ] 依存ライブラリのバージョンはピン留め（厳密指定）またはロックファイルで固定されているか
- [ ] インストールスクリプトはべき等か（再実行で副作用が生じないか）
- [ ] `postinstall` / `setup.py` 等の自動実行スクリプトが外部ネットワークに依存していないか
- [ ] コンテナイメージはタグではなくダイジェスト（SHA256）で参照されているか
- [ ] アンインストール後に残存ファイル・プロセス・サービスがないことをテストしているか

#### 計測指標
| 指標 | 計算式 | 参照 |
|------|--------|------|
| インストール成功率 | 成功したインストール試行数 / 全試行数 | ISO/IEC 25023:2016 §8.8 |
| インストール所要時間 | 平均インストール完了時間 (秒) | ISO/IEC 25023:2016 §8.8 |
| クリーンアンインストール率 | 残存物ゼロのアンインストール回数 / 全アンインストール回数 | 自組織定義 |

---

### 2.3 置換性 (Replaceability)

#### 定義
同じ環境において、同じ目的で別の指定ソフトウェア製品に置き換えられる度合い。

#### 調査観点
- 公開インタフェース（API・プロトコル・データ形式）が標準仕様に準拠しているか
- 競合製品・後継バージョンとのデータ互換性はあるか
- 移行ガイドまたはマイグレーションツールが提供されているか
- POSIX 準拠の API（IEEE Std 1003.1）を使用することで OS 間の置換を容易にしているか

#### 設計タクティクス・パターン
- **標準プロトコル準拠**: HTTP/REST・gRPC・POSIX ファイルシステム API 等の標準を採用し、ベンダ固有拡張に依存しない
- **抽象化インタフェース / ヘキサゴナルアーキテクチャ**: ポートを介した依存により、具体的実装を任意のアダプタへ置き換え可能にする
- **セマンティックバージョニング (SemVer)**: 互換性を保証する破壊的変更の識別を明示化し、置換可否判断の根拠を提供する
- **Strangler Fig パターン**: 既存実装を段階的に新実装へ移行し、リスクを最小化する

#### コードレビューチェックリスト
- [ ] 外部公開インタフェースは標準仕様（OpenAPI・Protobuf 等）で定義されているか
- [ ] ベンダ固有 SDK・プロプライエタリ API の直接呼び出しは抽象レイヤで包まれているか
- [ ] データシリアライズ形式は相互運用可能な標準（JSON・Protocol Buffers・Avro 等）か
- [ ] バージョンアップ時のマイグレーションスクリプト・ガイドが整備されているか
- [ ] 置換対象との機能差分が文書化・テストで確認されているか

#### 計測指標
| 指標 | 計算式 | 参照 |
|------|--------|------|
| 標準 API 準拠率 | 標準準拠インタフェース数 / 全外部インタフェース数 | ISO/IEC 25023:2016 §8.8 |
| 機能移行カバレッジ | 移行済み機能数 / 移行対象機能総数 | 自組織定義 |
| ベンダ固有依存数 | プロプライエタリ API 呼び出し箇所数 | 自組織定義 |

---

## 3. 横断的な設計戦略

### 3.1 環境抽象化レイヤの体系化
移植性を横断的に確保するには、依存するすべての外部要素（インフラ・設定・外部サービス）をアプリケーションロジックから分離する必要がある。ヘキサゴナルアーキテクチャ（Cockburn, 2005）はその代表的なフレームワークであり、ドメイン中心の設計において各ポートを実装から独立させる。

### 3.2 Twelve-Factor App による設定管理
Twelve-Factor App（Wiggins, 2012）は Factor III でコードと設定の厳格な分離を定め、Factor II では依存関係の明示的な宣言とアイソレーションを要求する。これらは適応性・設置性の基盤となる原則である。

### 3.3 コンテナ標準による実行環境の固定
OCI Image Specification と OCI Runtime Specification（opencontainers, 2024）は、コンテナイメージのビルド・配布・実行に関わる業界標準を定義する。これに準拠することで、開発・ステージング・本番の環境差異を根本的に排除できる。

### 3.4 POSIX 準拠による OS 間移植性
システムプログラミングレベルでは、IEEE Std 1003.1（POSIX.1-2024）への準拠が OS 間移植性の基礎となる。ファイル・プロセス・ソケット操作において POSIX API に限定することで、Linux・macOS 間の移植コストを最小化できる。

### 3.5 CNCF エコシステムの活用
CNCF（Cloud Native Computing Foundation）は Kubernetes・Envoy・Prometheus 等のベンダ中立プロジェクトを通じて、クラウド間の移植性とベンダロックインの回避を制度的に支援する。

---

## 4. レビュー時の重点チェックリスト（要約）

| カテゴリ | チェック項目 | 副特性 |
|----------|-------------|--------|
| 設定 | 環境依存値がすべてコード外に分離されているか | 適応性 |
| 依存 | すべての外部依存がバージョン固定・宣言済みか | 設置性 |
| インタフェース | 外部公開 API が標準仕様で定義されているか | 置換性 |
| 抽象化 | プロプライエタリ API が抽象レイヤで包まれているか | 適応性・置換性 |
| コンテナ | OCI 準拠イメージかつダイジェスト参照か | 設置性 |
| OS 依存 | OS 判定ロジック・絶対パスのハードコードがないか | 適応性 |
| マイグレーション | 版間・製品間の移行手順が整備されているか | 置換性 |
| テスト | 複数プラットフォームでの CI が設定されているか | 適応性・設置性 |

---

## 5. アンチパターン

| アンチパターン | 説明 | 影響副特性 |
|---------------|------|------------|
| **ハードコード設定** | DB 接続文字列・エンドポイント URL をソースコードに埋め込む | 適応性 |
| **プラットフォーム固有パス** | `C:\Users\...` や `/home/user/...` の絶対パスをコードに記述 | 適応性 |
| **フローティングタグ依存** | コンテナイメージを `:latest` タグで参照し、再現性を失う | 設置性 |
| **ベンダロックイン API の直接使用** | AWS S3 SDK を抽象化なしにビジネスロジック層で直接呼び出す | 置換性 |
| **暗黙的な環境前提** | 特定のディレクトリ構造・ユーザ権限・事前インストール済みツールを前提にしている | 設置性・適応性 |
| **OS 固有コマンド依存** | `bash`・`cmd.exe` 等のシェルコマンドをアプリ内から直接呼び出す | 適応性 |
| **モノリシック設定ファイル** | 環境をまたぐ設定を単一ファイルに混在させ、差し替えを困難にする | 適応性 |

---

## 6. リファレンス

1. **ISO/IEC 25010:2011** — *Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models*. ISO/IEC, 2011.
   https://www.iso.org/standard/35733.html

2. **ISO/IEC 25010:2023** — *Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model*. ISO/IEC, 2023.
   https://www.iso.org/standard/78176.html

3. **ISO/IEC 25023:2016** — *Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Measurement of system and software product quality*. ISO/IEC, 2016.
   https://www.iso.org/standard/35747.html

4. **IEEE Std 1003.1-2024 (POSIX.1-2024)** — *IEEE/Open Group Standard for Information Technology — Portable Operating System Interface (POSIX) Base Specifications, Issue 8*. IEEE/The Open Group, 2024.
   https://ieeexplore.ieee.org/document/10555529

5. **Open Container Initiative — OCI Image Format Specification v1.1**. opencontainers, 2024.
   https://specs.opencontainers.org/image-spec/

6. **Open Container Initiative — OCI Runtime Specification**. opencontainers.
   https://github.com/opencontainers/runtime-spec

7. **Wiggins, A.** — *The Twelve-Factor App*. Heroku, 2012.
   https://12factor.net/

8. **CNCF — Cloud Native Definition v1.1**. Cloud Native Computing Foundation, 2018 (rev. 2022).
   https://github.com/cncf/toc/blob/main/DEFINITION.md

9. **CNCF Cloud Native Glossary — Portability**. Cloud Native Computing Foundation.
   https://glossary.cncf.io/portability/

10. **Cockburn, A.** — *Hexagonal Architecture (Ports and Adapters)*. alistair.cockburn.us, 2005 (rev. 2023).
    https://alistair.cockburn.us/hexagonal-architecture

11. **Martin, R. C.** — *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall, 2017. (Dependency Inversion Principle, Chapter 11)
