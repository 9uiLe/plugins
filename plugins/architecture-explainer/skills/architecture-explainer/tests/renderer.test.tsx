import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Card, CardContent, CardTitle } from "../src/components/ui/card"
import { Badge } from "../src/components/ui/badge"
import { Alert } from "../src/components/ui/alert"
import { Separator } from "../src/components/ui/separator"
import { Table, TableCell, TableRow } from "../src/components/ui/table"
import { EvidenceBadge, RenderState } from "../src/components/architecture/common"
import { graphData } from "../src/components/architecture/graph-data"
import { checkPresentation, type Presentation } from "../src/domain/presentation"
import { parseModel, parsePresentation } from "../src/domain/schema"
import { render } from "../src/renderer/render"
import { validateHtml } from "../src/validator/validate"

const fixtures=resolve(import.meta.dir,"../../../tests/fixtures/presentation")
const model=parseModel(JSON.parse(readFileSync(resolve(fixtures,"auth-model.json"),"utf8")))
const presentation=parsePresentation(JSON.parse(readFileSync(resolve(fixtures,"auth-presentation.json"),"utf8")))
const sourceRoot=resolve(fixtures,"../auth-service/1-feature")
describe("owned shadcn primitives",()=>{
  test("render static semantic HTML without client runtime",()=>{
    const html=renderToStaticMarkup(<><Card><CardTitle>Title</CardTitle><CardContent>Body</CardContent></Card><Badge>Observed</Badge><Alert>Unknown</Alert><Separator/><Table><tbody><TableRow><TableCell>Code</TableCell></TableRow></tbody></Table></>)
    expect(html).toContain('data-slot="card"')
    expect(html).toContain('data-slot="badge"')
    expect(html).toContain('role="note"')
    expect(html).not.toContain('role="alert"')
    expect(html).toContain('<hr')
    expect(html).toContain('<table')
    expect(html).toContain('data-slot="table-container" class="relative w-full overflow-x-auto"')
    expect(html).not.toContain("react-dom")
    expect(html).not.toContain("<script")
  })
  test("evidence badge retains code trace and unknown resolution",()=>{
    const state=new RenderState(model)
    const observed=renderToStaticMarkup(<EvidenceBadge claim={model.purpose} state={state} about="purpose"/>)
    const unknown=renderToStaticMarkup(<EvidenceBadge claim={model.decisions[0].rationale} state={state} about="dec-rotate"/>)
    expect(observed).toContain('data-file="app/client/token_manager.py"')
    expect(unknown).toContain('href="#unknown-unk-rationale"')
  })
  test("first and later terms preserve the glossary concept contract",()=>{
    const state=new RenderState(model)
    const first=renderToStaticMarkup(<>{state.term("cmp-store")}</>)
    const later=renderToStaticMarkup(<>{state.term("cmp-store")}</>)
    expect(first).toContain('<span data-concept="cmp-store">セッションストア</span>')
    expect(first).toContain('<span data-concept="cmp-store"><code>SessionStore</code></span>')
    expect(later).toContain('<span data-concept="cmp-store">セッションストア</span>')
    expect(later).not.toContain("SessionStore")
  })
})
describe("renderer",()=>{
  test("same inputs produce identical standalone HTML",()=>{
    const first=render(model,presentation),second=render(model,presentation)
    expect(first).toBe(second)
    expect(first).toStartWith("<!doctype html>")
    expect(first).toContain("<style>")
    expect(first).not.toContain("<script")
    expect(first).not.toContain("stylesheet")
    expect(first).not.toContain("__NEXT_DATA__")
    expect(first).not.toContain("hydrateRoot")
    expect(first).not.toContain("react-dom")
    expect(first).not.toMatch(/<link[^>]+(?:stylesheet|https?:)/i)
  })
  test("system context keeps actor and external edge directions",()=>{
    const changed=structuredClone(model)
    changed.context.external_systems.push({...changed.context.actors[0],id:"external-identity",name:"Identity Provider",role:"識別する"})
    changed.glossary.push({...changed.glossary[0],id:"gloss-external",concept:"external-identity",preferred:"識別基盤",code_terms:["IdentityProvider"]})
    const section={id:"context",type:"system_context" as const,question:"誰と接続するか",sources:["actor-client","external-identity"]}
    const graph=graphData(section,new RenderState(changed))
    expect(graph.edges.map(({from,to})=>({from,to}))).toEqual([{from:"actor-client",to:"__subject"},{from:"__subject",to:"external-identity"}])
  })
  test("data flow edges use the glossary preferred term",()=>{
    const section={id:"data",type:"data_flow" as const,question:"何を読み書きするか",sources:["data-session"]}
    const graph=graphData(section,new RenderState(model))
    const preferred=model.glossary.find(item=>item.concept==="data-session")!.preferred
    expect(graph.edges.map(edge=>edge.label)).toEqual([`${preferred}を書き込む`,`${preferred}を読み出す`])
    expect(graph.edges.every(edge=>!new Set(["書き込む","読み出す","Session"]).has(edge.label))).toBe(true)
    const renamed=structuredClone(model)
    renamed.glossary.find(item=>item.concept==="data-session")!.preferred="認証セッション"
    renamed.data[0].name="認証セッション"
    expect(graphData(section,new RenderState(renamed)).edges.map(edge=>edge.label)).toEqual(["認証セッションを書き込む","認証セッションを読み出す"])
  })
  test("SVG nodes connect visible labels to glossary concepts",()=>{
    const html=render(model,presentation)
    expect(html).toMatch(/<title data-concept="data-session">セッション<\/title>[\s\S]*?<text class="graph-text"[^>]*>[\s\S]*?セッション/)
  })
  test("theme does not change semantic markers or source selection",()=>{
    const technical=render(model,presentation)
    const cards=render(model,{...presentation,theme:"cards"})
    expect(technical.replace('data-theme="technical"','data-theme="cards"')).toBe(cards)
  })
  test("all selected views have a reader question, caption and trace",()=>{
    const html=render(model,presentation)
    const report=validateHtml(html,{model,sourceRoot})
    expect(report.ok).toBe(true)
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
    expect(report.stats.figures).toBe(presentation.sections.length)
    expect(report.stats.code_refs).toBeGreaterThan(0)
  })
  test("invalid source, mixed levels and incompatible runtime levels fail",()=>{
    const changed=structuredClone(presentation) as Presentation
    changed.sections[1].sources=["absent"]
    expect(()=>checkPresentation(changed,model)).toThrow("unknown model ID")
    changed.sections[1].sources=["actor-client"]
    changed.sections[3].sources=["cmp-auth","cmp-auth-system"]
    expect(()=>checkPresentation(changed,model)).toThrow("mixes abstraction levels")
    changed.sections[3].sources=["cmp-auth","cmp-store"]
    changed.sections[2].sources=["rt-refresh"]
    const altered=structuredClone(model)
    altered.runtime_scenarios[1].steps[0].from="actor-client"
    expect(()=>checkPresentation(changed,altered)).toThrow("incompatible runtime participants")
  })
  test("schema rejects agent JSON with missing claims or unknown view",()=>{
    expect(()=>parseModel({subject:{title:"T"}})).toThrow("schema")
    expect(()=>parsePresentation({...presentation,sections:[{...presentation.sections[0],type:"invented"}]})).toThrow("schema")
  })
})
