# 03. 互換性 / Compatibility

> ISO/IEC 25010:2023 製品品質モデルの「互換性」に関する、調査・アーキテクチャ設計・コードレビュー用リファレンス。

---

## 1. 定義

**互換性 (Compatibility)** とは、製品・システム・コンポーネントが共有環境において他の製品・システム・コンポーネントと情報をやり取りしつつ、自身に要求される機能を果たせる能力の高さを指す（ISO/IEC 25010:2023）。

> **2011 版との違い:** 互換性の副特性は **共存性** と **相互運用性** の 2 つのまま変わらず、2023 でも副特性構成は不変。定義文の表現が整理されている。

互換性は次の 2 つの副特性から構成される。

| 副特性 | 英名 | 一言定義 |
|--------|------|----------|
| 共存性 | Co-existence | 共有環境でリソースを競合させずに要求機能を効率良く実行できる程度 |
| 相互運用性 | Interoperability | 2 つ以上のシステム間で情報を交換し、その情報を利用できる程度 |

---

## 2. 副特性

### 2.1 共存性 (Co-existence)

#### 定義

共通の環境やリソースを他の製品と共有しながらも、それらの製品に悪影響を及ぼすことなく、要求される機能を効率よく果たせる能力の高さ（ISO/IEC 25010:2023）。

#### 調査観点

- 同一ホスト・コンテナ上に複数サービスが同居したとき、CPU・メモリ・ポート・ファイルハンドルなどのリソースを過剰に占有していないか。
- 名前空間（環境変数名、設定ファイルパス、グローバルシングルトン等）の衝突が起きていないか。
- プロセス終了時のリソース解放（ポート、一時ファイル、共有メモリ）は保証されているか。

#### 設計タクティクス・パターン

| タクティクス | 概要 |
|---|---|
| **Linux Namespace / cgroup** | PID・net・mnt・user の各名前空間と cgroup によりプロセスツリーとリソース上限を隔離する。コンテナランタイム (Docker/OCI) はこれを基盤とする。 |
| **プロセス間のリソースクォータ** | cgroup v2 の `cpu.max`・`memory.max` でサービス単位の上限を宣言し、隣接サービスへのノイジー・ネイバー影響を防ぐ。 |
| **設定スコープ分離** | 環境変数・設定ファイルをサービス固有プレフィックスで名前空間化し、衝突を予防する（例: `MYAPP_PORT` vs グローバル `PORT`）。 |
| **依存ライブラリ隔離** | Python virtualenv / Node.js node_modules のプロジェクト局所化により、グローバルパッケージバージョン衝突を回避する。 |

#### コードレビューチェックリスト

- [ ] ハードコードされたポート番号・ファイルパスが他サービスと衝突しない。
- [ ] グローバルシングルトン（クラス変数・モジュールレベル変数）がプロセス間で意図せず共有されていない。
- [ ] テスト実行時に一時ディレクトリ・ポートが動的割り当てされている。
- [ ] シャットダウンフック（`SIGTERM` ハンドラ等）でリソースが確実に解放される。

#### 計測指標（ISO/IEC 25023:2016 準拠）

| 指標 | 定義 |
|---|---|
| **リソース利用率逸脱率** | `(実測リソース消費 − 割当上限) / 割当上限` が 0 以下を維持できている時間割合。 |
| **名前空間衝突件数** | 統合テスト/デプロイ時に検出された名前衝突の件数（目標: 0）。 |
| **リソース漏洩インシデント率** | 一定期間内に発生したリソース漏洩（ポート、FD、メモリ）の件数 / デプロイ件数。 |

---

### 2.2 相互運用性 (Interoperability)

#### 定義

複数のシステム・製品・コンポーネント間でデータを送受信し、送受信した情報を双方が実際に活用できる能力の高さ（ISO/IEC 25010:2023）。

#### 調査観点

- API のリクエスト/レスポンス形式は標準仕様（HTTP, JSON, OpenAPI 等）に準拠しているか。
- スキーマ変更時に後方互換性・前方互換性が維持されているか（フィールド追加・削除のルール）。
- コンシューマとプロバイダ間の契約（API コントラクト）が明示的に定義・検証されているか。
- コンテンツネゴシエーション（`Accept` / `Content-Type`）が正しく実装されているか。

#### 設計タクティクス・パターン

