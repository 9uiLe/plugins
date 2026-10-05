import * as parse5 from "parse5"
import type { Findings } from "../domain/evidence"

export type HtmlNode = { tagName?:string; attrs?:{name:string;value:string}[]; childNodes?:HtmlNode[]; parentNode?:HtmlNode; value?:string; sourceCodeLocation?:{startLine:number;endTag?:unknown} }
export function parseHtml(html:string):HtmlNode { return parse5.parse(html,{sourceCodeLocationInfo:true}) as HtmlNode }
export function walk(node:HtmlNode,visit:(node:HtmlNode)=>void):void { visit(node); for(const child of node.childNodes||[]) walk(child,visit) }
export function attr(node:HtmlNode,name:string):string { return node.attrs?.find(item=>item.name===name)?.value||"" }
export function hasAttr(node:HtmlNode,name:string):boolean { return !!node.attrs?.some(item=>item.name===name) }
export function line(node:HtmlNode):number|undefined { return node.sourceCodeLocation?.startLine }
export function textContent(node:HtmlNode):string { return node.value||node.childNodes?.map(textContent).join("")||"" }
export function descendants(node:HtmlNode,tag:string):HtmlNode[] { const found:HtmlNode[]=[];walk(node,n=>{if(n.tagName===tag)found.push(n)});return found }
export function ancestors(node:HtmlNode):HtmlNode[] {const result:HtmlNode[]=[];let p=node.parentNode;while(p){result.push(p);p=p.parentNode}return result}
export function hasClass(node:HtmlNode,name:string):boolean {return attr(node,"class").split(/\s+/).includes(name)}
function missingBreak(node:HtmlNode,kind:"file"|"symbol"):boolean {
  const children=node.childNodes||[],pattern=kind==="file"?/\//g:/::|\.|_/g
  for(let i=0;i<children.length;i++){
    const child=children[i];if(child.value===undefined)continue
    for(const match of child.value.matchAll(pattern)){
      const end=(match.index||0)+match[0].length
      if(end<child.value.length||children[i+1]?.tagName!=="wbr")return true
    }
  }
  return false
}

