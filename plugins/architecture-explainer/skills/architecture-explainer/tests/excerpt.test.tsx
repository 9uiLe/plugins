import { describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { checkModel } from "../src/domain/evidence"
import { parseModel, parsePresentation } from "../src/domain/schema"
import { highlightLines } from "../src/renderer/highlight"
import { render } from "../src/renderer/render"
import { readExcerpts } from "../src/renderer/source"
import { validateHtml } from "../src/validator/validate"

const fixtures=resolve(import.meta.dir,"../../../tests/fixtures/presentation")
const model=parseModel(JSON.parse(readFileSync(resolve(fixtures,"auth-model.json"),"utf8")))
const presentation=parsePresentation(JSON.parse(readFileSync(resolve(fixtures,"auth-presentation.json"),"utf8")))
const sourceRoot=resolve(fixtures,"../auth-service/1-feature")
const fileLines=(file:string)=>readFileSync(resolve(sourceRoot,file),"utf8").split(/\r?\n/)

describe("code excerpts",()=>{
  test("an evidence range is read from the source root with its line numbers",()=>{
    const evidence=[{...model.evidence.find(item=>item.id==="ev-store")!,end_line:47}]
    const excerpt=readExcerpts(evidence,sourceRoot).get("ev-store")!
    expect(excerpt.lines.map(line=>line.number)).toEqual([45,46,47])
    expect(excerpt.lines.map(line=>line.text)).toEqual(fileLines("app/auth/session_store.py").slice(44,47))
    expect(excerpt.language).toBe("python")
  })
  test("the rendered page shows each excerpt once, inline, and still validates",async()=>{
    const html=await render(model,presentation,{sourceRoot})
    expect(html).not.toContain("evidence-sources")
    expect(html).toContain('class="code-block" id="code-ev-store" data-language="python"')
    expect(html.split('id="code-ev-store"').length-1).toBe(1)
    expect(html).toContain('class="hljs-keyword"')
    const report=validateHtml(html,{model,sourceRoot})
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
  })
  test("a repeated excerpt opens in a popover window next to the current step",async()=>{
    const html=await render(model,presentation,{sourceRoot})
    const targets=[...html.matchAll(/<button type="button" class="same-code" popovertarget="([^"]+)"/gi)].map(match=>match[1])
    expect(targets.length).toBeGreaterThan(0)
    for(const target of targets){
      const start=html.indexOf(`<div id="${target}" popover="auto"`)
      expect(start).toBeGreaterThan(-1)
      const next=html.indexOf('popover="auto"',start+`<div id="${target}" popover="auto"`.length)
      const peek=html.slice(start,next>-1?next:undefined)
      expect(peek).toMatch(/class="code-block"(?! id=)/)
      expect(peek.toLowerCase()).toContain(`popovertarget="${target}" popovertargetaction="hide"`)
      expect(peek).toMatch(/<a href="#code-[^"]+">説明の場所へ移動<\/a>/)
    }
    expect(html).not.toContain('class="same-code" href=')
    expect(html.match(/<script/g)).toHaveLength(1)
    expect(html.slice(html.indexOf("<script>"))).toContain(".code-peek-handle")
    expect(html.match(/class="code-peek-handle"/g)).toHaveLength(targets.length)
    const report=validateHtml(html,{model,sourceRoot})
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
  })
  test("a page without repeated excerpts carries no script",async()=>{
    const single={...presentation,sections:presentation.sections.filter(section=>section.type==="overview")}
    expect(await render(model,single,{sourceRoot})).not.toContain("<script")
  })
  test("source text is escaped whether or not its language is highlighted",()=>{
    const root=mkdtempSync(join(tmpdir(),"excerpt-")),attack='const tag = "</span><script>alert(1)</script>"'
    writeFileSync(join(root,"page.ts"),attack+"\n")
    writeFileSync(join(root,"notes.unknown"),attack+"\n")
    const excerpts=readExcerpts([{id:"a",kind:"code",revision:"r",file:"page.ts",line:1},{id:"b",kind:"code",revision:"r",file:"notes.unknown",line:1}],root)
    expect(excerpts.get("a")!.lines[0].html).not.toContain("<script>")
    expect(excerpts.get("a")!.lines[0].html).toContain("&lt;script&gt;")
    expect(excerpts.get("b")!.lines[0].html).toBeUndefined()
  })
  test("files outside the source root and lines past the end are rejected",()=>{
    const root=mkdtempSync(join(tmpdir(),"excerpt-"))
    mkdirSync(join(root,"inside"));writeFileSync(join(root,"outside.ts"),"secret\n");writeFileSync(join(root,"inside","a.ts"),"one\n")
    expect(()=>readExcerpts([{id:"a",kind:"code",revision:"r",file:"../outside.ts",line:1}],join(root,"inside"))).toThrow("outside the source root")
    expect(()=>readExcerpts([{id:"a",kind:"code",revision:"r",file:"a.ts",line:1,end_line:9}],join(root,"inside"))).toThrow("the file has 2 lines")
  })
  test("an end line before its start line is a model error",()=>{
    const changed=structuredClone(model);changed.evidence[0]={...changed.evidence[0],line:10,end_line:9}
    expect(checkModel(changed).errors.map(issue=>issue.code)).toContain("evidence-range")
  })
  test("spans that cross a line break are closed and reopened on each line",()=>{
    const result=highlightLines("a.ts",["/* first","   second */","const x = 1"])!
    expect(result.lines).toHaveLength(3)
    for(const line of result.lines)expect((line.match(/<span/g)||[]).length).toBe((line.match(/<\/span>/g)||[]).length)
    expect(result.lines[1]).toStartWith('<span class="hljs-comment">')
    const embedded=highlightLines("page.html",["<script>const x = 1</script>"])!
    expect(embedded.lines[0]).toContain('<span class="language-javascript">')
    expect(embedded.lines[0]).toContain('class="hljs-keyword"')
  })
  test("an annotated code section shows each step with its code already open",async()=>{
    const scenario=model.runtime_scenarios.find(item=>item.exceptional_paths.length)!
    const withCode={...presentation,sections:[...presentation.sections,{id:"walkthrough",type:"annotated_code" as const,question:"どのコードが各手順を実行するか",sources:[scenario.id]}]}
    const html=await render(model,withCode,{sourceRoot})
    const section=html.slice(html.indexOf('<section id="walkthrough"'),html.indexOf("</section>",html.indexOf('<section id="walkthrough"')))
    for(const [i] of scenario.steps.entries())expect(section).toContain(`id="walkthrough-${i+1}"`)
    expect(section).not.toContain("flow-overview")
    const branch=scenario.exceptional_paths[0]
    const row=section.slice(section.indexOf(`id="walkthrough-${branch.at_step}x0"`))
    const next=row.indexOf('id="walkthrough-',1)
    expect(next<0?row:row.slice(0,next)).toContain(branch.result)
    expect(validateHtml(html,{model,sourceRoot}).warnings).toEqual([])
    await expect(render(model,withCode)).rejects.toThrow("need --source-root")
  })
  test("official documentation links appear under the excerpt that uses them and in a references section",async()=>{
    const changed=structuredClone(model)
    changed.references=[{id:"ref-with",topic:"Python の with 文",title:"The with statement",url:"https://docs.python.org/3/reference/compound_stmts.html#the-with-statement",note:"ロックの取得と解放"}]
    changed.evidence=changed.evidence.map(item=>item.id==="ev-store"?{...item,references:["ref-with"]}:item)
    expect(()=>parseModel(JSON.parse(JSON.stringify(changed)))).not.toThrow()
    const withRefs={...presentation,sections:[...presentation.sections,{id:"background",type:"references" as const,question:"コードを読む前に何を知っておくか",sources:["ref-with"]}]}
    const html=await render(changed,withRefs,{sourceRoot})
    expect(html).toContain('<p class="code-doc"><b>公式ドキュメント</b><a href="https://docs.python.org/3/reference/compound_stmts.html#the-with-statement" rel="noreferrer">The with statement</a>')
    expect(html.slice(html.indexOf('<section id="background"'))).toContain("ロックの取得と解放")
    expect(validateHtml(html,{model:changed,sourceRoot}).warnings).toEqual([])
    const missing=structuredClone(changed);missing.references=[]
    expect(checkModel(missing).errors.map(issue=>issue.code)).toContain("reference-link")
    expect(()=>parseModel({...JSON.parse(JSON.stringify(changed)),references:[{...changed.references![0],url:"http://example.com"}]})).toThrow()
  })
  test("annotations mark their lines, place each note after its last line and fold the lines around them",async()=>{
    const changed=structuredClone(model)
    changed.evidence=changed.evidence.map(item=>item.id==="ev-store"?{...item,line:42,end_line:56,annotations:[{from:44,to:46,text:"不明な token は拒否する"},{from:54,to:55,text:"新しい token を登録する"}]}:item)
    expect(checkModel(changed).errors).toEqual([])
    const html=await render(changed,presentation,{sourceRoot})
    const start=html.indexOf('id="code-ev-store"'),block=html.slice(start,html.indexOf('class="code-block"',start+1))
    expect((block.match(/class="code-line marked"/g)||[]).length).toBe(5)
    expect(block).not.toContain("code-notes")
    for(const number of [1,2])expect(block.split(`<b class="code-mark">${number}</b>`).length-1).toBe(1)
    for(const [last,next,text] of [[46,47,"不明な token は拒否する"],[55,56,"新しい token を登録する"]] as const){
      const note=block.indexOf(text)
      expect(note).toBeGreaterThan(block.indexOf(`<span>${last}</span>`))
      expect(note).toBeLessThan(block.indexOf(`<span>${next}</span>`))
    }
    expect(block).toMatch(/<details class="code-fold"><summary>⋯ 間の \d+ 行を表示/)
    const outside=structuredClone(changed);outside.evidence=outside.evidence.map(item=>item.id==="ev-store"?{...item,annotations:[{from:40,to:44,text:"範囲外"}]}:item)
    expect(checkModel(outside).errors.map(issue=>issue.code)).toContain("annotation-range")
  })
})
