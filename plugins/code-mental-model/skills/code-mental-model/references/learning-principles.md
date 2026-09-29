# 学習原理と Skill への変換

ここに挙げる研究の多くは物理・数学の学習や短いプログラムを対象にする。HTML による実務コードの理解向上を直接実証したものとして扱わない。各行の「示唆」は本 Skill の設計判断であり、論文の実験結果そのものではない。

| 一次資料と研究結果・議論 | 設計上の示唆 | 実行ルール |
| --- | --- | --- |
| [Sweller (1988), *Cognitive Load During Problem Solving: Effects on Learning*](https://onlinelibrary.wiley.com/doi/10.1207/s15516709cog1202_4)。手段目的分析が認知的資源を使い、スキーマ獲得に使える容量と競合しうると論じる。 | 構造を探すクリック・視線移動を減らし、関係を考える努力は残す。 | Map を冒頭に置き、選択中の線・説明・該当コードを近接して表示する。補足だけ必要時に展開する。 |
| [Pennington (1987), *Stimulus Structures and Mental Representations in Expert Comprehension of Computer Programs*](https://doi.org/10.1016/0010-0285%2887%2990007-7)。専門家がまず手続き的なエピソードを捉え、後の理解には作業目標も影響すると報告する。 | 実装の関係と目的の関係を分けて作り、後で対応付ける。 | Program Model の node・edge に、選択時だけ業務上の意味を Inspector で接続する。すべての読者が常に同じ順序で理解するとの断定はしない。 |
| [Soloway & Ehrlich (1984), *Empirical Studies of Programming Knowledge*](https://www.cs.kent.edu/~jmaletic/Prog-Comp/Papers/soloway84.pdf)。プログラミングの定型的な計画や慣習についての知識が、プログラム理解に関わることを実験的に検討する。 | 未知の実装を既知の一般的スキーマへ結び付ける。 | 固有名と Repository / pipeline / cache-aside などの一般概念を分けて表示する。ただし振る舞いが合わないパターン名を押し付けない。 |
| [Larkin & Simon (1987), *Why a Diagram is (Sometimes) Worth Ten Thousand Words*](https://onlinelibrary.wiley.com/doi/10.1111/j.1551-6708.1987.tb00863.x)。配置によって関連情報を近接させる図は、文章と同じ情報でも探索・推論の手間を減らしうると分析する。 | 図は関係を見つける作業を肩代わりする場合に限り有効。 | 順序なら sequence、遷移なら state、責務なら component map を選ぶ。説明を図に丸写しせず、図とラベルを近接させる。 |
| [Chi, Bassok, Lewis, Reimann & Glaser (1989), *Self-Explanations*](https://onlinelibrary.wiley.com/doi/10.1207/s15516709cog1302_1)。力学の解答例を学ぶ学生の自己説明が、原理との接続や理解の監視に関連した。 | 読み手が自発的に因果関係を再構築できる余地を残す。 | Self-explanation は任意。置くなら短い予測問いと任意表示の答えにし、回答や理解証明を要求しない。 |
| [Atkinson, Derry, Renkl & Wortham (2000), *Learning from Examples*](https://doi.org/10.3102/00346543070002181)。worked examples の研究を整理し、例の要素を統合し、概念構造をラベルや区切りで示す設計を提案する。 | 抽象説明を実コードの一例に結び、個々の操作が全体のどこに当たるか示す。 | 代表ケースを入力 → 判断 → 状態変化 → 副作用 → 出力まで追い、各段階を図や表の近くで注釈する。 |
| [Mayer & Moreno (2003), *Nine Ways to Reduce Cognitive Load in Multimedia Learning*](https://www.tandfonline.com/doi/abs/10.1207/S15326985EP3801_6)。絵と言葉の処理容量、過負荷の状況、負荷を減らす提案を検討する。 | 図と文章を併用するときも、関連箇所を探す負担と不要な情報を抑える。 | 図と凡例を近づけ、意味のない装飾や重複説明を削る。重要情報はデフォルト表示し、細部だけ段階的に開示する。 |
| **Signaling / Cueing Principle** — [Mautone & Mayer (2001), *Signaling as a Cognitive Guide in Multimedia Learning*](https://doi.org/10.1037/0022-0663.93.2.377) と [Mayer & Moreno (2003)](https://www.tandfonline.com/doi/abs/10.1207/S15326985EP3801_6)。前者は学習素材内のシグナルが転移課題に寄与した実験を報告し、後者は signaling と対応する語・図の近接を過負荷対策として論じる。 | 関連する図とテキスト、図とコードの対応箇所を示すことは、視覚探索を減らし、関係の統合を助ける設計上の類推になる。コード理解への直接の実証ではない。 | edge 選択時に Map の線・端点・対応コード行を同じ selection cue で示す。Code Lens は選択と同時に現れ、追加操作を要しない。syntax color は走査の補助に留め、概念と実コードを結ぶ semantic cue を優先する。 |
| [Roediger & Karpicke (2006), *Test-Enhanced Learning*](https://doi.org/10.1111/j.1467-9280.2006.01693.x)。文章を対象に、再読と想起練習の長期保持を比較した。 | 記憶の再生は役立ちうるが、本 Skill の目的はクイズ成績ではなく挙動の予測。 | 自己確認を置く場合は任意の予測問いにし、識別子の暗記や回答強制を避ける。 |
| [Bjork & Bjork (2011), *Making Things Hard on Yourself, but in a Good Way*](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/11/Making-Things-Hard-on-Yourself-but-in-a-Good-Way-20111.pdf)。学習を助けうる困難と、単なる負担を区別する議論を整理する。 | 因果関係を読者が考える effort と、対応箇所を探すだけの effort を分ける。 | 予測の余地は残し、クリック階層・遠い凡例・図とコードの照合作業は減らす。 |
| [Patall, Cooper & Robinson (2008), *The Effects of Choice on Intrinsic Motivation and Related Outcomes*](https://pubmed.ncbi.nlm.nih.gov/18298272/)。選択が動機づけ等に及ぼす研究を統合した。 | 固定の読了順や強制クイズを設ける根拠にはならない。読者が調べたい関係へ直接進める設計を選ぶ。 | Sidebar は中立なナビゲーションとし、Map から node / edge / code へ自由に進める。 |
| [Storey (2006), *Theories, Tools and Research Methods in Program Comprehension: Past, Present and Future*](https://link.springer.com/article/10.1007/s11219-006-9216-4)。理解の理論と支援ツールを、人・プログラム・作業文脈の違いに照らして論じるレビュー。 | 万能な単一図や固定の詳細量を前提にしない。 | 入力と読者の既知事項、変更理解か全体把握かという目的に応じて図・用語・深さを選び、不要な節を削る。 |

## 使い方の境界

これらから「図が多いほど良い」「syntax highlighting だけでコードを理解できる」「自己確認が理解を保証する」「Program Model と Situation Model が厳密な順序で形成される」とは言えない。完成判定は作成者の QA とし、読者に理解度を証明させない。
