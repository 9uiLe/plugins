import React from "react"
import type { Actor, Change, Component, DataItem, Decision, ExternalSystem, Evidence, Invariant, Reference, Scenario, State, Unknown, Claim } from "../../domain/explanation-model"
import type { PresentationSection } from "../../domain/presentation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { ArchitectureGraph, GraphLegend } from "./graph"
import { ClaimStatus, Figure, RenderState, assertEvidenceBacked, breakPath, breakSymbol, checkClaim } from "./common"
import { EvidenceCode, EvidenceRefs } from "./code"
import { Corners, FlowOverview, Rail, StateOverview, type RailRowData } from "./rail"
import { graphData } from "./graph-data"

type ViewProps = { section:PresentationSection; state:RenderState; no:string }

function OverviewCard({title,description,claim,state,about,concept}:{title:React.ReactNode;description?:string;claim:Claim;state:RenderState;about?:string;concept?:boolean}) {
  checkClaim(claim,about)
  return <div className="overview-card blueprint node" data-kind={concept?"component":"claim"} data-evidence={claim.status}><Corners/><h3>{title}</h3>{description&&<p data-responsibility={concept?"true":undefined}>{description}</p>}<ClaimStatus claim={claim} state={state} about={about}/><EvidenceRefs ids={claim.evidence} state={state}/></div>
}
function Overview({section,state}:ViewProps) {
  const purpose=state.model.purpose
  checkClaim(purpose,"purpose")
  return <Figure question={section.question}>
    <p className="lede">{purpose.problem}</p>
    <div className="purpose" data-evidence={purpose.status}><p>{purpose.responsibility} <ClaimStatus claim={purpose} state={state} about="purpose"/></p><EvidenceRefs ids={purpose.evidence} state={state}/></div>
    <div className="overview-cards">{section.sources.filter(id=>id!=="purpose").map(id=>{
      const entry=state.sources.get(id)!
      if (entry.kind==="component") {const item=entry.value as Component; return <OverviewCard key={id} title={state.term(id)} description={item.responsibility} claim={item} state={state} about={id} concept/>}
      if (entry.kind==="actor") {const item=entry.value as Actor; return <OverviewCard key={id} title={state.term(id)} description={item.role} claim={item} state={state} about={id} concept/>}
      if (entry.kind==="external") {const item=entry.value as ExternalSystem; return <OverviewCard key={id} title={state.term(id)} description={item.interaction} claim={item} state={state} about={id} concept/>}
      if (entry.kind==="scenario") {const item=entry.value as Scenario; return <div key={id} className="overview-card blueprint node"><Corners/><h3>{item.name}</h3><p>{item.trigger}</p><p className="overview-meta">{item.steps.length} ステップ</p></div>}
      if (entry.kind==="change") {const item=entry.value as Change; return <OverviewCard key={id} title={item.change} description={item.after.behavior} claim={item.after} state={state} about={item.after.id}/>}
      return null
    })}</div>
  </Figure>
}

