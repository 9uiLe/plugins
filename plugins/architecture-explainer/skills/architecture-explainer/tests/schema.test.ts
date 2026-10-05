import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import modelSchema from "../schemas/explanation-model.schema.json"
import presentationSchema from "../schemas/presentation.schema.json"
import type { BoundaryKind, Component, Evidence, ExplanationModel, Status } from "../src/domain/explanation-model"
import type { Presentation, PresentationSection } from "../src/domain/presentation"
import { checkModel } from "../src/domain/evidence"
import { checkPresentation } from "../src/domain/presentation"
import { parseModel, parsePresentation } from "../src/domain/schema"
import { render } from "../src/renderer/render"
import { validateHtml } from "../src/validator/validate"

type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false
type Assert<T extends true>=T
const statuses=["observed","inferred","unknown"] as const satisfies readonly Status[]
const levels=["system","container","module","class","function"] as const satisfies readonly Component["level"][]
const boundaryKinds=["app","module","process","data","external","trust"] as const satisfies readonly BoundaryKind[]
const evidenceKinds=["code","test","doc","config","commit","diff","issue"] as const satisfies readonly Evidence["kind"][]
const audiences=["newcomer","implementer","reviewer","architect","debugger"] as const satisfies readonly ExplanationModel["audience"]["profile"][]
const themes=["technical","cards"] as const satisfies readonly Presentation["theme"][]
const sectionTypes=["overview","system_context","component_map","sequence","runtime_flow","state_transition","data_flow","decision","before_after","change_impact","code_map","known_unknowns","callout","takeaway"] as const satisfies readonly PresentationSection["type"][]
const completeCoverage:[Assert<Equal<Status,typeof statuses[number]>>,Assert<Equal<Component["level"],typeof levels[number]>>,Assert<Equal<BoundaryKind,typeof boundaryKinds[number]>>,Assert<Equal<Evidence["kind"],typeof evidenceKinds[number]>>,Assert<Equal<ExplanationModel["audience"]["profile"],typeof audiences[number]>>,Assert<Equal<Presentation["theme"],typeof themes[number]>>,Assert<Equal<PresentationSection["type"],typeof sectionTypes[number]>>]=[true,true,true,true,true,true,true]
void completeCoverage

const fixtures=resolve(import.meta.dir,"../../../tests/fixtures/presentation")
const rawModel=JSON.parse(readFileSync(resolve(fixtures,"auth-model.json"),"utf8"))
const rawPresentation=JSON.parse(readFileSync(resolve(fixtures,"auth-presentation.json"),"utf8"))

