import { describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseModel } from "../src/domain/schema"
import { validateHtml } from "../src/validator/validate"

const body='<header><h1>認証</h1></header><main id="main"><section id="what" class="first-view"><h2>何をするか</h2><p><span data-evidence="observed">確認済み</span>認証サービスが確認します。</p><figure data-question="誰が呼ぶか"><svg width="100" role="img" aria-label="関係"></svg><figcaption>関係</figcaption></figure></section><section id="code"><h2>コード</h2><a href="#what" data-file="app/service.py" data-symbol="AuthService.refresh" data-line="2">source</a></section></main>'
const page=(content=body,head='<meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>認証</title>')=>`<!doctype html><html lang="ja"><head>${head}</head><body>${content}</body></html>`
const codes=(items:{code:string}[])=>new Set(items.map(item=>item.code))
const root=mkdtempSync(join(tmpdir(),"arch-validator-"));mkdirSync(join(root,"app"));writeFileSync(join(root,"app/service.py"),"class AuthService:\n def refresh(self):\n  return True\n")
describe("HTML contract regression",()=>{
  test("valid standalone document and code references pass",()=>{const result=validateHtml(page(),{sourceRoot:root});expect(result.errors).toEqual([]);expect(result.warnings).toEqual([])})
  test("document metadata and headings",()=>{const result=validateHtml(page(body.replace("<h2>コード</h2>","<h1>重複</h1><h3>詳細</h3>"),""));expect(codes(result.errors)).toEqual(new Set(["html-lang","meta-charset","meta-viewport","title","h1-count"].filter(code=>code!=="html-lang")));expect(codes(result.warnings)).toContain("heading-skip")})
  test("anchors, IDs and ARIA references",()=>{const result=validateHtml(page(body.replace('href="#what"','href="#absent"').replace('id="code"','id="what"').replace('aria-label="関係"','aria-labelledby="absent"')));expect(codes(result.errors)).toContain("broken-anchor");expect(codes(result.errors)).toContain("duplicate-id");expect(codes(result.errors)).toContain("broken-aria-ref")})
  test("figure question, caption, density, first view",()=>{const missing=validateHtml(page(body.replace(' data-question="誰が呼ぶか"','').replace('<figcaption>関係</figcaption>','')));expect(codes(missing.errors)).toContain("figure-question");expect(codes(missing.errors)).toContain("figure-caption");const extra=`<figure data-question="追加"><div>${'<div class="node">n</div>'.repeat(10)}</div><figcaption>追加</figcaption></figure>`;const dense=validateHtml(page(body.replace("</section>",extra+"</section>")));expect(codes(dense.warnings)).toContain("figure-density");expect(codes(dense.warnings)).toContain("first-view-figures")})
  test("external scripts, styles, CSS URLs and media",()=>{const head='<meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>T</title><script src="https://cdn.example/a.js"></script><link rel="stylesheet" href="style.css"><style>@import url(https://cdn.example/a.css)</style>';const result=validateHtml(page(body+'<img alt="" src="photo.png">',head));expect(codes(result.errors)).toContain("external-script");expect(codes(result.errors)).toContain("external-stylesheet");expect(codes(result.errors)).toContain("external-css-url");expect(codes(result.warnings)).toContain("relative-media")})
  test("SVG alt, interactive handlers and focus",()=>{const result=validateHtml(page(body.replace('aria-label="関係"','').replace('<header>','<img src="data:image/png;base64,AAAA"><div onclick="go()" tabindex="2">開く</div><header>')));expect(codes(result.errors)).toContain("svg-label");expect(codes(result.errors)).toContain("img-alt");expect(codes(result.errors)).toContain("non-interactive-handler");expect(codes(result.warnings)).toContain("positive-tabindex")})
  test("file, symbol, line and path traversal",()=>{for(const [replacement,expected] of [['app/missing.py','code-ref-file'],['../outside.py','code-ref-file'],['app/service.py','none']] as const){const html=page(body.replace('data-file="app/service.py"',`data-file="${replacement}"`));const found=codes(validateHtml(html,{sourceRoot:root}).errors);if(expected==='none')expect(found).not.toContain("code-ref-file");else expect(found).toContain(expected)}expect(codes(validateHtml(page(body.replace("AuthService.refresh","AuthService.absent")),{sourceRoot:root}).errors)).toContain("code-ref-symbol");expect(codes(validateHtml(page(body.replace('data-line="2"','data-line="99"')),{sourceRoot:root}).errors)).toContain("code-ref-line")})
  test("evidence and code maps",()=>{const invalid=validateHtml(page(body.replace('data-evidence="observed"','data-evidence="likely"').replace('data-file="app/service.py"','')));expect(codes(invalid.errors)).toContain("evidence-value");expect(codes(invalid.warnings)).toContain("no-evidence-markers");expect(codes(invalid.warnings)).toContain("no-code-refs");const map='<table class="codemap"><tr><td><span class="src-file">app/service.py</span></td></tr></table>';const report=validateHtml(page(body+map));expect(codes(report.warnings)).toContain("codemap-label");expect(codes(report.warnings)).toContain("codemap-break")})
  test("missing language, external media and Code Map source are reported",()=>{
    const html=page(body+'<img alt="remote" src="https://example.test/a.png"><table class="codemap"><tr><td data-label="要素">認証</td></tr></table>').replace('<html lang="ja">','<html>')
    const report=validateHtml(html)
    expect(codes(report.errors)).toContain("html-lang")
    expect(codes(report.warnings)).toContain("external-media")
    expect(codes(report.warnings)).toContain("codemap-source")
  })
  test("malformed HTML reports stray end tags and unclosed elements",()=>{
    const html=page(body.replace('</main>','<div><p>未完了</p></main></aside>'))
    const report=validateHtml(html)
    expect(codes(report.warnings)).toContain("unclosed-element")
    expect(codes(report.warnings)).toContain("stray-end-tag")
  })
})
describe("Japanese and model integrity",()=>{
  test("ambiguous references and abstract arrows warn; passive is permitted",()=>{const html=page(body.replace("</main>",'<p>これが結果を返します。</p><p>設定値は起動時に読み込まれます。</p><span class="arrow-label">呼び出し</span></main>'));const report=validateHtml(html);expect(codes(report.warnings)).toContain("LANG003");expect(codes(report.warnings)).toContain("LANG006");expect(report.errors).toEqual([])})
  test("long clear sentences are never errors; complexity produces warning or hint",()=>{const html=page(body.replace("</main>",'<p>条件が成立する場合、エラーがないため、権限を確認するので、認証サービスは照合を行う。</p><p data-responsibility>保存します。取得します。削除します。</p></main>'));const report=validateHtml(html);expect(codes(report.warnings)).toContain("LANG008");expect(codes(report.warnings)).toContain("LANG005");expect(codes(report.hints)).toContain("LANG009");expect(report.errors).toEqual([])})
  test("glossary is sole terminology source",()=>{const model=parseModel(JSON.parse(require("node:fs").readFileSync(new URL("../../../tests/fixtures/presentation/auth-model.json",import.meta.url),"utf8")));const html=page(body.replace("</main>",'<p><span data-concept="cmp-auth">別名</span></p></main>'));const report=validateHtml(html,{model});expect(codes(report.warnings)).toContain("LANG004");model.components[1].name="誤名称";expect(codes(validateHtml(html,{model}).errors)).toContain("model-terminology")})
  test("before/after revisions and unknown linkage are hard errors",()=>{const model=parseModel(JSON.parse(require("node:fs").readFileSync(new URL("../../../tests/fixtures/presentation/auth-model.json",import.meta.url),"utf8")));model.change_impacts[0].before.status="observed";model.change_impacts[0].before.evidence=[];expect(codes(validateHtml(page(),{model}).errors)).toContain("change-evidence");model.change_impacts[0].before.status="unknown";model.unknowns=[];expect(codes(validateHtml(page(),{model}).errors)).toContain("change-evidence")})
  test("six sentences are permitted and seven produce LANG002 hint",()=>{
    const sentence="認証サービスが照合します。"
    const make=(count:number)=>page(body.replace('</main>',`<p>${sentence.repeat(count)}</p></main>`))
    expect(codes(validateHtml(make(6)).hints)).not.toContain("LANG002")
    expect(codes(validateHtml(make(7)).hints)).toContain("LANG002")
  })
  test("passive is not warned; bare data actions and ambiguous references are",()=>{
    const html=page(body.replace('</main>','<p>設定値は起動時に読み込まれます。</p><p>これが結果を返します。</p><span class="arrow-label">読み出す</span></main>'))
    const report=validateHtml(html)
    expect(codes(report.warnings)).toContain("LANG003")
    expect(codes(report.warnings)).toContain("LANG006")
    expect(report.warnings.some(issue=>issue.message.includes("読み込まれます"))).toBe(false)
  })
  test("complex conditions warn; long clauses and verbose actions hint",()=>{
    const long="認証サービスは、有効な要求が届いた場合、状態を確認するため、権限が有効なので、"+"対象のセッションを確認し、対象のセッションを検証し、対象のセッションを返す処理を行うため、"+"確認済みの権限と対象のセッションの状態をそれぞれ確認し、要求の内容を一つずつ照合してから応答を返す。"
    const report=validateHtml(page(body.replace('</main>',`<p>${long}</p></main>`)))
    expect(codes(report.warnings)).toContain("LANG008")
    expect(codes(report.hints)).toContain("LANG001")
    expect(codes(report.hints)).toContain("LANG009")
  })
  test("glossary collision errors, aliases pass and avoid terms warn",()=>{
    const fixture=JSON.parse(require("node:fs").readFileSync(new URL("../../../tests/fixtures/presentation/auth-model.json",import.meta.url),"utf8"))
    const model=parseModel(fixture)
    const entry=model.glossary.find(item=>item.concept==="cmp-store")!
    entry.aliases.push("保存庫")
    entry.avoid.push("キャッシュ")
    const html=page(body.replace('</main>','<p><span data-concept="cmp-store">保存庫</span>はキャッシュを使います。</p></main>'))
    const report=validateHtml(html,{model})
    expect(codes(report.warnings)).toContain("LANG007")
    expect(report.warnings.filter(issue=>issue.code==="LANG004")).toEqual([])
    model.glossary.find(item=>item.concept==="cmp-auth")!.aliases.push("保存庫")
    expect(codes(validateHtml(html,{model}).errors)).toContain("glossary-collision")
  })
})
