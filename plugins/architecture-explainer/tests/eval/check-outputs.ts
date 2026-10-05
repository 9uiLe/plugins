import { existsSync, readFileSync, readdirSync } from "node:fs"
import { basename, dirname, join, relative, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { parseModel } from "../../skills/architecture-explainer/src/domain/schema"
import { validateHtml } from "../../skills/architecture-explainer/src/validator/validate"
import { parseHtml, type HtmlNode } from "../../skills/architecture-explainer/src/validator/html"

const fabrications=["Redis","RS256","JWT","bcrypt","PostgreSQL","API Gateway","Load Balancer","security team","セキュリティチーム","ASVS","10,000"]
const reviewFindings:Record<string,RegExp>={
  "nonexistent Redis session cache":/Redis/,
  "JWT RS256 vs HMAC-SHA256":/(RS256|JWT)[\s\S]*HMAC|HMAC[\s\S]*(RS256|JWT)/,
  "7-day vs 30-day refresh TTL":/7\s*(日|days?)[\s\S]*30|30[\s\S]*7\s*(日|days?)/,
  "bcrypt vs PBKDF2":/bcrypt[\s\S]*pbkdf2|pbkdf2[\s\S]*bcrypt/i,
  "PostgreSQL vs SQLite":/postgresql[\s\S]*sqlite|sqlite[\s\S]*postgresql/i,
  "nonexistent API Gateway / Load Balancer":/API Gateway[\s\S]*Load Balancer|Load Balancer[\s\S]*API Gateway/,
  "fabricated security-team rationale":/security team|セキュリティチーム/,
  "thread-safe background refresh claim":/thread-safe|background|バックグラウンド/i,
  "unsupported ASVS / throughput claims":/ASVS|10,000/
}
export function modelForHtml(html:string):string {const name=basename(html);return join(dirname(html),name.endsWith(".improved.html")?`${name.slice(0,-".improved.html".length)}.explanation-model.json`:"explanation-model.json")}
export function validate(html:string,root:string){const path=modelForHtml(html);if(!existsSync(path))return {errors:["missing-model"],warnings:[],stats:{},detail:path}
  try{const model=parseModel(JSON.parse(readFileSync(path,"utf8"))),result=validateHtml(readFileSync(html,"utf8"),{model,sourceRoot:root});return {errors:result.errors.map(e=>e.code),warnings:result.warnings.map(w=>w.code),stats:result.stats}}
  catch(error){return {errors:["validator-failed"],warnings:[],stats:{},detail:String(error)}}
}
function files(root:string):string[]{if(!existsSync(root))return [];return readdirSync(root,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(root,entry.name)):[join(root,entry.name)])}
function changedSource(root:string):string[]{const result=spawnSync("git",["status","--porcelain"],{cwd:root,encoding:"utf8"});return result.stdout.split("\n").filter(line=>line&&!/explainers\/|\.improved\.|explanation-model\.json|review\.md/.test(line))}
function visibleText(node:HtmlNode):string {
  if(node.tagName==="style"||node.tagName==="script"||node.tagName==="template"||node.tagName==="head")return ""
  return node.value||node.childNodes?.map(visibleText).join("")||""
}
export function fabricationContexts(html:string){const text=visibleText(parseHtml(html));return Object.fromEntries(fabrications.filter(word=>text.includes(word)).map(word=>[word,[...text.matchAll(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"g"))].map(match=>text.slice(Math.max(0,match.index-70),match.index+word.length+50).replace(/\n/g," "))]))}
function summarizeHtml(path:string,root:string){const text=readFileSync(path,"utf8"),first=text.match(/<section[^>]*id="what"[\s\S]*?<\/section>/)?.[0];return {validator:validate(path,root),sections:[...text.matchAll(/<section[^>]*id="([^"]+)"/g)].map(m=>m[1]),questions:[...text.matchAll(/data-question="([^"]+)"/g)].map(m=>m[1]),first_view_figures:first?(first.match(/<figure/g)||[]).length:null,fabrication_contexts:fabricationContexts(text)}}
function summarizeModel(path:string){const model=JSON.parse(readFileSync(path,"utf8"));return {audience:model.audience?.profile,source_revision:model.source?.revision,unknowns:model.unknowns?.length||0,evidence:model.evidence?.length||0,decision_rationale_status:(model.decisions||[]).map((d:{rationale?:{status?:string}})=>d.rationale?.status||"not-an-object")}}
export function checkOutputs(run:string){const report:Record<string,unknown>={}
  for(const c of ["a","b","d"]){const root=join(run,`case-${c}`),htmls=files(root).filter(p=>p.endsWith(".html")&&basename(p)!=="architecture.html").sort(),models=files(root).filter(p=>p.endsWith("explanation-model.json")).sort();report[c]={source_changes:changedSource(root),models:Object.fromEntries(models.map(p=>[relative(root,p),summarizeModel(p)])),html:Object.fromEntries(htmls.map(p=>[relative(root,p),summarizeHtml(p,root)]))}}
  const root=join(run,"case-c"),review=join(root,"review.md"),text=existsSync(review)?readFileSync(review,"utf8"):""
  report.c={source_changes:changedSource(root),review_found:Object.fromEntries(Object.entries(reviewFindings).map(([key,re])=>[key,re.test(text)])),hard_gates_listed:[1,2,3,4,5,6,7].every(n=>text.includes(`G${n}`)),prioritized_fixes:text.includes("blocker"),cited_source_files:[...new Set([...text.matchAll(/app\/[\w/]+\.py/g)].map(m=>m[0]))].sort()}
  return report
}
if(import.meta.main){if(!process.argv[2])throw new Error("usage: bun check-outputs.ts <run-dir>");console.log(JSON.stringify(checkOutputs(resolve(process.argv[2])),null,2))}