function componentRows(section:PresentationSection,state:RenderState,no:string):RailRowData[] {
  return section.sources.map((id,i)=>{const item=state.get<Component>(id);checkClaim(item,id);return {
    id:`${section.id}-${id}`, kind:"process", num:String(i+1), title:state.term(id), text:item.responsibility, status:item.status,
    claimStatus:<ClaimStatus claim={item} state={state} about={id}/>, evidence:item.evidence, where:`${no} の ${state.name(id)}`,
    edges:item.depends_on.filter(edge=>section.sources.includes(edge.target)).map(edge=><>→ {state.name(edge.target)}: {edge.meaning}</>),
  }})
}
function GraphView({section,state,no}:ViewProps) {
  if(section.type!=="system_context"&&section.type!=="component_map"&&section.type!=="data_flow")throw new Error(`unsupported graph section: ${section.type}`)
  const {nodes}=graphData(section,state)
  const kinds=new Set(nodes.map(node=>node.kind))
  return <Figure question={section.question}>
    <div className="graph-frame"><ArchitectureGraph id={section.id} question={section.question} caption={section.question} graph={state.layout(section.id)}/></div>
    {kinds.size>1&&<GraphLegend kinds={[...kinds]}/>}
    {section.type==="system_context"&&state.model.context.boundaries.length>0&&<div className="boundaries"><h3>境界</h3><ul>{state.model.context.boundaries.map(boundary=><li key={boundary.id} data-kind="boundary"><strong>{boundary.kind}</strong>: {boundary.contains.map(id=>state.glossary.get(id)?.preferred||id).join("、")}</li>)}</ul></div>}
    {section.type==="component_map"
      ?<Rail rows={componentRows(section,state,no)} state={state}/>
      :<ul className="node-list">{nodes.filter(node=>node.evidence?.length).map(node=>{
        const source=state.sources.get(node.id)
        const detail=source?.kind==="actor"?(source.value as Actor).role:source?.kind==="external"?(source.value as ExternalSystem).interaction:source?.kind==="data"?(source.value as DataItem).stored_in:source?.kind==="component"?(source.value as Component).responsibility:""
        if(node.kind==="data"){assertEvidenceBacked(node.evidence!,state);return <li key={node.id} data-evidence-backed="true" data-evidence-ids={node.evidence!.join(" ")}><b>{state.term(node.id)}</b>{detail&&<span>{detail}</span>}<EvidenceRefs ids={node.evidence!} state={state}/></li>}
        return <li key={node.id} data-evidence={node.status}><b>{state.term(node.id)}</b>{detail&&<span>{detail}</span>}<ClaimStatus claim={{status:node.status!,evidence:node.evidence!}} state={state} about={node.id}/><EvidenceRefs ids={node.evidence!} state={state}/></li>
      })}</ul>}
  </Figure>
}

function question(text:string):string { return /[か?？]$/.test(text)?text:`${text}か` }
function Runtime({section,state,no}:ViewProps) {
  const scenario=state.get<Scenario>(section.sources[0])
  const first=section.steps?.first??1,last=section.steps?.last??scenario.steps.length
  const stepId=(n:number)=>`${section.id}-${n}`, branchId=(n:number,index:number)=>`${section.id}-${n}x${index}`
  const selected=scenario.steps.slice(first-1,last).map((step,i)=>{const n=first+i;return {step,n,branches:scenario.exceptional_paths.map((path,index)=>({path,index})).filter(({path})=>path.at_step===n)}})
  const rows:RailRowData[]=[]
  if(first===1)rows.push({id:`${section.id}-start`,kind:"start",title:"開始",text:scenario.trigger,where:""})
  for(const {step,n,branches} of selected){
    const about=`${scenario.id}.step.${n-1}`
    checkClaim(step,about)
    rows.push({id:stepId(n),kind:"step",num:String(n),title:step.action,route:<>{state.term(step.from)} → {state.term(step.to)}</>,status:step.status,claimStatus:<ClaimStatus claim={step} state={state} about={about}/>,evidence:step.evidence,where:`${no} のステップ ${n}`})
    for(const {path,index} of branches){
      const pathAbout=`${scenario.id}.exception.${index}`
      checkClaim(path,pathAbout)
      rows.push({id:branchId(n,index),kind:"decision",title:question(path.condition),result:path.result,status:path.status,claimStatus:<ClaimStatus claim={path} state={state} about={pathAbout}/>,evidence:path.evidence,where:`${no} のステップ ${n} の分岐`})
    }
  }
  rows.forEach((row,i)=>{row.hasNext=i<rows.length-1})
  const overview=section.type!=="annotated_code"?selected.map(({step,n,branches})=>({href:`#${stepId(n)}`,num:String(n),title:step.action,status:step.status,exits:branches.map(({path,index})=>({href:`#${branchId(n,index)}`,result:path.result}))})):[]
  return <Figure question={section.question} caption={scenario.trigger}>
    {overview.length>1&&<FlowOverview steps={overview} label={`${section.question}の全体像`}/>}
    <Rail rows={rows} state={state}/>
  </Figure>
}

