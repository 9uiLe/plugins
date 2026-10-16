import React from "react"
import type { ExplanationModel, Finding } from "../domain/explanation-model"
import type { Presentation, PresentationSection } from "../domain/presentation"
import { ArchitectureView } from "../components/architecture/views"
import { ClaimStatus, RenderState, checkClaim } from "../components/architecture/common"
import { EvidenceRefs } from "../components/architecture/code"
import { Corners } from "../components/architecture/rail"

const audiences: Record<ExplanationModel["audience"]["profile"], string> = { newcomer: "新規参加者", implementer: "実装者", reviewer: "レビュアー", architect: "アーキテクト", debugger: "不具合の調査者" }
const guide = [
  { h: "縦線は処理の順序", p: "左の縦線が流れ。番号つきの四角がステップ、ひし形が途中で止まる条件。カードを上から順に読めばよい。" },
  { h: "コードは説明の隣", p: "説明のすぐ隣に実コードを置く。帯の付いた行と番号つきの注釈が、本文のどの主張を裏づける行かを示す。" },
  { h: "例外だけが目立つ", p: "ラベルが付かないものは、コードで確認済み。推論は破線の枠、不明は点線の枠とラベルで、そのときだけ目立たせる。" },
]
function lead(section:PresentationSection,model:ExplanationModel):string|undefined {
  switch(section.type){
    case "sequence":case "runtime_flow":case "annotated_code":{
      const scenario=model.runtime_scenarios.find(item=>item.id===section.sources[0])
      const branches=scenario?.exceptional_paths.some(path=>path.at_step>=(section.steps?.first??1)&&path.at_step<=(section.steps?.last??scenario.steps.length))
      return `縦線が本線で、上から下へ実行される。四角の番号はステップ${branches?"、ひし形は途中で止まる条件。「はい」なら縦線から横へ出て終点で終わり、「いいえ」なら縦線を下へ進む":""}。`
    }
    case "component_map":return "図の矢印は依存の向き。下の縦線に、構成要素ごとの責務と実装のコードを並べる。"
    case "system_context":return "中央の強調した箱が対象。矢印はやり取りの向きで、ラベルはその内容。"
    case "data_flow":return "矢印はデータの流れの向き。上辺が二重線の箱がデータ。"
    case "state_transition":return "縦線は本線の状態を上から順に並べ、状態を変える操作ごとに条件とコードを置く。本線から外れる操作は「別の出口」に分ける。"
    case "decision":return "各判断を「前提 → 判断 → 理由 → 失うもの」の順に示す。判断の欄のコードは判断の実装、理由の欄のコードや文書は理由の出どころ。"
    default:return undefined
  }
}
function SectionHead({section,no,state}:{section:PresentationSection;no:string;state:RenderState}) {
  const finding=section.finding?state.get<Finding>(section.finding):undefined
  if(finding)checkClaim(finding,finding.id)
  const text=lead(section,state.model)
  return <header className="section-head">
    <p className="section-eyebrow"><span>{no}</span>{finding&&section.question}</p>
    <h2 data-evidence={finding?.status}>{finding?finding.statement:section.question}{finding&&<> <ClaimStatus claim={finding} state={state} about={finding.id}/></>}</h2>
    {finding&&<EvidenceRefs ids={finding.evidence} state={state} label="結論の根拠"/>}
    {text&&<p className="section-lead">{text}</p>}
  </header>
}
function UnknownAppendix({model,shown}:{model:ExplanationModel;shown:Set<string>}) {
  const rest=model.unknowns.filter(item=>!shown.has(item.id))
  if(!rest.length)return null
  return <section id="unknown-appendix"><header className="section-head"><p className="section-eyebrow"><span>付</span>不明点</p><h2>不明点の解消方法</h2></header>{rest.map(item=><div key={item.id} id={`unknown-${item.id}`} className="unknown-card"><div className="unknown-head"><span className="status" data-evidence="unknown"><i aria-hidden="true"/>不明</span><b>{item.question}</b></div><p>{item.reason}</p><p className="unknown-how"><b>解消方法</b>{item.how_to_resolve}</p></div>)}</section>
}

export function Document({presentation,css,state,script}:{presentation:Presentation;css:string;state:RenderState;script?:string}) {
  const model=state.model, title=presentation.title||model.subject.title
  const numbers=presentation.sections.map((_,i)=>String(i+1).padStart(2,"0"))
  const unknownsInSections=new Set(presentation.sections.filter(section=>section.type==="known_unknowns").flatMap(section=>section.sources))
  const appendixUnknowns=model.unknowns.some(item=>!unknownsInSections.has(item.id))
  return <html lang="ja"><head><meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>{title}</title><style dangerouslySetInnerHTML={{__html:css}}/></head>
    <body data-theme={presentation.theme}><a className="skip" href="#main">本文へ移動</a>
      <header className="doc-header">
        <p className="eyebrow">ARCHITECTURE EXPLAINER ／ 読者: {audiences[model.audience.profile]} ／ 根拠: {model.source.revision}</p>
        <h1>{title}</h1><p className="doc-question">{model.subject.question}</p>
        <div className="reading-guide blueprint"><Corners/>{guide.map((item,i)=><div key={item.h}><span>{String(i+1).padStart(2,"0")}</span><b>{item.h}</b><p>{item.p}</p></div>)}</div>
      </header>
      <div className="page"><nav className="toc" aria-label="目次"><p>QUESTIONS</p><ol>{presentation.sections.map((section,i)=><li key={section.id}><a href={`#${section.id}`}><span>{numbers[i]}</span>{section.question}</a></li>)}
          {appendixUnknowns&&<li><a href="#unknown-appendix"><span>付</span>不明点の解消方法</a></li>}</ol></nav>
        <main id="main">{presentation.sections.map((section,i)=><section key={section.id} id={section.id} className={section.id==="what"?"first-view":undefined}><SectionHead section={section} no={numbers[i]} state={state}/><ArchitectureView section={section} state={state} no={numbers[i]}/></section>)}
          <UnknownAppendix model={model} shown={unknownsInSections}/>
        </main>
      </div>
      {script&&<script dangerouslySetInnerHTML={{__html:script}}/>}
    </body>
  </html>
}
