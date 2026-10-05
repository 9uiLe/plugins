import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { ExplanationModel } from "../src/domain/explanation-model"
import { checkPresentation, type Presentation } from "../src/domain/presentation"
import { parseModel, parsePresentation } from "../src/domain/schema"
import presentationSchema from "../schemas/presentation.schema.json"

const fixtures=resolve(import.meta.dir,"../../../tests/fixtures/presentation")
const originalModel=parseModel(JSON.parse(readFileSync(resolve(fixtures,"auth-model.json"),"utf8")))
const originalPresentation=parsePresentation(JSON.parse(readFileSync(resolve(fixtures,"auth-presentation.json"),"utf8")))
const levels=["system","container","module","class","function"] as const

function scenario(steps:readonly (readonly [string,string])[]):{model:ExplanationModel;presentation:Presentation}{
  const model=structuredClone(originalModel)
  model.context.external_systems.push({id:"external",name:"外部認証",status:"observed",evidence:["ev-client"],interaction:"認証結果を返す"})
  for(const level of levels)for(const suffix of ["a","b"] as const)model.components.push({...model.components[0],id:`${level}-${suffix}`,level,depends_on:[]})
  model.runtime_scenarios.push({...model.runtime_scenarios[0],id:"compat",steps:steps.map(([from,to])=>({...model.runtime_scenarios[0].steps[0],from,to}))})
  const presentation:Presentation={...originalPresentation,sections:[originalPresentation.sections[0],{id:"compat",type:"sequence",question:"参加者は互換か",sources:["compat"]}]}
  return {model,presentation}
}

const valid:[string,string][]=[
  ["actor-client","system-a"],["actor-client","container-a"],
  ["external","system-a"],["external","container-a"],
  ...levels.map(level=>[`${level}-a`,`${level}-b`] as [string,string])
]
for(const [from,to] of valid)test(`runtime permits ${from} ↔ ${to}`,()=>{
  for(const pair of [[from,to],[to,from]] as const){const {model,presentation}=scenario([pair]);expect(()=>checkPresentation(presentation,model)).not.toThrow()}
})

const invalid:[string,string][]=[
  ["actor-client","function-a"],["external","function-a"],
  ["system-a","function-a"],["container-a","function-a"],
  ["module-a","function-a"],["class-a","module-a"]
]
for(const [from,to] of invalid)test(`runtime rejects ${from} ↔ ${to}`,()=>{
  for(const pair of [[from,to],[to,from]] as const){const {model,presentation}=scenario([pair]);expect(()=>checkPresentation(presentation,model)).toThrow("incompatible runtime participants")}
})

test("same-band actor and system steps can share one scenario",()=>{
  const {model,presentation}=scenario([["actor-client","system-a"],["system-a","system-b"]])
  expect(()=>checkPresentation(presentation,model)).not.toThrow()
})
test("same-band external and container steps can share one scenario",()=>{
  const {model,presentation}=scenario([["external","container-a"],["container-a","container-b"]])
  expect(()=>checkPresentation(presentation,model)).not.toThrow()
})
test("cross-band steps cannot share one scenario",()=>{
  const {model,presentation}=scenario([["actor-client","system-a"],["class-a","class-b"]])
  expect(()=>checkPresentation(presentation,model)).toThrow("one scenario mixes interaction levels")
})

test("model source kinds select only their documented section types",()=>{
  const {model}=scenario([["actor-client","system-a"]])
  const cases:Record<string,string[]>={
    purpose:["overview","callout","takeaway"],
    "actor-client":["overview","system_context"],
    external:["overview","system_context"],
    "cmp-auth":["overview","component_map","code_map","callout","takeaway"],
    "rt-refresh":["overview","sequence","runtime_flow"],
    "st-active":["state_transition"],
    "data-session":["data_flow"],
    "dec-rotate":["decision","callout","takeaway"],
    "inv-token":["change_impact","callout","takeaway"],
    "chg-refresh":["overview","before_after","change_impact","callout","takeaway"],
    "unk-rationale":["known_unknowns","callout","takeaway"],
    "ev-client":["code_map"]
  }
  const types=Object.keys(presentationSchema.definitions).filter(type=>type!=="section")
  expect(new Set(Object.values(cases).flat())).toEqual(new Set(types))
  for(const [id,allowed] of Object.entries(cases))for(const type of types){
    const p:Presentation={...originalPresentation,sections:[originalPresentation.sections[0],{id:"choice",type:type as Presentation["sections"][number]["type"],question:"問い",sources:[id]}]}
    if(allowed.includes(type))expect(()=>checkPresentation(p,model)).not.toThrow()
    else expect(()=>checkPresentation(p,model)).toThrow("cannot be used")
  }
})