type Transition = State["transitions"][number]
type IndexedTransition = { transition:Transition; index:string }
// The main chain follows, from the first state, the destination that leads on to the most transitions; other destinations are exits.
function stateChain(section:PresentationSection,state:RenderState):{chain:{name:string;next?:{to:string;transitions:IndexedTransition[]}}[];exits:{from:string;item:IndexedTransition}[]} {
  const states=section.sources.map(id=>state.get<State>(id)), byName=new Map(states.map(item=>[item.name,item]))
  const leadsOn=(name:string)=>byName.get(name)?.transitions.length??0
  const chain:{name:string;next?:{to:string;transitions:IndexedTransition[]}}[]=[],exits:{from:string;item:IndexedTransition}[]=[],visited=new Set<string>()
  let current:State|undefined=states[0]
  while(current&&!visited.has(current.name)){
    visited.add(current.name)
    const from=current, transitions=from.transitions.map((transition,i)=>({transition,index:`${from.id}-${i}`}))
    if(!transitions.length){chain.push({name:from.name});break}
    const to=[...transitions].sort((a,b)=>leadsOn(b.transition.to)-leadsOn(a.transition.to))[0].transition.to
    chain.push({name:from.name,next:{to,transitions:transitions.filter(({transition})=>transition.to===to)}})
    for(const item of transitions.filter(({transition})=>transition.to!==to))exits.push({from:from.name,item})
    current=byName.get(to)
    if(!current||visited.has(to))chain.push({name:to})
  }
  return {chain,exits}
}
// A state's reader-facing name comes from the glossary entry of the section's State with this name. State names are only unique
// per owner, so the lookup stays inside the section; destinations without a State keep the code value.
function stateLabel(name:string,states:State[],state:RenderState):{plain:string;node:React.ReactNode} {
  const entity=states.find(item=>item.name===name), entry=entity&&state.glossary.get(entity.id)
  if(!entity||!entry||entry.preferred===name)return {plain:name,node:<code className="state-code">{name}</code>}
  return {plain:entry.preferred,node:<><span data-concept={entity.id}>{entry.preferred}</span> <code className="state-code">{name}</code></>}
}
function StateTransitions({section,state,no}:ViewProps) {
  const {chain,exits}=stateChain(section,state), states=section.sources.map(id=>state.get<State>(id)), label=(name:string)=>stateLabel(name,states,state)
  const stateId=(name:string,suffix="")=>`${section.id}-state-${name}${suffix}`, transitionId=(index:string)=>`${section.id}-tr-${index}`
  const stateRow=(name:string,id:string):RailRowData=>({id,kind:"state",title:label(name).node,where:""})
  const transitionRow=(from:string,{transition,index}:IndexedTransition,orLabel?:string):RailRowData=>{
    assertEvidenceBacked(transition.evidence,state)
    const title=transition.action??transition.event, identifier=/^[\w.-]+$/.test(transition.event)
    return {id:transitionId(index),kind:"transition",title,titleMono:!transition.action&&identifier,
      route:<>{transition.action&&identifier&&<><code>{transition.event}</code>{"　"}</>}{label(from).plain} → {label(transition.to).plain}</>,
      cond:transition.guard,orLabel,evidence:transition.evidence,backed:true,where:`${no} の「${title}」`}
  }
  const main:RailRowData[]=[], used=new Set<string>()
  for(const link of chain){
    const id=used.has(stateId(link.name))?stateId(link.name,"-end"):stateId(link.name)
    used.add(id)
    main.push(stateRow(link.name,id))
    link.next?.transitions.forEach((item,j)=>main.push(transitionRow(link.name,item,j>0?"または":undefined)))
  }
  const overview={
    states:chain.map(link=>({href:`#${stateId(link.name)}`,label:label(link.name)})),
    links:chain.slice(0,-1).map(link=>(link.next?.transitions??[]).map(({transition,index})=>({href:`#${transitionId(index)}`,text:transition.action??transition.event}))),
    exits:exits.map(({from,item})=>({at:chain.findIndex(link=>link.name===from),href:`#${transitionId(item.index)}`,text:item.transition.action??item.transition.event,target:label(item.transition.to)})),
  }
  return <Figure question={section.question}>
    <StateOverview {...overview} label={`${section.question}の全体像`}/>
    <Rail rows={main} state={state}/>
    {exits.map(({from,item})=><React.Fragment key={item.index}><h3 className="rail-subhead">別の出口: {label(from).plain} → {label(item.transition.to).plain}</h3><Rail rows={[stateRow(from,stateId(from,`-${item.index}`)),transitionRow(from,item),stateRow(item.transition.to,stateId(item.transition.to,`-${item.index}`))]} state={state}/></React.Fragment>)}
  </Figure>
}

