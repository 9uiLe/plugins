import type { Claim, ExplanationModel, Status } from "./explanation-model"
import { sourceIndex } from "./explanation-model"

export type Issue = { code: string; message: string; line?: number }
export type Findings = { errors: Issue[]; warnings: Issue[]; hints: Issue[] }
export const statuses: Record<Status, string> = { observed: "確認済み", inferred: "推論", unknown: "不明" }
export function emptyFindings(): Findings { return { errors: [], warnings: [], hints: [] } }
export function checkModel(model: ExplanationModel): Findings {
  const result = emptyFindings(), evidence = new Map(model.evidence.map(item => [item.id, item])), unknowns = new Set(model.unknowns.map(item => item.about))
  let index: ReturnType<typeof sourceIndex>
  try { index = sourceIndex(model) } catch (error) { result.errors.push({ code:"model-id", message:String(error) }); return result }
  const claim = (item: Claim, id: string, revision?: string, change=false) => {
    const evidenceCode=change?"change-evidence":"claim-evidence"
    if (item.status === "unknown") {
      if (item.evidence.length) result.errors.push({code:change?"change-evidence":"unknown-evidence",message:`${id} is unknown but carries evidence`})
      if (!unknowns.has(id)) result.errors.push({code:change?"change-evidence":"unknown-link",message:`${id} needs unknowns.about`})
    } else {
      if (!item.evidence.length || item.evidence.some(ref => !evidence.has(ref))) result.errors.push({code:evidenceCode,message:`${id} needs resolvable evidence IDs`})
      if (change && (!revision || !item.evidence.some(ref => evidence.get(ref)?.revision === revision))) result.errors.push({code:"change-evidence",message:`${id} needs evidence from ${revision||"its source revision"}`})
    }
  }
  claim(model.purpose,"purpose")
  for (const item of [...model.context.actors,...model.context.external_systems,...model.components,...model.invariants]) claim(item,item.id)
  for (const item of model.runtime_scenarios) {
    for (const [i, step] of item.steps.entries()) claim(step,`${item.id}.step.${i}`)
    for (const [i, path] of item.exceptional_paths.entries()) claim(path,`${item.id}.exception.${i}`)
  }
  for (const item of model.decisions) { claim(item,item.id); claim(item.rationale,item.rationale.status === "unknown" ? item.id : `${item.id}.rationale`) }
  for (const item of model.change_impacts) {
    if (item.before.status !== "unknown" && item.after.status !== "unknown" && model.source.base_revision === model.source.revision) result.errors.push({code:"change-evidence",message:`${item.id} needs distinct revisions`})
    claim(item.before,item.before.id,model.source.base_revision,true)
    claim(item.after,item.after.id,model.source.revision,true)
    for (const impact of [...item.affected,...item.unaffected]) if (!impact.evidence.length || impact.evidence.some(ref => !evidence.has(ref))) result.errors.push({code:"change-evidence",message:`${item.id} impact ${impact.target} needs evidence`})
  }
  for (const item of model.unknowns) if (!index.has(item.about) && !model.change_impacts.some(change => change.before.id === item.about || change.after.id === item.about)) result.errors.push({code:"unknown-link",message:`${item.id} points to missing claim ${item.about}`})
  const terms=new Map<string,string>(),glossary=new Map(model.glossary.map(item=>[item.concept,item]))
  for (const item of model.glossary){
    if (!index.has(item.concept)) result.errors.push({code:"glossary-concept",message:`${item.concept} is missing`})
    for(const term of [item.preferred,...item.code_terms,...item.aliases])if(term){const owner=terms.get(term);if(owner&&owner!==item.concept)result.errors.push({code:"glossary-collision",message:`${term} names ${owner} and ${item.concept}`});terms.set(term,item.concept)}
  }
  for(const entity of [...model.components,...model.context.actors,...model.context.external_systems,...model.data]){
    const entry=glossary.get(entity.id)
    if(entry&&!new Set([entry.preferred,...entry.code_terms,...entry.aliases]).has(entity.name))result.errors.push({code:"model-terminology",message:`${entity.name} is not mapped for ${entity.id}`})
  }
  for(const item of model.components)for(const edge of item.depends_on)if(index.get(edge.target)?.kind!=="component")result.errors.push({code:"model-endpoint",message:`${item.id} depends on missing component ${edge.target}`})
  for(const item of model.context.actors)if(!item.role.trim())result.errors.push({code:"model-label",message:`${item.id} needs actor.role`})
  for(const item of model.context.external_systems)if(!item.interaction.trim())result.errors.push({code:"model-label",message:`${item.id} needs external.interaction`})
  for(const item of model.components)for(const edge of item.depends_on)if(!edge.meaning.trim())result.errors.push({code:"model-label",message:`${item.id} → ${edge.target} needs depends_on.meaning`})
  for(const item of model.runtime_scenarios)for(const step of item.steps)if(!step.action.trim())result.errors.push({code:"model-label",message:`${item.id} needs step.action`})
  for(const item of model.data){
    if(!item.evidence.length||item.evidence.some(id=>!evidence.has(id)))result.errors.push({code:"claim-evidence",message:`${item.id} needs resolvable evidence IDs`})
    for(const id of [...item.written_by,...item.read_by])if(index.get(id)?.kind!=="component")result.errors.push({code:"model-endpoint",message:`${item.id} has missing component ${id}`})
  }
  for(const item of model.states)for(const transition of item.transitions)if(!transition.evidence.length||transition.evidence.some(id=>!evidence.has(id)))result.errors.push({code:"claim-evidence",message:`${item.id} transition needs resolvable evidence IDs`})
  for(const item of model.context.boundaries)for(const id of item.contains)if(!index.has(id))result.errors.push({code:"model-endpoint",message:`${item.id} contains missing model ID ${id}`})
  return result
}
export function assertModel(model: ExplanationModel): void {
  const result = checkModel(model)
  if (result.errors.length) throw new Error(result.errors.map(issue => `${issue.code}: ${issue.message}`).join("\n"))
}
