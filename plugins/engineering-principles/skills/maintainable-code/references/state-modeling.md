# 状態の設計

Optional・Boolean・enum・状態遷移など、状態の表現が判断に関わる時に読む。

## 目標

存在してはいけない状態を表現できないようにする。状態を実装上の偶然として扱わず、Domain 上の意味があるなら型として表現する。

## 洗い出すもの

| 項目 | 問い |
| --- | --- |
| 有効な状態 | Domain 上、どの状態が存在するか |
| 無効な状態 | 現在の型で表現できてしまうが、Domain 上は存在しない組み合わせは何か |
| 状態遷移 | どの状態からどの状態へ、何をきっかけに移るか。禁止される遷移は何か |
| Invariant | どの状態でも常に成り立つべき条件は何か |

## 独立した field に分散した状態

```swift
var result: Result?
var isLoading: Bool
var error: Error?
```

この構造では `result != nil && isLoading == true` や `result != nil && error != nil` が表現できてしまう。Domain 上 `idle` / `loading` / `loaded` / `failed` しか存在しないなら、それを型で表す。

```swift
enum State {
    case idle
    case loading
    case loaded(Result)
    case failed(Error)
}
```

状態ごとに必要なデータを associated value として持たせると、「loaded なのに result がない」状態も表現できなくなる。言語に enum の associated value がない場合は、sealed class、discriminated union、tagged union など、同じ性質を持つ構造を使う。

## Optional

Optional は禁止しない。`middleName: String?` のように、Domain 上の意味が「値がある / ない」の 2 つだけなら Optional は自然である。

一方 `user: User?` が、実際には未取得・取得中・取得成功・取得失敗・ログアウトを暗黙に表している場合、Optional では Domain State が失われている。呼び出し側は nil の意味を文脈から推測するしかなく、新しい状態を追加した時に分岐漏れが起きる。

**判断基準:** nil は本当に「値が存在しない」という 1 つの状態なのか。複数の意味を nil に持たせない。

## Boolean

Boolean は禁止しない。独立した yes / no の Domain Fact（通知を受け取るか、管理者か）であれば Boolean でよい。

問題は、`isLoading`、`isEnabled`、`hasError`、`isCompleted` などの組み合わせが一つの状態機械を作っている場合である。n 個の Boolean は 2^n の組み合わせを表現できるが、その多くは Domain 上存在しない。

**判断基準:** その Boolean の値は、他の Boolean の値と独立に変わるか。独立でないなら、明示的な State Model を検討する。

## 状態遷移

遷移に規則がある場合は、遷移を一箇所に集める。複数のコンポーネントが同じ遷移規則をそれぞれ実装していると State coupling になり、規則の変更が波及する。

- 遷移を状態型のメソッドや reducer など、一つの関数で表す
- 禁止される遷移は、型で表現できない場合でも、その関数の中で拒否する
- 遷移の規則は Unit Test で保証する（有効な遷移と、禁止される遷移の両方）

## 過剰なモデル化を避ける

状態の明示化も abstraction の一種である。次の場合は型を増やさない。

- 組み合わせがすべて Domain 上有効である
- 状態が 1 箇所でしか使われず、無効な組み合わせが構造上生じない
- 既存の Optional / Boolean で表現の曖昧さがなく、呼び出し側が意味を推測していない

型を増やす根拠は、無効な状態が実際に表現可能であること、または nil や Boolean の意味が呼び出し側で曖昧になっていることを Evidence として示せる場合に限る。