function Decisions({section,state,no}:ViewProps) {
  return <Figure question={section.question}>{section.sources.map((id,i)=>{const item=state.get<Decision>(id),label=`判断 D${i+1}`
    checkClaim(item,id)
    return <article key={id} id={`decision-${id}`} className="decision-card blueprint" data-evidence={item.status}><Corners/>
      <div className="decision-no">{label}</div>
      <div className="decision-row"><div className="decision-key">前提</div><div className="decision-value">{item.context}</div></div>
      <div className="decision-row"><div className="decision-key">判断</div><div className="decision-value"><h3>{item.decision}</h3><ClaimStatus claim={item} state={state} about={id}/><div className="decision-code"><EvidenceCode ids={item.evidence} state={state} where={`${no} の${label}`}/></div></div></div>
      <div className="decision-row" data-evidence={item.rationale.status}><div className="decision-key">理由</div><div className="decision-value"><p>{item.rationale.text}</p><ClaimStatus claim={item.rationale} state={state} about={id}/><div className="decision-code"><EvidenceCode ids={item.rationale.evidence} state={state} where={`${no} の${label}の理由`}/></div></div></div>
      {item.tradeoffs.length>0&&<div className="decision-row"><div className="decision-key">失うもの</div><ul className="decision-value">{item.tradeoffs.map((text,j)=><li key={j}>{text}</li>)}</ul></div>}
      {item.alternatives.length>0&&<div className="decision-row"><div className="decision-key">代替案</div><ul className="decision-value">{item.alternatives.map((text,j)=><li key={j}>{text}</li>)}</ul></div>}
    </article>})}</Figure>
}