| タクティクス | 概要 |
|---|---|
| **OpenAPI Specification (OAS)** | REST API の機械可読な契約を OpenAPI 3.x で記述し、コード生成・バリデーション・ドキュメント生成の基盤とする。 |
| **Consumer-Driven Contracts (CDC)** | コンシューマ側が期待するインタラクションをコントラクトとして記録し、プロバイダがそれを CI で検証する（Pact フレームワーク等）。Ian Robinson が提唱したパターン（MartinFowler.com 掲載）。 |
| **Protocol Buffers スキーマ進化ルール** | フィールド番号を変更しない・フィールドを削除せず `reserved` にする・デフォルト値を前提としないことで前後方互換性を確保する（`proto3` 公式ガイド）。 |
| **Apache Avro スキーマ解決** | リーダースキーマとライタースキーマが異なる場合のフィールドマッチング規則（Schema Resolution）を Avro 仕様が定義しており、段階的なスキーマ移行を可能にする。 |
| **コンテンツネゴシエーション** | HTTP の `Accept` / `Content-Type` ヘッダによるメディアタイプ交渉（RFC 9110 §12）を実装し、複数のクライアントが異なるフォーマットを要求できるようにする。 |
| **ハイパーメディアリンク (HATEOAS)** | レスポンスに次のアクションへのリンクを含めることで、クライアントがサーバ構造の変化に追従しやすくする（Architecture of the World Wide Web §3 参照）。 |

#### コードレビューチェックリスト

- [ ] API レスポンスの `Content-Type` ヘッダが実際に返すメディアタイプと一致している。
- [ ] JSON フィールドの追加は非 breaking（既存コンシューマが不明フィールドを無視できる）になっている。
- [ ] フィールドの削除・リネームをする場合は廃止予告 (`deprecated`) フェーズが設けられている。
- [ ] Protobuf: フィールド番号の再利用がなく、削除済みフィールドは `reserved` 宣言されている。
- [ ] Avro: デフォルト値が指定されており、スキーマ変更後も古い読み込みコードで動作検証済みである。
- [ ] OpenAPI ファイルがコードと同期されており、CI でスキーマドリフトを検出している。
- [ ] CDC テスト（Pact 等）が CI パイプラインに組み込まれており、コントラクト違反でビルドが失敗する。
- [ ] エラーレスポンスの構造（フィールド名・ステータスコード）が API 全体で統一されている。

#### 計測指標（ISO/IEC 25023:2016 準拠）

| 指標 | 定義 |
|---|---|
| **インタフェース適合率** | 宣言された OpenAPI スキーマに対して実際のレスポンスが適合するエンドポイント数 / 全エンドポイント数。 |
| **コントラクト違反発生率** | CDC テスト実行回数のうちコントラクト違反が検出された割合（目標: 0 %）。 |
| **スキーマ後方互換性違反件数** | リリースサイクルごとに検出された breaking change の件数（目標: 0）。 |
| **プロトコル標準準拠率** | RFC 9110 / RFC 8259 の必須要件（MUST 条項）に準拠しているエンドポイントの割合。 |

---

## 3. 横断的な設計戦略

### 3.1 バージョニング戦略

互換性を長期的に維持するには、明示的なバージョニングポリシーが不可欠である。

- **URI バージョニング** (`/v1/`, `/v2/`): 後方互換性を破る変更を新バージョンに限定し、旧バージョンを一定期間並行稼働させる。
- **セマンティックバージョニング**: `MAJOR.MINOR.PATCH` で breaking change / 非 breaking 追加 / バグ修正を区別する。スキーマ変更に適用するとコンシューマへの影響範囲が明確になる。
- **フィーチャーフラグ**: 後方非互換な変更を段階的にロールアウトし、互換性問題が発生したときに即座にロールバックできるようにする。

### 3.2 テスト戦略の分層

```
[ ユニットテスト ]         → シリアライゼーション / デシリアライゼーション正確性
[ コントラクトテスト ]     → Consumer-Driven Contracts (CDC) による API 契約検証
[ 統合テスト ]             → エンドツーエンドのプロトコル適合性確認
[ 互換性リグレッションテスト ] → 旧バージョンクライアントとの結合テスト
```

### 3.3 標準化と依存管理

- 社内 API は OpenAPI スキーマを Single Source of Truth とし、サーバスタブ・クライアント SDK をコード生成で導出することでドリフトを防ぐ。
- 外部標準（IETF RFC, W3C 仕様）への準拠は、実装レベルではなく仕様レベルでトレーサビリティを記録する。

---

## 4. レビュー時の重点チェックリスト（要約）

### 共存性

- [ ] リソース（CPU・メモリ・ポート・FD）に上限が設定されている
- [ ] 名前空間・設定キーが他コンポーネントと衝突しない
- [ ] プロセス終了時のクリーンアップが保証されている
- [ ] テストが独立したリソース空間で動作する

