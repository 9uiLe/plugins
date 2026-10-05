import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import modelSchema from "../schemas/explanation-model.schema.json"
import presentationSchema from "../schemas/presentation.schema.json"
import type { Component, Evidence, ExplanationModel, Status } from "../src/domain/explanation-model"
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
const evidenceKinds=["code","test","doc","config","commit","diff","issue"] as const satisfies readonly Evidence["kind"][]
const audiences=["newcomer","implementer","reviewer","architect","debugger"] as const satisfies readonly ExplanationModel["audience"]["profile"][]
const themes=["technical","cards"] as const satisfies readonly Presentation["theme"][]
const sectionTypes=["overview","system_context","component_map","sequence","runtime_flow","state_transition","data_flow","decision","before_after","change_impact","code_map","known_unknowns","callout","takeaway"] as const satisfies readonly PresentationSection["type"][]
const completeCoverage:[Assert<Equal<Status,typeof statuses[number]>>,Assert<Equal<Component["level"],typeof levels[number]>>,Assert<Equal<Evidence["kind"],typeof evidenceKinds[number]>>,Assert<Equal<ExplanationModel["audience"]["profile"],typeof audiences[number]>>,Assert<Equal<Presentation["theme"],typeof themes[number]>>,Assert<Equal<PresentationSection["type"],typeof sectionTypes[number]>>]=[true,true,true,true,true,true]
void completeCoverage

const fixtures=resolve(import.meta.dir,"../../../tests/fixtures/presentation")
const rawModel=JSON.parse(readFileSync(resolve(fixtures,"auth-model.json"),"utf8"))
const rawPresentation=JSON.parse(readFileSync(resolve(fixtures,"auth-presentation.json"),"utf8"))

test("schema enum values match complete TypeScript domain unions",()=>{
  expect(modelSchema.definitions.status.enum).toEqual([...statuses])
  expect(modelSchema.properties.components.items.properties.level.enum).toEqual([...levels])
  expect(modelSchema.properties.evidence.items.properties.kind.enum).toEqual([...evidenceKinds])
  expect(modelSchema.properties.audience.properties.profile.enum).toEqual([...audiences])
  expect(presentationSchema.properties.theme.enum).toEqual([...themes])
  expect(Object.keys(presentationSchema.definitions).filter(key=>key!=="section")).toEqual([...sectionTypes])
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
  model.states[0].status="observed"
  model.evidence[0].note="source note"
  expect(()=>parseModel(model)).not.toThrow()
  const presentation=structuredClone(rawPresentation)
  presentation.version=1
  presentation.title="認証"
  presentation.sections[0].density="comfortable"
  presentation.sections[0].emphasis="strong"
  expect(()=>parsePresentation(presentation)).not.toThrow()
})
test("nested typos and DataItem.status are rejected",()=>{
  const mutations=[
    (model:any)=>{model.source.revison="typo"},
    (model:any)=>{model.components[0].statuz="observed"},
    (model:any)=>{model.runtime_scenarios[0].steps[0].statuz="observed"},
    (model:any)=>{model.evidence[0].statuz="observed"},
    (model:any)=>{model.data[0].status="observed"}
  ]
  for(const mutate of mutations){const model=structuredClone(rawModel);mutate(model);expect(()=>parseModel(model)).toThrow("schema")}
  expect(()=>parsePresentation({...rawPresentation,sections:[{...rawPresentation.sections[0],view:"overview"}]})).toThrow("schema")
})
