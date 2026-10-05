import type { ExplanationModel, ModelKind } from "./explanation-model"
import { sourceIndex } from "./explanation-model"

type BaseSection<T extends string> = { id: string; type: T; question: string; sources: string[]; density?: "comfortable" | "compact"; emphasis?: "normal" | "strong" }
export type OverviewSection = BaseSection<"overview">
export type ContextSection = BaseSection<"system_context">
export type ComponentMapSection = BaseSection<"component_map">
export type SequenceSection = BaseSection<"sequence" | "runtime_flow">
export type StateSection = BaseSection<"state_transition">
export type DataFlowSection = BaseSection<"data_flow">
export type DecisionSection = BaseSection<"decision">
export type BeforeAfterSection = BaseSection<"before_after">
export type ChangeImpactSection = BaseSection<"change_impact">
export type CodeMapSection = BaseSection<"code_map">
export type UnknownsSection = BaseSection<"known_unknowns">
export type CalloutSection = BaseSection<"callout" | "takeaway">
export type PresentationSection = OverviewSection | ContextSection | ComponentMapSection | SequenceSection | StateSection | DataFlowSection | DecisionSection | BeforeAfterSection | ChangeImpactSection | CodeMapSection | UnknownsSection | CalloutSection
export type Presentation = { version?: 1; title?: string; template: "doc"; theme: "technical" | "cards"; sections: PresentationSection[] }

const allowed: Record<ModelKind, Set<PresentationSection["type"]>> = {
  purpose: new Set(["overview", "callout", "takeaway"]), actor: new Set(["overview", "system_context"]), external: new Set(["overview", "system_context"]),
  component: new Set(["overview", "component_map", "code_map", "callout", "takeaway"]), scenario: new Set(["overview", "sequence", "runtime_flow"]),
  state: new Set(["state_transition"]), data: new Set(["data_flow"]), decision: new Set(["decision", "callout", "takeaway"]),
  invariant: new Set(["change_impact", "callout", "takeaway"]), change: new Set(["overview", "before_after", "change_impact", "callout", "takeaway"]),
  unknown: new Set(["known_unknowns", "callout", "takeaway"]), evidence: new Set(["code_map"])
}
export function checkPresentation(p: Presentation, model: ExplanationModel): void {
  const index = sourceIndex(model), seen = new Set<string>()
  if (!p.sections.length || p.sections[0].id !== "what" || p.sections[0].type !== "overview" || !p.sections[0].sources.includes("purpose")) throw new Error("first section must be overview 'what' and select purpose")
  for (const section of p.sections) {
    if (!/^[a-z][a-z0-9-]*$/.test(section.id) || seen.has(section.id)) throw new Error(`invalid or duplicate section ID: ${section.id}`)
    seen.add(section.id)
    if (!section.question.trim() || !section.sources.length || new Set(section.sources).size !== section.sources.length) throw new Error(`invalid question or sources: ${section.id}`)
    for (const id of section.sources) {
      const source = index.get(id)
      if (!source) throw new Error(`unknown model ID: ${id}`)
      if (!allowed[source.kind].has(section.type)) throw new Error(`${id} cannot be used in ${section.type}`)
    }
    if ((section.type === "sequence" || section.type === "runtime_flow") && section.sources.length !== 1) throw new Error(`${section.type} needs one scenario`)
    if (section.type === "component_map") {
      const levels = new Set(section.sources.map(id => (index.get(id)!.value as {level:string}).level))
      if (levels.size !== 1) throw new Error("component map mixes abstraction levels")
      for (const id of section.sources) for (const edge of (index.get(id)!.value as {depends_on:{target:string}[]}).depends_on) if (index.get(edge.target)?.kind !== "component") throw new Error(`unknown graph endpoint: ${edge.target}`)
    }
    if (section.type === "sequence" || section.type === "runtime_flow") {
      const scenario = index.get(section.sources[0])!.value as {steps:{from:string;to:string}[]}
      if (!scenario.steps.length) throw new Error(`${section.type} needs steps`)
      const bands=new Set<string>()
      for (const step of scenario.steps) {
        const pair=[step.from,step.to].map(endpoint=>{
          const participant=index.get(endpoint)
          if(!participant||!["actor","external","component"].includes(participant.kind))throw new Error(`unknown scenario endpoint: ${endpoint}`)
          return participant.kind==="component"?(participant.value as {level:string}).level:participant.kind
        })
        const hierarchy=new Set(pair.filter(level=>level!=="actor"&&level!=="external"))
        if(hierarchy.size!==1||[...hierarchy].some(level=>!["system","container","module","class","function"].includes(level)))throw new Error(`incompatible runtime participants: ${pair.join(" ↔ ")}`)
        const band=[...hierarchy][0]
        if(pair.some(level=>level==="actor"||level==="external")&&!new Set(["system","container"]).has(band))throw new Error(`incompatible runtime participants: ${pair.join(" ↔ ")}`)
        bands.add(band)
      }
      if(bands.size>1)throw new Error("one scenario mixes interaction levels")
    }
    if(section.type==="data_flow"){
      for(const id of section.sources){const item=index.get(id)!.value as {written_by:string[];read_by:string[]};for(const endpoint of [...item.written_by,...item.read_by])if(index.get(endpoint)?.kind!=="component")throw new Error(`unknown data flow endpoint: ${endpoint}`)}
    }
  }
  if (p.sections[0].sources.filter(id => ["actor", "external", "component"].includes(index.get(id)!.kind)).length > 3) throw new Error("first view may select at most three nodes")
}
