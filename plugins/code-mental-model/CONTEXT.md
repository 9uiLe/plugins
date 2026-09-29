# Code Mental Model

既存コードの振る舞いと変更の影響を、根拠付きのオブジェクトと関係から理解するための概念を定める。

## Language

**Raw Analysis**:
コード調査から得た、まだ識別子と順序が確定していないオブジェクトと関係の記述。
_Avoid_: Mental Model, canonical model

**Mental Model**:
何が存在し、互いにどう関係し、状態・副作用・変更・実行順序がどこにあるかを表す、検証済みの意味構造。
_Avoid_: HTML, graph layout

**Node**:
理解や影響予測に必要なオブジェクト、状態の所有者、外部境界、または生成される値。

**Edge**:
二つの Node の間に実際に存在する方向付きの関係。
_Avoid_: 見た目だけを整える線

**Evidence Status**:
Node または Edge の主張がコード等で確認済みか、根拠付き推論か、未確認かの区別。
_Avoid_: Change

**Change**:
既存・追加・削除・変更のうち、対象の差分上の状態。
_Avoid_: Evidence Status

**Execution Scenario**:
一つの条件集合のもとで成立する実行経路。Edge の順番はシナリオごとに定まる。

**Code Lens**:
Node または Edge の主張を確認できる短いソース範囲と、その中の注目行。

**Graph Layout**:
Mental Model の意味構造を、位置・経路・ラベル配置へ写した結果。
_Avoid_: Mental Model

**Readability Metrics**:
交差、重なり、曖昧な往復線など、Graph Layout を比較するための測定値。
