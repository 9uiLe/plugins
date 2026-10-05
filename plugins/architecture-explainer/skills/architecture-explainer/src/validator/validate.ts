import { readFileSync, realpathSync, statSync } from "node:fs"
import { resolve, sep } from "node:path"
import type { ExplanationModel } from "../domain/explanation-model"
import { checkModel, emptyFindings, type Findings } from "../domain/evidence"
import { attr, checkHtml, line } from "./html"
import { checkJapanese } from "./japanese"

export type ValidationReport=Findings&{ok:boolean;stats:{figures:number;code_refs:number;evidence_markers:Record<string,number>;headings:number}}
function checkCodeRef(file:string,symbol:string,targetLine:string,lineNumber:number|undefined,root:string,findings:Findings):void {
  if(!file){findings.errors.push({code:"code-ref-file",message:"data-file is empty",line:lineNumber});return}
  const path=resolve(root,file)
  if(path!==root&&!path.startsWith(root+sep)){findings.errors.push({code:"code-ref-file",message:`${file} points outside source root`,line:lineNumber});return}
  let content:string
  try {if(!statSync(path).isFile()||!realpathSync(path).startsWith(root+sep))throw new Error("outside source root");content=readFileSync(path,"utf8")}
  catch {findings.errors.push({code:"code-ref-file",message:`${file} does not exist under source root`,line:lineNumber});return}
  for(const part of symbol.split(/\.|::|#|\//).filter(Boolean))if(!new RegExp(`(^|[^\\w$])${part.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}($|[^\\w$])`).test(content)){findings.errors.push({code:"code-ref-symbol",message:`${part} does not appear in ${file}`,line:lineNumber});break}
  if(targetLine&&(!/^\d+$/.test(targetLine)||Number(targetLine)<1||Number(targetLine)>content.split(/\r?\n/).length))findings.errors.push({code:"code-ref-line",message:`${targetLine} is outside ${file}`,line:lineNumber})
}
export function validateHtml(html:string,options:{model?:ExplanationModel;sourceRoot?:string}={}):ValidationReport {
  const findings=emptyFindings(),facts=checkHtml(html,findings)
  checkJapanese(facts,findings,options.model)
  if(options.model){const modelFindings=checkModel(options.model);findings.errors.push(...modelFindings.errors);findings.warnings.push(...modelFindings.warnings)}
  if(options.sourceRoot){const root=realpathSync(options.sourceRoot);for(const node of facts.codeRefs)checkCodeRef(attr(node,"data-file"),attr(node,"data-symbol"),attr(node,"data-line"),line(node),root,findings)}
  return {...findings,ok:findings.errors.length===0,stats:facts.stats}
}
