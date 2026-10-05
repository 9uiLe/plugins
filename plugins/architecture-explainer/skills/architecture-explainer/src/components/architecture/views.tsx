import React from "react"
import type { Change, Component, Decision, Entity, Evidence, Invariant, Scenario, State, Unknown, Claim } from "../../domain/explanation-model"
import type { PresentationSection } from "../../domain/presentation"
import { Alert, AlertDescription, AlertTitle } from "../ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Separator } from "../ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { ArchitectureGraph } from "./graph"
import { CodeReference, EvidenceBadge, Figure, RenderState } from "./common"
import { graphData } from "./graph-data"

type ViewProps = { section:PresentationSection; state:RenderState }
function ClaimCard({title,description,claim,state,concept}:{title:React.ReactNode;description?:string;claim:Claim;state:RenderState;concept?:string}) {
  return <Card className="node gap-3 py-4" data-kind={concept?"component":"claim"} data-evidence={claim.status}><CardHeader className="gap-1 px-4"><CardTitle>{title}</CardTitle>{description && <CardDescription data-responsibility={concept ? "true":undefined}>{description}</CardDescription>}</CardHeader><CardContent className="px-4"><EvidenceBadge claim={claim} state={state} about={concept}/></CardContent></Card>
}
function Overview({section,state}:ViewProps) {
  const purpose=state.model.purpose
  const selections=section.sources.filter(id=>id!=="purpose")
  return <><p className="lede">{purpose.problem}</p><p>{purpose.responsibility} <EvidenceBadge claim={purpose} state={state} about="purpose"/></p>
    <Figure question={section.question}><div className="cards">{selections.map(id=>{
      const entry=state.sources.get(id)!
      if (entry.kind==="component") {const item=entry.value as Component; return <ClaimCard key={id} title={state.term(id)} description={item.responsibility} claim={item} state={state} concept={id}/>}
      if (entry.kind==="actor" || entry.kind==="external") {const item=entry.value as Entity; return <ClaimCard key={id} title={state.term(id)} description={item.role || item.interaction} claim={item} state={state} concept={id}/>}
      if (entry.kind==="scenario") {const item=entry.value as Scenario; return <Card key={id} className="node gap-2 py-4"><CardHeader className="px-4"><CardTitle>{item.name}</CardTitle><CardDescription>{item.trigger}</CardDescription></CardHeader><CardContent className="px-4">{item.steps.length} ステップ</CardContent></Card>}
      if (entry.kind==="change") {const item=entry.value as Change; return <ClaimCard key={id} title={item.change} description={item.after.behavior} claim={item.after} state={state} concept={item.after.id}/>}
      return null
    })}</div></Figure><div className="takeaway"><strong>要点</strong><p>{purpose.responsibility}</p></div></>
}
function GraphView({section,state}:ViewProps) {
  if(section.type!=="system_context"&&section.type!=="component_map"&&section.type!=="data_flow")throw new Error(`unsupported graph section: ${section.type}`)
  const {nodes,edges}=graphData(section,state)
  const kinds=new Set(nodes.map(node=>node.kind))
  return <Figure question={section.question}><ArchitectureGraph id={section.id} question={section.question} caption={section.question} nodes={nodes} edges={edges}/>{kinds.size>1&&<p className="legend">凡例: {[...kinds].map(kind=>({system:"対象",component:"構成要素",actor:"利用者",external:"外部",data:"データ"})[kind]).join(" · ")}</p>}{section.type==="system_context"&&state.model.context.boundaries.length>0&&<div className="boundaries"><h3>境界</h3><ul>{state.model.context.boundaries.map(boundary=><li key={boundary.id} data-kind="boundary"><strong>{boundary.kind}</strong>: {boundary.contains.map(id=>state.glossary.get(id)?.preferred||id).join("、")}</li>)}</ul></div>}<ul>{nodes.filter(node=>node.evidence?.length).map(node=><li key={node.id}>{state.term(node.id)} <EvidenceBadge claim={{status:node.status||"observed",evidence:node.evidence||[]}} state={state} about={node.id}/></li>)}</ul></Figure>
}
function Runtime({section,state}:ViewProps) {
  const scenario=state.get<Scenario>(section.sources[0])
  return <Figure question={section.question}><p>{scenario.trigger}</p><ol>{scenario.steps.map((step,i)=><li className="step" key={i}><strong>{state.term(step.from)} → {state.term(step.to)}</strong><p>{step.action}</p><EvidenceBadge claim={step} state={state} about={`${scenario.id}.step.${i}`}/></li>)}</ol>
    {scenario.exceptional_paths.length>0 && <div><h3>例外経路</h3>{scenario.exceptional_paths.map((path,i)=><Alert key={i} className="mb-2"><AlertTitle>ステップ {path.at_step}: {path.condition}</AlertTitle><AlertDescription>{path.result} <EvidenceBadge claim={path} state={state} about={`${scenario.id}.exception.${i}`}/></AlertDescription></Alert>)}</div>}</Figure>
}
function StateTransitions({section,state}:ViewProps) {return <Figure question={section.question}><div className="table-wrap"><Table><TableHeader><TableRow><TableHead>状態</TableHead><TableHead>イベント</TableHead><TableHead>条件</TableHead><TableHead>遷移先</TableHead><TableHead>根拠</TableHead></TableRow></TableHeader><TableBody>{section.sources.flatMap(id=>{const item=state.get<State>(id);return item.transitions.map((transition,i)=><TableRow key={`${id}-${i}`}><TableCell data-label="状態">{item.name}</TableCell><TableCell data-label="イベント">{transition.event}</TableCell><TableCell data-label="条件">{transition.guard}</TableCell><TableCell data-label="遷移先">{transition.to}</TableCell><TableCell data-label="根拠"><EvidenceBadge claim={{status:"observed",evidence:transition.evidence}} state={state} about={`${id}.transition.${i}`}/></TableCell></TableRow>)})}</TableBody></Table></div></Figure>}
function Decisions({section,state}:ViewProps) {return <Figure question={section.question}><div className="cards">{section.sources.map(id=>{const item=state.get<Decision>(id); return <Card key={id} className="gap-3 py-4"><CardHeader className="px-4"><CardTitle>{item.decision}</CardTitle><CardDescription>{item.context}</CardDescription></CardHeader><CardContent className="px-4"><EvidenceBadge claim={item} state={state} about={id}/><Separator/><p>{item.rationale.text}</p><EvidenceBadge claim={item.rationale} state={state} about={id}/>{item.tradeoffs.length>0 && <><h3>トレードオフ</h3><ul>{item.tradeoffs.map((text,i)=><li key={i}>{text}</li>)}</ul></>}{item.alternatives.length>0 && <><h3>代替案</h3><ul>{item.alternatives.map((text,i)=><li key={i}>{text}</li>)}</ul></>}</CardContent></Card>})}</div></Figure>}
function BeforeAfter({section,state}:ViewProps) {return <Figure question={section.question}><div className="cards">{section.sources.map(id=>{const item=state.get<Change>(id);return <React.Fragment key={id}><ClaimCard title="変更前" description={item.before.behavior} claim={item.before} state={state} concept={item.before.id}/><ClaimCard title="変更後" description={item.after.behavior} claim={item.after} state={state} concept={item.after.id}/></React.Fragment>})}</div></Figure>}
function ChangeImpact({section,state}:ViewProps) {return <Figure question={section.question}>{section.sources.map(id=>{
  const source=state.sources.get(id)!
  if(source.kind==="invariant") {const item=source.value as Invariant;return <Alert key={id} className="mb-3"><AlertTitle>不変条件: {item.description}</AlertTitle><AlertDescription>{item.enforced_by} <EvidenceBadge claim={item} state={state} about={id}/></AlertDescription></Alert>}
  const item=source.value as Change
  return <div key={id}><h3>{item.change}</h3><div className="cards"><Alert><AlertTitle>影響あり</AlertTitle><AlertDescription><ul>{item.affected.map((impact,i)=><li key={i} data-impact="affected">{impact.target}: {impact.reason} <EvidenceBadge claim={{status:"observed",evidence:impact.evidence}} state={state} about={`${id}.affected.${i}`}/></li>)}</ul></AlertDescription></Alert><Alert><AlertTitle>影響なし</AlertTitle><AlertDescription><ul>{item.unaffected.map((impact,i)=><li key={i} data-impact="unaffected">{impact.target}: {impact.reason} <EvidenceBadge claim={{status:"observed",evidence:impact.evidence}} state={state} about={`${id}.unaffected.${i}`}/></li>)}</ul></AlertDescription></Alert><Alert><AlertTitle>要確認</AlertTitle><AlertDescription><ul>{item.requires_verification.map((impact,i)=><li key={i} data-impact="verify">{impact.target}: {impact.reason}</li>)}</ul></AlertDescription></Alert></div></div>
})}</Figure>}
function CodeMap({section,state}:ViewProps) {
  const rows:{id:string; name:string; file:string; symbol:string; line?:number; evidence?:Evidence}[]=[]
  for(const id of section.sources){const source=state.sources.get(id)!; if(source.kind==="component") {const item=source.value as Component;for(const location of item.code_locations)rows.push({id,name:state.name(id),file:location.file,symbol:location.symbol||"",line:location.line})} else {const item=source.value as Evidence;rows.push({id,name:item.note||id,file:item.file||"",symbol:item.symbol||"",line:item.line,evidence:item})}}
  return <Figure question={section.question}><div className="table-wrap"><Table className="codemap"><TableHeader><TableRow><TableHead>要素</TableHead><TableHead>ファイル</TableHead><TableHead>シンボル</TableHead><TableHead>根拠</TableHead></TableRow></TableHeader><TableBody>{rows.map((row,i)=><TableRow key={`${row.id}-${i}`}><TableCell data-label="要素">{row.name}</TableCell><TableCell data-label="ファイル" className="src-file">{breakPath(row.file)}</TableCell><TableCell data-label="シンボル" className="src-symbol">{breakSymbol(row.symbol)}</TableCell><TableCell data-label="根拠">{row.evidence?<CodeReference item={row.evidence}/>:<span className="code-ref" data-file={row.file} data-symbol={row.symbol} data-line={row.line}>{row.file}:{row.line}</span>}</TableCell></TableRow>)}</TableBody></Table></div></Figure>
}
function breakPath(value:string){return value.split("/").map((part,i)=><React.Fragment key={i}>{i>0 && <>/<wbr/></>}{part}</React.Fragment>)}
function breakSymbol(value:string){return value.split(/([._])/).map((part,i)=><React.Fragment key={i}>{part}{/[._]/.test(part)&&<wbr/>}</React.Fragment>)}
function Unknowns({section,state}:ViewProps) {return <Figure question={section.question}><div className="cards">{section.sources.map(id=>{const item=state.get<Unknown>(id);return <Alert key={id}><AlertTitle>{item.question}</AlertTitle><AlertDescription><p>{item.reason}</p><p>解消方法: {item.how_to_resolve}</p></AlertDescription></Alert>})}</div></Figure>}
function Callout({section,state}:ViewProps) {return <Figure question={section.question}>{section.sources.map(id=>{const source=state.sources.get(id)!;let text="",claim:Claim|undefined
  switch(source.kind){case "purpose":text=state.model.purpose.responsibility;claim=state.model.purpose;break;case "component":text=(source.value as Component).responsibility;claim=source.value as Component;break;case "decision":text=(source.value as Decision).decision;claim=source.value as Decision;break;case "invariant":text=(source.value as Invariant).description;claim=source.value as Invariant;break;case "change":text=(source.value as Change).after.behavior;claim=(source.value as Change).after;break;case "unknown":text=(source.value as Unknown).question;break;default:throw new Error(`unsupported callout source: ${id}`)}
  return <Alert key={id} className="mb-3"><AlertTitle>{text}</AlertTitle>{claim&&<AlertDescription><EvidenceBadge claim={claim} state={state} about={claim.id||id}/></AlertDescription>}</Alert>})}</Figure>}

export function ArchitectureView({section,state}:ViewProps):React.ReactNode {
  switch(section.type){
    case "overview":return <Overview section={section} state={state}/>
    case "system_context":case "component_map":case "data_flow":return <GraphView section={section} state={state}/>
    case "sequence":case "runtime_flow":return <Runtime section={section} state={state}/>
    case "state_transition":return <StateTransitions section={section} state={state}/>
    case "decision":return <Decisions section={section} state={state}/>
    case "before_after":return <BeforeAfter section={section} state={state}/>
    case "change_impact":return <ChangeImpact section={section} state={state}/>
    case "code_map":return <CodeMap section={section} state={state}/>
    case "known_unknowns":return <Unknowns section={section} state={state}/>
    case "callout":case "takeaway":return <Callout section={section} state={state}/>
    default: {const exhaustive:never=section;return exhaustive}
  }
}