test("schema enum values match complete TypeScript domain unions",()=>{
  expect(modelSchema.definitions.status.enum).toEqual([...statuses])
  expect(modelSchema.properties.components.items.properties.level.enum).toEqual([...levels])
  expect(modelSchema.properties.evidence.items.properties.kind.enum).toEqual([...evidenceKinds])
  expect(modelSchema.properties.audience.properties.profile.enum).toEqual([...audiences])
  expect(modelSchema.properties.context.properties.boundaries.items.properties.kind.enum).toEqual([...boundaryKinds])
  expect(presentationSchema.properties.theme.enum).toEqual([...themes])
  expect(Object.keys(presentationSchema.definitions).filter(key=>key!=="section")).toEqual([...sectionTypes])
})
test("all model object schemas reject accidental properties",()=>{
  function walk(value:unknown):void {
    if(!value||typeof value!=="object")return
    if(Array.isArray(value)){for(const item of value)walk(item);return}
    const object=value as Record<string,unknown>
    if(object.type==="object")expect(object.additionalProperties).toBe(false)
    for(const child of Object.values(object))walk(child)
  }
  walk(modelSchema)
})
test("representative JSON passes schema, semantic checks, renderer and HTML validator",()=>{
  const model=parseModel(rawModel),presentation=parsePresentation(rawPresentation)
  expect(checkModel(model).errors).toEqual([])
  expect(()=>checkPresentation(presentation,model)).not.toThrow()
  const html=render(model,presentation)
  const sourceRoot=resolve(fixtures,"../auth-service/1-feature")
  expect(validateHtml(html,{model,sourceRoot}).errors).toEqual([])
})
test("schema permits declared optional fields",()=>{
  const model=structuredClone(rawModel)
  model.source.base_revision="previous"
  model.audience.inferred_from="reader interview"
  model.evidence[0].note="source note"
  expect(()=>parseModel(model)).not.toThrow()
  const presentation=structuredClone(rawPresentation)
  presentation.version=1
  presentation.title="認証"
  presentation.sections[0].density="comfortable"
  presentation.sections[0].emphasis="strong"
  expect(()=>parsePresentation(presentation)).not.toThrow()
})
test("nested typos and status on non-Claim structures are rejected",()=>{
  const mutations:Record<string,(model:any)=>void>={
    source:model=>{model.source.revison="typo"},
    audience:model=>{model.audience.profiel="reviewer"},
    component:model=>{model.components[0].statuz="observed"},
    runtimeStep:model=>{model.runtime_scenarios[0].steps[0].statuz="observed"},
    transition:model=>{model.states[0].transitions[0].statuz="observed"},
    data:model=>{model.data[0].storedInto="store"},
    rationale:model=>{model.decisions[0].rationale.statuz="unknown"},
    changeImpact:model=>{model.change_impacts[0].affected[0].statuz="observed"},
    glossary:model=>{model.glossary[0].preffered="認証"},
    evidence:model=>{model.evidence[0].statuz="observed"},
    dataStatus:model=>{model.data[0].status="observed"},
    stateStatus:model=>{model.states[0].status="observed"}
  }
  for(const mutate of Object.values(mutations)){
    const model=structuredClone(rawModel);mutate(model)
    expect(()=>parseModel(model)).toThrow("schema")
  }
})
test("presentation type is the strict section discriminator",()=>{
  const section=rawPresentation.sections[0]
  const withSection=(value:unknown)=>({...rawPresentation,sections:[value]})
  expect(()=>parsePresentation(withSection({...section,type:"sequence"}))).not.toThrow()
  expect(()=>parsePresentation(withSection({...section,type:"runtime_flow"}))).not.toThrow()
  expect(()=>parsePresentation(withSection({...section,type:"invented"}))).toThrow("schema")
  expect(()=>parsePresentation(withSection({...section,view:"overview"}))).toThrow("schema")
  expect(()=>parsePresentation(withSection({...section,type:undefined}))).toThrow("schema")
  expect(()=>parsePresentation(withSection({...section,extra:"typo"}))).toThrow("schema")
})
test("required graph and runtime labels cannot be empty",()=>{
  const mutate=(change:(model:any)=>void)=>{const model=structuredClone(rawModel);change(model);expect(()=>parseModel(model)).toThrow("schema")}
  mutate(model=>{model.context.actors[0].role=""})
  mutate(model=>{model.components[1].depends_on[0].meaning=""})
  mutate(model=>{model.runtime_scenarios[0].steps[0].action=""})
  const model=structuredClone(rawModel)
  model.context.external_systems=[{id:"external",name:"外部",interaction:"",status:"observed",evidence:["ev-client"]}]
  expect(()=>parseModel(model)).toThrow("schema")
})
test("whitespace-only graph and runtime labels fail semantic checks",()=>{
  const mutations=[
    (model:any)=>{model.context.actors[0].role=" "},
    (model:any)=>{model.context.external_systems=[{id:"external",name:"外部",interaction:" ",status:"observed",evidence:["ev-client"]}]},
    (model:any)=>{model.components[1].depends_on[0].meaning=" "},
    (model:any)=>{model.runtime_scenarios[0].steps[0].action=" "}
  ]
  for(const mutate of mutations){const input=structuredClone(rawModel);mutate(input);expect(checkModel(parseModel(input)).errors.map(issue=>issue.code)).toContain("model-label")}
})