### 相互運用性

- [ ] API 仕様（OpenAPI 等）がコードと同期されている
- [ ] 変更が after/before の両方のクライアントで動作することを検証済み
- [ ] CDC テストが CI に組み込まれている
- [ ] Protobuf / Avro を使用する場合はスキーマ進化ルールに従っている
- [ ] HTTP ヘッダ（`Content-Type`, `Accept`, ステータスコード）が仕様準拠

---

## 5. アンチパターン

| アンチパターン | 説明 | 対策 |
|---|---|---|
| **暗黙の型変換依存** | JSON の数値を文字列として扱うコンシューマが存在するまま型変更を行う | OpenAPI の `type` を厳格に定義し、コントラクトテストで検証する |
| **フィールド削除によるサイレント破壊** | 使われていないと思ったフィールドを無告知で削除し、特定コンシューマが壊れる | `deprecated` マーキング → 告知期間 → 削除の 3 フェーズを踏む |
| **グローバルポートハードコード** | サービスが `8080` などを決め打ちし、同一ホストに複数インスタンスを起動できない | 起動時パラメータ化 + dynamic port allocation |
| **バージョン番号のないスキーマ** | Avro/Protobuf のスキーマを版管理せずに上書き運用し、古いメッセージを読めなくなる | Schema Registry（Confluent 等）で版を管理し、互換性モードを `BACKWARD` に設定 |
| **コントラクトのない API 統合** | ドキュメントのみを頼りに統合し、プロバイダ変更がコンシューマに伝わらない | CDC テストを CI に組み込み、プロバイダ変更時にコンシューマビルドを自動検証する |
| **ノイジー・ネイバー** | リソース上限を定めずに同居サービスがメモリを圧迫し、隣接サービスの SLO を侵害する | cgroup v2 / Kubernetes `resources.limits` で上限を宣言する |

---

## 6. リファレンス

### 規格・標準

1. **ISO/IEC 25010:2023** — *Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model*. ISO/IEC, 2023.  
   <https://www.iso.org/standard/78176.html>

1a. **ISO/IEC 25010:2011** — *Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — System and software quality models*. ISO/IEC, 2011. （旧版、参考）  
   <https://www.iso.org/standard/35733.html>

2. **ISO/IEC 25023:2016** — *Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Measurement of system and software product quality*. ISO/IEC, 2016.  
   <https://www.iso.org/standard/35747.html>

3. **IEEE/Open Group 1003.1-2024** — *IEEE/Open Group Standard for Information Technology — Portable Operating System Interface (POSIX) Base Specifications, Issue 8*. IEEE, 2024.  
   <https://standards.ieee.org/ieee/1003.1/7700/>

### IETF RFC

4. **RFC 9110** — Fielding, R., Nottingham, M., and Reschke, J. (Eds.), *HTTP Semantics*. IETF STD 97, June 2022.  
   <https://datatracker.ietf.org/doc/html/rfc9110>

5. **RFC 8259** — Bray, T. (Ed.), *The JavaScript Object Notation (JSON) Data Interchange Format*. IETF STD 90, December 2017.  
   <https://datatracker.ietf.org/doc/html/rfc8259>

### W3C 仕様

6. **W3C TAG** — Jacobs, I., Walsh, N. (Eds.), *Architecture of the World Wide Web, Volume One*. W3C Recommendation, December 2004.  
   <https://www.w3.org/TR/webarch/>

7. **OpenAPI Initiative** — *OpenAPI Specification v3.1.0*. OpenAPI Initiative / Linux Foundation, 2021.  
   <https://spec.openapis.org/oas/v3.1.0.html>

### データシリアライゼーション仕様

8. **Google Developers** — *Language Guide (proto3): Updating A Message Type*. Protocol Buffers Documentation.  
   <https://protobuf.dev/programming-guides/proto3/>

9. **Apache Software Foundation** — *Apache Avro Specification (v1.11.1): Schema Resolution*. Apache Avro Documentation, 2023.  
   <https://avro.apache.org/docs/1.11.1/specification/>

### API コントラクトテスト

10. **Robinson, I.** — *Consumer-Driven Contracts: A Service Evolution Pattern*. MartinFowler.com, 2006.  
    <https://martinfowler.com/articles/consumerDrivenContracts.html>

11. **Schwarz, G.-D., Quast, F., and Riehle, D.** — *Ensuring Syntactic Interoperability Using Consumer-Driven Contract Testing*. Software Testing, Verification and Reliability, Wiley, 2025.  
    <https://onlinelibrary.wiley.com/doi/10.1002/stvr.70006>
