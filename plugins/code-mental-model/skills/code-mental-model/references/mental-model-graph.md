# Mental Model Graph の作り方

対象コードの調査後、HTML を書く前に読む。グラフは完成 HTML と一対一である必要はないが、図に現れる node・edge・変更・境界の根拠をここで揃える。文章の章立てから図を後付けしない。

## 1. Node extraction

ユーザーが主経路や変更の影響を予測するために区別する必要がある対象を node にする。候補は入口、UseCase / Service、domain entity、Repository / DataSource、状態保持者、DB、API、SDK、外部システム。class 名だけで意味が通らない場合は「固有名」と「一般的役割」を併記する。helper、private function、受動的な DTO は原則として主図から外すが、状態遷移・境界・データ変換を担うなら残す。

各 node の draft には `key / label / kind / layer / state / status / roleCode / source` を持たせる。`id` と `codeLens` は builder が生成する。確認できない caller や本番の実装は消さず、必要なら Unknown として残す。型だけが分かり実体が不明な依存先では、型の責務を Confirmed、実体を Unknown と分ける。

## 2. Edge extraction

caller と callee、read と return、create と save などを別の関係として見る。draft の edge は [schema](mental-model-schema.md) の field で関係と根拠を表す。

```text
from / to / kind / label / data / condition
change / status / source / execution
```

使う verb は calls, reads, writes, creates, owns, depends on, implements, returns, emits, observes, transforms, persists, fetches, injects, delegates to など、実際の関係に合わせる。「→」だけの辺は避ける。重要な戻り値は逆方向の edge として示すか、往復を読み取れる矢印・ラベルを付ける。細かい引数をすべて並べず、分岐や変換を決めるデータを edge 上に置く。データが独自の状態や変換の意味を持つ場合は node にする。

draft の `source` には代表的なファイル・行範囲だけを対応付ける。builder が固定コンテキストで Code Lens を抽出し、presentation が token と差分 marker を決め、renderer が HTML に直列化する。node や edge を選んだ一回の操作でその lens を表示する。対応コードが確認できない Unknown node に架空の抜粋を作らない。

## 3. Boundary / state / failure

プロセス、ネットワーク、DB、モジュール、スレッド・coroutine、外部 SDK の境界をコードと設定から確認する。単なる interface や mock を見てネットワーク越しだと決めつけない。外部境界は node の形と役割文言で示し、失敗・遅延・競合が起きる箇所を詳細へ結ぶ。状態を持つ node には「誰の状態か」「いつ書き換わるか」「永続か一時か」を付ける。重要な invariant と failure mode は該当 node/edge の近くへ紐付ける。

## 4. Graph simplification

中心の問いに答える node と edge を主図に残し、helper や詳細な class は選択先の説明へ移す。消した node を飛び越える edge の意味は正確に書き直す。異なる edge を「利用する」などの曖昧な関係へ勝手に統合しない。ノード単体の説明が増える一方で線が少ないなら、呼び出し元・戻り・保存先を再調査する。

## 5. Layout と実行投影

Agent は node の `layer` を確認された責務から選ぶ。並び順・座標・レーン・edge routing は renderer が固定規則で決める。edge crossing やラベル衝突は renderer のアルゴリズムと固定 assets を改善し、特定の成果物だけを手配置しない。

edge の `execution` に、シナリオ名ごとの手順番号を記録する。一つのシナリオには同時に成立する edge だけを入れ、分岐条件を区別できる名前を付ける。共有 edge は複数シナリオへ同じ ID で含める。Structure と Execution で ID と配置を変えず、Execution では選択中シナリオの node と edge だけを表示する。番号を選ぶと手順と条件の説明を表示し、経路切替で対象外になった選択は解除する。

## 6. Change overlay

差分の before と after から node と edge の `added / removed / changed / existing` を付ける。変更されたコード行ではなく、関係の意味を基準にする。既存の edge の前提条件が変わった場合も `changed` とする。Added は `+`、Removed は `−` と破線等、Changed は `Δ`、Existing は通常線のように色以外で表す。初期表示でも少なくとも変更箇所を指せるようにする。removed edge は「現在も存在する経路」に見えない表示にする。変更理由がコードで証明できなければ Inferred / Unknown にする。

## 7. 描画前の整合確認

- すべての可視 node と edge に根拠、または Inferred / Unknown の表示があるか。
- 主要な辺で operation、流れるデータ、方向、条件を読み取れるか。
- 状態保持者と副作用の発生先、境界を図から指せるか。
- 変更により何の接続・条件が変わったか、図を見て答えられるか。
- ある node が失敗したときに影響する接続を、図上で追えるか。

これらを満たした後に、読者向けの補足文を作る。
