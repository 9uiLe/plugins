import React from "react"
import type { Claim, Evidence, ExplanationModel, ModelSource, Status } from "../../domain/explanation-model"
import { sourceIndex } from "../../domain/explanation-model"
import { statuses } from "../../domain/evidence"
import { Badge } from "../ui/badge"

export class RenderState {
  readonly sources: Map<string,ModelSource>
  readonly evidence: Map<string,Evidence>
  readonly glossary: Map<string,ExplanationModel["glossary"][number]>
  private mentioned = new Set<string>()
  constructor(readonly model: ExplanationModel) {
    this.sources = sourceIndex(model)
    this.evidence = new Map(model.evidence.map(item => [item.id,item]))
    this.glossary = new Map(model.glossary.map(item => [item.concept,item]))
  }
  get<T>(id:string):T { const value = this.sources.get(id)?.value; if (!value) throw new Error(`unknown source: ${id}`); return value as T }
  name(id:string):string { const entry=this.glossary.get(id); if (!entry) throw new Error(`displayed concept has no glossary entry: ${id}`); return entry.preferred }
  term(id:string):React.ReactNode {
    const entry=this.glossary.get(id); if (!entry) throw new Error(`displayed concept has no glossary entry: ${id}`)
    const first=!this.mentioned.has(id); this.mentioned.add(id)
    return <><span data-concept={id}>{entry.preferred}</span>{first && entry.code_terms[0] && entry.code_terms[0]!==entry.preferred ? <>（<span data-concept={id}><code>{entry.code_terms[0]}</code></span>）</> : null}</>
  }
}
export function breakPath(value:string){return value.split("/").map((part,i)=><React.Fragment key={i}>{i>0 && <>/<wbr/></>}{part}</React.Fragment>)}
export function breakSymbol(value:string){return value.split(/([._])/).map((part,i)=><React.Fragment key={i}>{part}{/[._]/.test(part)&&<wbr/>}</React.Fragment>)}
export function CodeReference({item}:{item:Evidence}) {
  if (!item.file) return <a className="code-ref" href={`#source-${item.id}`}>根拠 {item.id}</a>
  return <a className="code-ref" href={`#source-${item.id}`} data-file={item.file} data-symbol={item.symbol || ""} data-line={item.line || undefined}><code>{breakPath(item.file)}{item.line ? `:${item.line}`:""}</code>{item.symbol&&<> · <code>{breakSymbol(item.symbol)}</code></>}</a>
}
export function EvidenceBadge({claim, state, about}:{claim:Claim;state:RenderState;about?:string}) {
  if (!statuses[claim.status]) throw new Error(`invalid claim status: ${about}`)
  if (claim.status!=="unknown" && !claim.evidence.length) throw new Error(`${about} has no evidence`)
  if (claim.status==="unknown" && claim.evidence.length) throw new Error(`${about} is unknown but has evidence`)
  const unknown=state.model.unknowns.find(item=>item.about===(about || claim.id))
  return <span className="evidence-line"><Badge className="status" data-evidence={claim.status}>{statuses[claim.status]}</Badge>{claim.evidence.map(id=>{const item=state.evidence.get(id); if(!item) throw new Error(`unresolved evidence: ${id}`); return <CodeReference key={id} item={item}/>})}{unknown && <a className="code-ref" href={`#unknown-${unknown.id}`}>解消方法</a>}</span>
}
export function Figure({question,caption,children}:{question:string;caption?:string;children:React.ReactNode}) { return <figure className="view" data-question={question}>{children}<figcaption>{caption || question}</figcaption></figure> }
export function assertEvidenceBacked(evidence:string[],state:RenderState):void {
  if(!evidence.length||evidence.some(id=>!state.evidence.has(id)))throw new Error("structural item needs resolvable evidence")
}
export function EvidenceMarker({evidence,state}:{evidence:string[];state:RenderState}) {
  assertEvidenceBacked(evidence,state)
  return <span className="evidence-line evidence-marker" data-evidence-backed="true" data-evidence-ids={evidence.join(" ")}><Badge>根拠あり</Badge>{evidence.map(id=><CodeReference key={id} item={state.evidence.get(id)!}/>)}</span>
}