const voidTags=new Set(["area","base","br","col","embed","hr","img","input","link","meta","source","track","wbr"])
const optionalEnd=new Set(["html","head","body","p","li","dt","dd","tr","td","th","thead","tbody","tfoot","caption","colgroup","option","optgroup","rt","rp"])
const cssUrl=/(?:@import\s+(?:url\()?|url\()\s*['"]?([^'")\s]+)/gi
export type HtmlFacts={nodes:HtmlNode[];figures:HtmlNode[];codeRefs:HtmlNode[];concepts:HtmlNode[];prose:HtmlNode[];arrowLabels:{value:string;line?:number}[];responsibilities:HtmlNode[];stats:{figures:number;code_refs:number;evidence_markers:Record<string,number>;headings:number}}
export function checkHtml(html:string,findings:Findings):HtmlFacts {
  const root=parseHtml(html),nodes:HtmlNode[]=[],ids=new Map<string,number[]>(),anchors:{id:string;line?:number}[]=[],aria:{id:string;name:string;line?:number}[]=[]
  const figures:HtmlNode[]=[],codeRefs:HtmlNode[]=[],concepts:HtmlNode[]=[],prose:HtmlNode[]=[],responsibilities:HtmlNode[]=[],arrowLabels:{value:string;line?:number}[]=[],headings:{level:number;line?:number}[]=[]
  const evidenceMarkers:Record<string,number>={observed:0,inferred:0,unknown:0}
  const backedMarkers:{ids:string[];line?:number}[]=[]
  walk(root,node=>{
    const tag=node.tagName;if(!tag)return;nodes.push(node)
    const id=attr(node,"id");if(id)ids.set(id,[...(ids.get(id)||[]),line(node)||0])
    const href=attr(node,"href");if(href.startsWith("#")&&href.length>1)anchors.push({id:href.slice(1),line:line(node)})
    for(const name of ["aria-labelledby","aria-describedby"])for(const target of attr(node,name).split(/\s+/).filter(Boolean))aria.push({id:target,name,line:line(node)})
    if(tag==="figure")figures.push(node)
    if(tag==="h1"||/^h[2-6]$/.test(tag))headings.push({level:Number(tag[1]),line:line(node)})
    if(tag==="img"&&!hasAttr(node,"alt"))findings.errors.push({code:"img-alt",message:"<img> has no alt attribute",line:line(node)})
    if(tag==="svg"&&attr(node,"aria-hidden")!=="true"&&!attr(node,"aria-label")&&!attr(node,"aria-labelledby")&&!descendants(node,"title").length)findings.errors.push({code:"svg-label",message:"<svg> needs a label",line:line(node)})
    if(tag==="svg"&&ancestors(node).some(n=>n.tagName==="figure")&&!hasAttr(node,"width"))findings.warnings.push({code:"svg-width",message:"SVG in figure needs a width for mobile scrolling",line:line(node)})
    if(tag==="table"&&!ancestors(node).some(n=>n.tagName==="figure"||hasClass(n,"table-wrap")))findings.warnings.push({code:"table-scroll",message:"table may overflow on narrow screens",line:line(node)})
    if(hasAttr(node,"data-file"))codeRefs.push(node)
    if(hasAttr(node,"data-concept"))concepts.push(node)
    if(hasAttr(node,"data-responsibility"))responsibilities.push(node)
    if((tag==="p"||tag==="li")&&ancestors(node).some(n=>n.tagName==="main"))prose.push(node)
    if(hasClass(node,"arrow-label"))arrowLabels.push({value:textContent(node).trim(),line:line(node)})
    if(hasAttr(node,"data-arrow-label"))arrowLabels.push({value:attr(node,"data-arrow-label").trim(),line:line(node)})
    if(hasAttr(node,"data-evidence")){const status=attr(node,"data-evidence");if(status in evidenceMarkers)evidenceMarkers[status]++;else findings.errors.push({code:"evidence-value",message:`invalid data-evidence: ${status}`,line:line(node)})}
    if(hasAttr(node,"data-evidence-backed")){
      if(attr(node,"data-evidence-backed")!=="true")findings.errors.push({code:"evidence-backed-value",message:'data-evidence-backed must be "true"',line:line(node)})
      if(hasAttr(node,"data-evidence"))findings.errors.push({code:"evidence-kind-conflict",message:"semantic status and structural evidence cannot share an element",line:line(node)})
      const refs=attr(node,"data-evidence-ids").split(/\s+/).filter(Boolean)
      if(!refs.length)findings.errors.push({code:"evidence-backed-ids",message:"evidence-backed structure needs evidence IDs",line:line(node)})
      backedMarkers.push({ids:refs,line:line(node)})
    }
    if(attr(node,"data-kind")==="data"&&hasAttr(node,"data-evidence"))findings.errors.push({code:"evidence-kind-conflict",message:"Data is not a semantic Claim",line:line(node)})
    if(tag==="script"&&attr(node,"src")&&!attr(node,"src").startsWith("data:"))findings.errors.push({code:"external-script",message:"external script is not standalone",line:line(node)})
    if(tag==="link"&&/stylesheet|preload|modulepreload/.test(attr(node,"rel"))&&attr(node,"href")&&!attr(node,"href").startsWith("data:"))findings.errors.push({code:"external-stylesheet",message:"external stylesheet is not standalone",line:line(node)})
    if(["img","source","iframe","embed","object","video","audio"].includes(tag)){const src=attr(node,"src")||attr(node,"data");if(src&&!src.startsWith("data:"))findings.warnings.push({code:/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(src)?"external-media":"relative-media",message:`media ${src} is not standalone`,line:line(node)})}
    if(tag==="style"||hasAttr(node,"style")){const body=tag==="style"?textContent(node):attr(node,"style");for(const match of body.matchAll(cssUrl))if(!match[1].startsWith("data:"))findings.errors.push({code:"external-css-url",message:`CSS loads ${match[1]}`,line:line(node)})}
    const handlers=node.attrs?.filter(item=>item.name.startsWith("on"))||[];if(handlers.length&&!new Set(["a","button","input","select","textarea","summary","option","label","form","body","html","details","dialog"]).has(tag))findings.errors.push({code:"non-interactive-handler",message:`<${tag}> has handler without keyboard semantics`,line:line(node)})
    if(Number(attr(node,"tabindex"))>0) findings.warnings.push({code:"positive-tabindex",message:"positive tabindex changes focus order",line:line(node)})
    if(node.sourceCodeLocation&&!node.sourceCodeLocation.endTag&&!voidTags.has(tag)&&!optionalEnd.has(tag))findings.warnings.push({code:"unclosed-element",message:`<${tag}> has no closing tag`,line:line(node)})
  })
  const htmlNode=nodes.find(n=>n.tagName==="html"), meta=nodes.filter(n=>n.tagName==="meta")
  if(!htmlNode||!attr(htmlNode,"lang"))findings.errors.push({code:"html-lang",message:"<html> needs lang"})
  if(!meta.some(n=>hasAttr(n,"charset")||attr(n,"http-equiv").toLowerCase()==="content-type"))findings.errors.push({code:"meta-charset",message:"missing meta charset"})
  if(!meta.some(n=>attr(n,"name").toLowerCase()==="viewport"))findings.errors.push({code:"meta-viewport",message:"missing viewport"})
  if(!nodes.some(n=>n.tagName==="title"&&!ancestors(n).some(a=>a.tagName==="svg")&&textContent(n).trim()))findings.errors.push({code:"title",message:"missing title"})
  const h1Count=headings.filter(h=>h.level===1).length;if(h1Count!==1)findings.errors.push({code:"h1-count",message:`expected one h1, found ${h1Count}`})
  headings.forEach((h,i)=>{if(i&&h.level>headings[i-1].level+1)findings.warnings.push({code:"heading-skip",message:`heading jumps to h${h.level}`,line:h.line})})
  for(const [id,lines] of ids)if(lines.length>1)findings.errors.push({code:"duplicate-id",message:`id ${id} appears ${lines.length} times`,line:lines[1]})
  for(const ref of anchors)if(!ids.has(ref.id))findings.errors.push({code:"broken-anchor",message:`#${ref.id} does not exist`,line:ref.line})
  for(const ref of aria)if(!ids.has(ref.id))findings.errors.push({code:"broken-aria-ref",message:`${ref.name} ${ref.id} does not exist`,line:ref.line})
  for(const marker of backedMarkers)for(const ref of marker.ids)if(!ids.has(`source-${ref}`))findings.errors.push({code:"evidence-backed-ref",message:`evidence-backed marker references missing ${ref}`,line:marker.line})
  for(const figure of figures){const q=attr(figure,"data-question");if(!q.trim())findings.errors.push({code:"figure-question",message:"figure needs reader question",line:line(figure)});if(!descendants(figure,"figcaption").length)findings.errors.push({code:"figure-caption",message:"figure needs caption",line:line(figure)});const count=nodes.filter(n=>hasClass(n,"node")&&ancestors(n).includes(figure)).length;if(count>9)findings.warnings.push({code:"figure-density",message:`figure has ${count} nodes`,line:line(figure)})}
  if(figures.filter(f=>ancestors(f).some(n=>attr(n,"id")==="what"||hasClass(n,"first-view"))).length>1)findings.warnings.push({code:"first-view-figures",message:"first view has more than one figure"})
  for(const table of nodes.filter(n=>n.tagName==="table"&&hasClass(n,"codemap"))){if(descendants(table,"td").some(n=>!attr(n,"data-label")))findings.warnings.push({code:"codemap-label",message:"code map cell needs data-label",line:line(table)});if(!nodes.some(n=>ancestors(n).includes(table)&&hasClass(n,"src-file")))findings.warnings.push({code:"codemap-source",message:"code map has no file column",line:line(table)});if(nodes.some(n=>ancestors(n).includes(table)&&(hasClass(n,"src-file")&&missingBreak(n,"file")||hasClass(n,"src-symbol")&&missingBreak(n,"symbol"))))findings.warnings.push({code:"codemap-break",message:"code map identifier needs wrap opportunities",line:line(table)})}
  const openTags:string[]=[]
  for(const token of html.matchAll(/<!--[^]*?-->|<![^>]*>|<\/?([a-z][a-z0-9:-]*)\b[^>]*>/gi)){
    const tag=token[1]?.toLowerCase();if(!tag)continue
    if(token[0].startsWith("</")){
      const at=openTags.lastIndexOf(tag)
      if(at<0&&!optionalEnd.has(tag))findings.warnings.push({code:"stray-end-tag",message:`</${tag}> has no matching open element`,line:html.slice(0,token.index).split("\n").length})
      if(at>=0)openTags.splice(at)
    } else if(!voidTags.has(tag)&&!token[0].endsWith("/>"))openTags.push(tag)
  }
  if(!Object.values(evidenceMarkers).some(Boolean))findings.warnings.push({code:"no-evidence-markers",message:"no data-evidence markers"})
  if(!codeRefs.length)findings.warnings.push({code:"no-code-refs",message:"no data-file code references"})
  return {nodes,figures,codeRefs,concepts,prose,arrowLabels,responsibilities,stats:{figures:figures.length,code_refs:codeRefs.length,evidence_markers:evidenceMarkers,headings:headings.length}}
}