function References({section,state}:ViewProps) {
  return <Figure question={section.question}><div className="table-wrap"><Table className="references"><TableHeader><TableRow><TableHead>前提知識</TableHead><TableHead>公式ドキュメント</TableHead><TableHead>読む箇所</TableHead></TableRow></TableHeader><TableBody>{section.sources.map(id=>{const ref=state.get<Reference>(id);return <TableRow key={id} id={`reference-${id}`}><TableCell data-label="前提知識">{ref.topic}</TableCell><TableCell data-label="公式ドキュメント"><a href={ref.url} rel="noreferrer">{ref.title}</a></TableCell><TableCell data-label="読む箇所">{ref.note}</TableCell></TableRow>})}</TableBody></Table></div></Figure>
}
function ChangeCard({label,claim,state,no}:{label:string;claim:Claim&{id:string;behavior:string};state:RenderState;no:string}) {
  checkClaim(claim,claim.id)
  return <div className="change-card blueprint" data-evidence={claim.status}><Corners/><div className="decision-no">{label}</div><p>{claim.behavior}</p><ClaimStatus claim={claim} state={state} about={claim.id}/><EvidenceCode ids={claim.evidence} state={state} where={`${no} の${label}`}/></div>
}
function BeforeAfter({section,state,no}:ViewProps) {return <Figure question={section.question}><div className="change-pair">{section.sources.map(id=>{const item=state.get<Change>(id);return <React.Fragment key={id}><ChangeCard label="変更前" claim={item.before} state={state} no={no}/><ChangeCard label="変更後" claim={item.after} state={state} no={no}/></React.Fragment>})}</div></Figure>}
function InvariantCard({item,state,no}:{item:Invariant;state:RenderState;no:string}) {
  checkClaim(item,item.id)
  return <div className="rule-card blueprint" data-evidence={item.status}><Corners/><p className="rule-text">{item.description}</p><p className="rule-enforced"><span>強制しているもの</span>{item.enforced_by}</p><ClaimStatus claim={item} state={state} about={item.id}/><EvidenceCode ids={item.evidence} state={state} where={`${no} の規則`}/></div>
}
function ChangeImpact({section,state,no}:ViewProps) {return <Figure question={section.question}>{section.sources.map(id=>{
  const source=state.sources.get(id)!
  if(source.kind==="invariant")return <InvariantCard key={id} item={source.value as Invariant} state={state} no={no}/>
  const item=source.value as Change
  const impacts=(kind:"affected"|"unaffected",label:string)=>item[kind].map((impact,i)=>{assertEvidenceBacked(impact.evidence,state);return <li key={`${kind}-${i}`} data-impact={kind} data-evidence-backed="true" data-evidence-ids={impact.evidence.join(" ")}><b>{label}</b>{impact.target}: {impact.reason}<EvidenceRefs ids={impact.evidence} state={state}/></li>})
  return <div key={id} className="impact"><h3>{item.change}</h3><ul className="impact-list">{impacts("affected","影響あり")}{impacts("unaffected","影響なし")}{item.requires_verification.map((impact,i)=><li key={`verify-${i}`} data-impact="verify"><b>要確認</b>{impact.target}: {impact.reason}</li>)}</ul></div>
})}</Figure>}
function CodeMap({section,state}:ViewProps) {
  const rows:{id:string; name:string; file:string; symbol:string; line?:number; evidence?:Evidence}[]=[]
  for(const id of section.sources){const source=state.sources.get(id)!; if(source.kind==="component") {const item=source.value as Component;for(const location of item.code_locations)rows.push({id,name:state.name(id),file:location.file,symbol:location.symbol||"",line:location.line})} else {const item=source.value as Evidence;rows.push({id,name:item.note||id,file:item.file||"",symbol:item.symbol||"",line:item.line,evidence:item})}}
  return <Figure question={section.question}><div className="table-wrap"><Table className="codemap"><TableHeader><TableRow><TableHead>要素</TableHead><TableHead>ファイル</TableHead><TableHead>シンボル</TableHead></TableRow></TableHeader><TableBody>{rows.map((row,i)=><TableRow key={`${row.id}-${i}`}><TableCell data-label="要素">{row.name}</TableCell><TableCell data-label="ファイル" className="src-file"><span className="code-ref" data-file={row.file||undefined} data-symbol={row.symbol} data-line={row.line}>{row.file?breakPath(row.file):"—"}{row.line?`:${row.line}`:""}</span></TableCell><TableCell data-label="シンボル" className="src-symbol">{row.symbol?breakSymbol(row.symbol):"—"}</TableCell></TableRow>)}</TableBody></Table></div></Figure>
}
function Unknowns({section,state}:ViewProps) {return <Figure question={section.question}>{section.sources.map(id=>{const item=state.get<Unknown>(id);return <div key={id} id={`unknown-${id}`} className="unknown-card"><div className="unknown-head"><span className="status" data-evidence="unknown"><i aria-hidden="true"/>不明</span><b>{item.question}</b></div><p>{item.reason}</p><p className="unknown-how"><b>解消方法</b>{item.how_to_resolve}</p></div>})}</Figure>}
function Callout({section,state,no}:ViewProps) {return <Figure question={section.question}>{section.sources.map(id=>{const source=state.sources.get(id)!
  if(source.kind==="invariant")return <InvariantCard key={id} item={source.value as Invariant} state={state} no={no}/>
  let text="",claim:Claim|undefined
  switch(source.kind){case "purpose":text=state.model.purpose.responsibility;claim=state.model.purpose;break;case "component":text=(source.value as Component).responsibility;claim=source.value as Component;break;case "decision":text=(source.value as Decision).decision;claim=source.value as Decision;break;case "change":text=(source.value as Change).after.behavior;claim=(source.value as Change).after;break;case "unknown":text=(source.value as Unknown).question;break;default:throw new Error(`unsupported callout source: ${id}`)}
  if(claim)checkClaim(claim,claim.id||id)
  return <div key={id} className="callout blueprint" data-evidence={claim?.status}><Corners/><p>{text}</p>{claim&&<><ClaimStatus claim={claim} state={state} about={claim.id||id}/><EvidenceRefs ids={claim.evidence} state={state}/></>}</div>})}</Figure>}

export function ArchitectureView({section,state,no}:ViewProps):React.ReactNode {
  switch(section.type){
    case "overview":return <Overview section={section} state={state} no={no}/>
    case "system_context":case "component_map":case "data_flow":return <GraphView section={section} state={state} no={no}/>
    case "sequence":case "runtime_flow":case "annotated_code":return <Runtime section={section} state={state} no={no}/>
    case "references":return <References section={section} state={state} no={no}/>
    case "state_transition":return <StateTransitions section={section} state={state} no={no}/>
    case "decision":return <Decisions section={section} state={state} no={no}/>
    case "before_after":return <BeforeAfter section={section} state={state} no={no}/>
    case "change_impact":return <ChangeImpact section={section} state={state} no={no}/>
    case "code_map":return <CodeMap section={section} state={state} no={no}/>
    case "known_unknowns":return <Unknowns section={section} state={state} no={no}/>
    case "callout":case "takeaway":return <Callout section={section} state={state} no={no}/>
    default: {const exhaustive:never=section;return exhaustive}
  }
}
