import React from "react"
import type { Claim, Evidence, ExplanationModel, ModelSource, Status } from "../../domain/explanation-model"
import { sourceIndex } from "../../domain/explanation-model"
import { statuses } from "../../domain/evidence"
import type { GraphLayout } from "../../renderer/layout/graph"
import type { Excerpt } from "../../renderer/source"

export class RenderState {
  readonly sources: Map<string,ModelSource>
  readonly evidence: Map<string,Evidence>
  readonly glossary: Map<string,ExplanationModel["glossary"][number]>
  private mentioned = new Set<string>()
  private shown = new Map<string,string>()
  private ids = new Map<string,number>()
  constructor(readonly model: ExplanationModel, private readonly layouts = new Map<string,GraphLayout>(), private readonly excerpts = new Map<string,Excerpt>(), private readonly codeBlocks: ReadonlySet<string> = new Set()) {
    this.sources = sourceIndex(model)
    this.evidence = new Map(model.evidence.map(item => [item.id,item]))
    this.glossary = new Map(model.glossary.map(item => [item.concept,item]))
  }
  excerpt(evidenceId:string):Excerpt|undefined { return this.excerpts.get(evidenceId) }
  shownAt(evidenceId:string):string|undefined { return this.shown.get(evidenceId) }
  markShown(evidenceId:string,where:string):void { this.shown.set(evidenceId,where) }
  shownIds():Set<string> { return new Set(this.shown.keys()) }
  hasCodeBlock(evidenceId:string):boolean { return this.codeBlocks.has(evidenceId) }
  private peeks=0
  peekId(evidenceId:string):string { this.peeks++; const prefix=`peek-${evidenceId}`, n=(this.ids.get(prefix)??0)+1; this.ids.set(prefix,n); return `${prefix}-${n}` }
  hasPeeks():boolean { return this.peeks>0 }
  layout(sectionId:string):GraphLayout { const layout=this.layouts.get(sectionId); if (!layout) throw new Error(`graph section ${sectionId} has no layout`); return layout }
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

export function checkClaim(claim:Claim,about?:string):void {
  if (!statuses[claim.status]) throw new Error(`invalid claim status: ${about}`)
  if (claim.status!=="unknown" && !claim.evidence.length) throw new Error(`${about} has no evidence`)
  if (claim.status==="unknown" && claim.evidence.length) throw new Error(`${about} is unknown but has evidence`)
}
// Observed claims stay unlabelled on purpose: a label on every card is noise, so only inferred and unknown are marked.
export function StatusLabel({status}:{status:Status}) {
  if (status==="observed") return null
  return <span className="status" data-evidence={status}><i aria-hidden="true"/>{statuses[status]}</span>
}
export function ClaimStatus({claim,state,about}:{claim:Claim;state:RenderState;about?:string}) {
  checkClaim(claim,about)
  const unknown=state.model.unknowns.find(item=>item.about===(about || claim.id))
  if (claim.status==="observed" && !unknown) return null
  return <span className="claim-status"><StatusLabel status={claim.status}/>{unknown&&<a className="resolve-link" href={`#unknown-${unknown.id}`}>解消方法を見る</a>}</span>
}
export function Figure({question,caption,children}:{question:string;caption?:string;children:React.ReactNode}) { return <figure className="view" data-question={question}>{children}<figcaption>{caption || question}</figcaption></figure> }
export function assertEvidenceBacked(evidence:string[],state:RenderState):void {
  if(!evidence.length||evidence.some(id=>!state.evidence.has(id)))throw new Error("structural item needs resolvable evidence")
}
