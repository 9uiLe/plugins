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
import { ClaimStatus, RenderState, StatusLabel, assertEvidenceBacked } from "../src/components/architecture/common"
import { CodeHead } from "../src/components/architecture/code"
import { graphData } from "../src/components/architecture/graph-data"
import { checkModel } from "../src/domain/evidence"
import { checkPresentation, type Presentation } from "../src/domain/presentation"
import { parseModel, parsePresentation } from "../src/domain/schema"
import { render } from "../src/renderer/render"
import { validateHtml } from "../src/validator/validate"
import { attr, hasAttr, parseHtml, walk } from "../src/validator/html"

const fixtures=resolve(import.meta.dir,"../../../tests/fixtures/presentation")
const model=parseModel(JSON.parse(readFileSync(resolve(fixtures,"auth-model.json"),"utf8")))
const presentation=parsePresentation(JSON.parse(readFileSync(resolve(fixtures,"auth-presentation.json"),"utf8")))
const sourceRoot=resolve(fixtures,"../auth-service/1-feature")
describe("owned shadcn primitives",()=>{
  test("render static semantic HTML without client runtime",async()=>{
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
  test("observed claims stay unlabelled while inferred and unknown claims are labelled",async()=>{
    const state=new RenderState(model)
    expect(renderToStaticMarkup(<ClaimStatus claim={model.purpose} state={state} about="purpose"/>)).toBe("")
    for(const status of ["inferred","unknown"] as const)expect(renderToStaticMarkup(<StatusLabel status={status}/>)).toContain(`data-evidence="${status}"`)
    const unknown=renderToStaticMarkup(<ClaimStatus claim={model.decisions[0].rationale} state={state} about="dec-rotate"/>)
    expect(unknown).toContain("不明")
    expect(unknown).toContain('href="#unknown-unk-rationale"')
  })
  test("structural evidence requires resolvable evidence",async()=>{
    const state=new RenderState(model)
    expect(()=>assertEvidenceBacked(["ev-store"],state)).not.toThrow()
    expect(()=>assertEvidenceBacked([],state)).toThrow("resolvable evidence")
    expect(()=>assertEvidenceBacked(["missing"],state)).toThrow("resolvable evidence")
  })
  test("code headers expose file, symbol and line range with wrap opportunities",async()=>{
    const html=renderToStaticMarkup(<CodeHead item={{id:"long",kind:"test",revision:"rev",file:"very/long/path/file.ts",symbol:"ClassName.veryLongMethodName",line:3,end_line:9}}/>)
    expect(html).toContain('data-file="very/long/path/file.ts"')
    expect(html).toContain('data-symbol="ClassName.veryLongMethodName"')
    expect(html).toContain('data-end-line="9"')
    expect(html).toContain("very/<wbr/>")
    expect(html).toContain("ClassName.<wbr/>veryLongMethodName")
    expect(html).toContain("テスト")
  })
  test("first and later terms preserve the glossary concept contract",async()=>{
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
  test("a state section maps states and operations in an overview and names them for readers",async()=>{
    const changed=structuredClone(model)
    changed.states=[
      {id:"st-other",owner:"cmp-auth",name:"active",transitions:[]},
      {id:"st-a",owner:"cmp-store",name:"active",transitions:[
        {event:"revoke",action:"セッションを失効させる",guard:"session ID が存在する",to:"revoked",evidence:["ev-store"]},
        {event:"expire",guard:"期限が切れた",to:"expired",evidence:["ev-store"]}]},
      {id:"st-r",owner:"cmp-store",name:"revoked",transitions:[]},
    ]
    changed.glossary.push({id:"term-st-a",concept:"st-a",preferred:"有効",code_terms:["active"],aliases:[],avoid:[],meaning:"使えるセッション",evidence:["ev-store"]},
      {id:"term-st-other",concept:"st-other",preferred:"別の要素の有効",code_terms:[],aliases:[],avoid:[],meaning:"同じ名前を持つ別の owner の状態",evidence:["ev-service"]})
    const withStates={...presentation,sections:presentation.sections.map(section=>section.type==="state_transition"?{...section,sources:["st-a","st-r"]}:section)}
    const html=await render(changed,withStates),id="state-data"
    const section=html.slice(html.indexOf(`<section id="${id}"`),html.indexOf("</section>",html.indexOf(`<section id="${id}"`)))
    const overview=section.slice(section.indexOf('class="flow-overview"'),section.indexOf('class="rail"'))
    expect([...overview.matchAll(/class="flow-node state-node" href="#([^"]+)"/g)].map(match=>match[1])).toEqual([`${id}-state-active`,`${id}-state-revoked`])
    expect(overview).toContain(`<a href="#${id}-tr-st-a-0">セッションを失効させる</a>`)
    expect(overview).toMatch(new RegExp(`class="state-exit"[^>]*>.*<a href="#${id}-tr-st-a-1">expire</a>.*expired`))
    for(const target of [`${id}-state-active`,`${id}-state-revoked`,`${id}-tr-st-a-0`,`${id}-tr-st-a-1`])expect(section).toContain(`id="${target}"`)
    expect(section).toContain('<span data-concept="st-a">有効</span> <code class="state-code">active</code>')
    expect(section).not.toContain("別の要素の有効")
    const revoke=section.slice(section.indexOf(`id="${id}-tr-st-a-0"`))
    expect(revoke).toMatch(/<code>revoke<\/code>　有効 → revoked/)
    expect(revoke).toMatch(/<h3 class="rail-title">セッションを失効させる<\/h3>/)
    expect(validateHtml(html,{model:changed}).errors).toEqual([])
  })
  test("same inputs produce identical standalone HTML",async()=>{
    const first=await render(model,presentation),second=await render(model,presentation)
    expect(first).toBe(second)
    expect(first).toStartWith("<!doctype html>")
    expect(first).toContain("<style>")
    expect(first).not.toMatch(/<script[^>]*\ssrc=/)
    expect(first).not.toContain("stylesheet")
    expect(first).not.toContain("__NEXT_DATA__")
    expect(first).not.toContain("hydrateRoot")
    expect(first).not.toContain("react-dom")
    expect(first).not.toMatch(/<link[^>]+(?:stylesheet|https?:)/i)
  })
  test("system context keeps actor and external edge directions",async()=>{
    const changed=structuredClone(model)
    changed.context.external_systems.push({id:"external-identity",name:"Identity Provider",status:"observed",evidence:["ev-client"],interaction:"識別する"})
    changed.glossary.push({...changed.glossary[0],id:"gloss-external",concept:"external-identity",preferred:"識別基盤",code_terms:["IdentityProvider"]})
    const section={id:"context",type:"system_context" as const,question:"誰と接続するか",sources:["actor-client","external-identity"]}
    const graph=graphData(section,new RenderState(changed))
    expect(graph.edges.map(({from,to})=>({from,to}))).toEqual([{from:"actor-client",to:"__subject"},{from:"__subject",to:"external-identity"}])
    changed.context.actors[0].role="  "
    expect(()=>graphData(section,new RenderState(changed))).toThrow("needs a role")
    changed.context.actors[0].role="認証要求を送る"
    changed.context.external_systems[0].interaction=" "
    expect(()=>graphData(section,new RenderState(changed))).toThrow("needs an interaction")
    expect(graph.edges.every(edge=>edge.label!=="接続する")).toBe(true)
  })
  test("component graph rejects dependencies without a meaning",async()=>{
    const changed=structuredClone(model)
    changed.components[1].depends_on[0].meaning="  "
    const section={id:"components",type:"component_map" as const,question:"何に依存するか",sources:["cmp-auth","cmp-store"]}
    expect(()=>graphData(section,new RenderState(changed))).toThrow("needs a meaning")
  })
  test("data flow edges use the glossary preferred term",async()=>{
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
  test("SVG nodes connect visible labels to glossary concepts",async()=>{
    const html=await render(model,presentation)
    expect(html).toMatch(/<title data-concept="data-session">セッション<\/title>[\s\S]*?<text class="diagram-name"[^>]*>[\s\S]*?セッション/)
  })
  test("a runtime scenario renders as rail rows with its exceptional path as a branch",async()=>{
    const html=await render(model,presentation),scenario=model.runtime_scenarios.find(item=>item.exceptional_paths.length)!
    const section=presentation.sections.find(item=>(item.type==="sequence"||item.type==="runtime_flow")&&item.sources[0]===scenario.id)!
    const figure=html.slice(html.indexOf(`<section id="${section.id}"`),html.indexOf("</section>",html.indexOf(`<section id="${section.id}"`)))
    expect(figure).not.toContain("<svg")
    expect(figure).toContain(scenario.trigger)
    for(const [i,step] of scenario.steps.entries())expect(figure).toContain(`id="${section.id}-${i+1}"`)
    const branch=scenario.exceptional_paths[0]
    expect(figure).toContain(`id="${section.id}-${branch.at_step}x0"`)
    expect(figure).toContain(branch.result)
    expect(figure).toContain("はい")
    const overview=[...figure.matchAll(/<a class="flow-node[^"]*" href="#([^"]+)"/g)].map(match=>match[1])
    expect(overview).toEqual(scenario.steps.flatMap((_,i)=>[`${section.id}-${i+1}`,...scenario.exceptional_paths.flatMap((path,index)=>path.at_step===i+1?[`${section.id}-${i+1}x${index}`]:[])]))
    for(const target of overview)expect(figure).toContain(`id="${target}"`)
    expect(figure).toMatch(/class="rail-row is-step[^"]*" data-evidence="observed"/)
  })
  test("a section finding becomes the section heading with its evidence trace",async()=>{
    const changed=structuredClone(model)
    changed.findings=[{id:"find-rotate",statement:"refresh token は使うたびに新しいものへ置き換わる",status:"observed",evidence:["ev-store"]}]
    const withFinding:Presentation={...presentation,sections:presentation.sections.map(section=>section.id==="how-it-works"?{...section,finding:"find-rotate"}:section)}
    expect(()=>parseModel(JSON.parse(JSON.stringify(changed)))).not.toThrow()
    expect(()=>parsePresentation(JSON.parse(JSON.stringify(withFinding)))).not.toThrow()
    const html=await render(changed,withFinding)
    const head=html.slice(html.indexOf('<section id="how-it-works"'),html.indexOf("</header>",html.indexOf('<section id="how-it-works"')))
    expect(head).toMatch(/<h2 data-evidence="observed">refresh token は使うたびに新しいものへ置き換わる/)
    expect(head).toContain("結論の根拠")
    expect(head).toContain('href="#code-ev-store"')
    expect(()=>checkPresentation({...withFinding,sections:withFinding.sections.map(section=>section.id==="how-it-works"?{...section,finding:"ev-store"}:section)},changed)).toThrow("is not a model finding")
  })
  test("a component summary replaces the responsibility inside the box and the full text stays in the list",async()=>{
    const changed=structuredClone(model),store=changed.components.find(item=>item.id==="cmp-store")!
    store.summary="refresh token を置き換える"
    expect(()=>parseModel(JSON.parse(JSON.stringify(changed)))).not.toThrow()
    const section=presentation.sections.find(item=>item.type==="component_map")!
    expect(graphData(section as Parameters<typeof graphData>[0],new RenderState(changed)).nodes.find(node=>node.id==="cmp-store")!.detail).toBe("refresh token を置き換える")
    const html=await render(changed,presentation),figure=html.slice(html.indexOf(`<section id="${section.id}"`))
    expect(figure.slice(figure.indexOf("</svg>"))).toContain(store.responsibility)
  })
  test("actor and external boxes leave their role to the arrow label",()=>{
    const section=presentation.sections.find(item=>item.type==="system_context")!
    const graph=graphData(section as Parameters<typeof graphData>[0],new RenderState(model))
    expect(graph.nodes.filter(node=>node.kind==="actor"||node.kind==="external").every(node=>node.detail===undefined)).toBe(true)
    expect(graph.edges.map(edge=>edge.label)).toContain(model.context.actors[0].role)
  })
  test("a flow section may select a step range inside its scenario",()=>{
    const flow=presentation.sections.find(item=>item.id==="how-it-works")!
    const ranged=(steps:{first:number;last:number}):Presentation=>({...presentation,sections:presentation.sections.map(section=>section.id===flow.id?{...section,steps}:section)})
    expect(()=>checkPresentation(ranged({first:2,last:2}),model)).not.toThrow()
    expect(()=>checkPresentation(ranged({first:2,last:3}),model)).toThrow("outside 1..2")
    expect(()=>checkPresentation({...presentation,sections:presentation.sections.map(section=>section.type==="component_map"?{...section,steps:{first:1,last:1}}:section)},model)).toThrow("is not a sequence, runtime flow, or annotated code")
  })
  test("Data, transition and impact retain evidence without semantic Claim status",async()=>{
    const html=await render(model,presentation),nodes:ReturnType<typeof parseHtml>[]=[]
    walk(parseHtml(html),node=>{if(node.tagName)nodes.push(node)})
    const data=nodes.find(node=>node.tagName==="g"&&attr(node,"data-kind")==="data")!
    expect(attr(data,"data-evidence-backed")).toBe("true")
    expect(attr(data,"data-evidence-ids")).toBe("ev-store")
    expect(hasAttr(data,"data-evidence")).toBe(false)
    const backed=nodes.filter(node=>attr(node,"data-evidence-backed")==="true")
    expect(backed.every(node=>!hasAttr(node,"data-evidence"))).toBe(true)
    expect(backed.some(node=>node.tagName==="div"&&attr(node,"class").includes("is-transition"))).toBe(true)
    expect(backed.some(node=>node.tagName==="li"&&attr(node,"data-impact")==="affected")).toBe(true)
    const observed=nodes.filter(node=>attr(node,"data-evidence")==="observed")
    expect(observed.some(node=>node.tagName==="g"&&attr(node,"data-kind")==="component")).toBe(true)
    expect(validateHtml(html,{model,sourceRoot}).errors).toEqual([])
  })
  test("missing structural evidence is a model error, not Unknown",async()=>{
    for(const modify of [(value:typeof model)=>{value.data[0].evidence=[]},(value:typeof model)=>{value.states[0].transitions[0].evidence=[]},(value:typeof model)=>{value.change_impacts[0].affected[0].evidence=[]}]){
      const changed=structuredClone(model);modify(changed)
      expect(checkModel(changed).errors.map(issue=>issue.code)).toContain("structure-evidence")
      expect(checkModel(changed).errors.map(issue=>issue.code)).not.toContain("unknown-link")
      await expect(render(changed,presentation)).rejects.toThrow("structure-evidence")
    }
  })
  test("theme does not change semantic markers or source selection",async()=>{
    const technical=await render(model,presentation)
    const cards=await render(model,{...presentation,theme:"cards"})
    expect(technical.replace('data-theme="technical"','data-theme="cards"')).toBe(cards)
    for(const marker of [/data-evidence=/g,/data-evidence-backed=/g,/data-file=/g,/<section\b/g,/data-question=/g])expect([...technical.matchAll(marker)].length).toBe([...cards.matchAll(marker)].length)
  })
  test("evidence references link only to code blocks in the document, without an evidence appendix",async()=>{
    const changed=structuredClone(model)
    changed.evidence.push({id:"ev-commit",kind:"commit",revision:"abc123",note:"設計判断"})
    changed.purpose.evidence.push("ev-commit")
    changed.components[1].code_locations[0].symbol=undefined
    changed.components[1].code_locations[0].line=undefined
    const html=await render(changed,presentation)
    expect(html).not.toContain("根拠の一覧")
    expect(html).not.toContain('id="source-')
    expect(html).toContain('<span data-evidence-ref="ev-commit">')
    const linked=[...html.matchAll(/<a href="#code-([^"]+)" data-evidence-ref="([^"]+)"/g)]
    expect(linked.length).toBeGreaterThan(0)
    for(const [,anchor,ref] of linked){expect(anchor).toBe(ref);expect(html).toContain(`id="code-${ref}"`)}
    expect(html).not.toContain("undefined")
    expect(html).toMatch(/class="[^"]*src-symbol" data-label="シンボル">—<\/td>/)
    expect(validateHtml(html,{model:changed,sourceRoot}).errors).toEqual([])
  })
  test("all selected views have a reader question, caption and trace",async()=>{
    const html=await render(model,presentation)
    const report=validateHtml(html,{model,sourceRoot})
    expect(report.ok).toBe(true)
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
    expect(report.stats.figures).toBe(presentation.sections.length)
    expect(report.stats.code_refs).toBeGreaterThan(0)
  })
  test("invalid source, mixed levels and incompatible runtime levels fail",async()=>{
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
  test("schema rejects agent JSON with missing claims or unknown view",async()=>{
    expect(()=>parseModel({subject:{title:"T"}})).toThrow("schema")
    expect(()=>parsePresentation({...presentation,sections:[{...presentation.sections[0],type:"invented"}]})).toThrow("schema")
  })
})
