import React from "react"
import type { Annotation, Evidence, Reference } from "../../domain/explanation-model"
import type { ExcerptLine } from "../../renderer/source"
import { breakPath, breakSymbol, RenderState } from "./common"

const kindLabels: Partial<Record<Evidence["kind"], string>> = { test: "テスト", doc: "文書", config: "設定", commit: "コミット", diff: "差分", issue: "Issue" }
const context = 1, mergeGap = 2

export function codeAnchor(evidenceId:string):string { return `code-${evidenceId}` }
function range(item:Evidence):string { return item.line ? `:${item.line}${item.end_line && item.end_line!==item.line ? `–${item.end_line}` : ""}` : "" }

export function CodeHead({item}:{item:Evidence}) {
  const file=item.file||"", cut=file.lastIndexOf("/")+1
  return <div className="code-head">
    <span className="code-kind">{kindLabels[item.kind]??"コード"}</span>
    <a className="code-ref" href={`#${codeAnchor(item.id)}`} data-file={file||undefined} data-symbol={item.symbol||""} data-line={item.line||undefined} data-end-line={item.end_line||undefined}>
      <span className="code-path"><span className="code-dir">{breakPath(file.slice(0,cut))}</span><b>{file.slice(cut)||`根拠 ${item.id}`}</b></span><span className="code-range">{range(item)}</span>
    </a>
    {item.symbol&&<span className="code-symbol">{breakSymbol(item.symbol)}</span>}
  </div>
}

type Segment = { shown:boolean; lines:(ExcerptLine & { mark?:number; first?:boolean })[] }
function segments(lines:ExcerptLine[],item:Evidence):Segment[] {
  const marks=item.annotations??[]
  const marked=lines.map(line=>{const index=marks.findIndex(mark=>line.number>=mark.from&&line.number<=mark.to);return {...line,mark:index<0?undefined:index+1,first:index>=0&&marks[index].from===line.number}})
  const visible=marked.map(line=>!marks.length||marks.some(mark=>line.number>=mark.from-context&&line.number<=mark.to+context))
  for(let i=0;i<visible.length;){if(visible[i]){i++;continue}let j=i;while(j<visible.length&&!visible[j])j++;if(j-i<=mergeGap)for(let k=i;k<j;k++)visible[k]=true;i=j}
  const result:Segment[]=[]
  marked.forEach((line,i)=>{const last=result.at(-1);if(last&&last.shown===visible[i])last.lines.push(line);else result.push({shown:visible[i],lines:[line]})})
  return result
}
const tabWidth = 2
function indentColumns(text:string):number {
  let columns=0
  for(const char of text){if(char===" ")columns++;else if(char==="\t")columns+=tabWidth;else break}
  return columns
}
// Long lines wrap instead of scrolling. A hanging indent of (indentation + 2) columns aligns continuation lines under
// the code while the leading whitespace stays in the text, so copied code keeps its indentation. The CSS drops the
// alignment on narrow screens, where a deep indentation alone would be wider than the code column.
function CodeLine({line}:{line:Segment["lines"][number]}) {
  const hang=indentColumns(line.text)+2
  return <div className={line.mark?"code-line marked":"code-line"}><span className="code-gutter" aria-hidden="true">{line.first&&<b className="code-mark">{line.mark}</b>}<span>{line.number}</span></span><span className="code-text" style={{"--hang":`${hang}ch`} as React.CSSProperties}>{line.html===undefined?line.text:<span dangerouslySetInnerHTML={{__html:line.html}}/>}</span></div>
}

function CodeNote({mark}:{mark:Annotation}) {
  return <div className="code-note-inline"><span className="code-gutter" aria-hidden="true"/><span className="code-note-text"><span className="code-note-range">{mark.from===mark.to?`L${mark.from}`:`L${mark.from}–${mark.to}`}</span>{mark.text}</span></div>
}

export function CodeBlock({item,state,anchored=true}:{item:Evidence;state:RenderState;anchored?:boolean}) {
  const excerpt=state.excerpt(item.id), marks=item.annotations??[]
  const parts=excerpt?segments(excerpt.lines,item):[]
  // Each note follows the last line it explains, so the reader meets the explanation next to the code instead of in a list below the excerpt.
  const lines=(part:Segment)=>part.lines.map(line=><React.Fragment key={line.number}><CodeLine line={line}/>{marks.map((mark,i)=>mark.to===line.number&&<CodeNote key={i} mark={mark}/>)}</React.Fragment>)
  return <div className="code-block" id={anchored?codeAnchor(item.id):undefined} data-language={excerpt?.language}>
    <CodeHead item={item}/>
    {item.note&&<div className="code-note">{item.note}</div>}
    {excerpt&&<div className="code-body">{parts.map((part,i)=>part.shown
      ?<React.Fragment key={i}>{lines(part)}</React.Fragment>
      :<details key={i} className="code-fold"><summary>⋯ {i===0?"上":i===parts.length-1?"下":"間"}の {part.lines.length} 行を表示（L{part.lines[0].number}–{part.lines.at(-1)!.number}）</summary>{lines(part)}</details>)}</div>}
  </div>
}

function OfficialDocs({item,state}:{item:Evidence;state:RenderState}) {
  if(!item.references?.length)return null
  return <>{item.references.map(id=>{const doc=state.get<Reference>(id);return <p key={id} className="code-doc"><b>公式ドキュメント</b><a href={doc.url} rel="noreferrer">{doc.title}</a> ─ {doc.note}</p>})}</>
}

// A popover instead of a jump to the first excerpt keeps the reader at the current step while reading the code.
// The popover API opens and closes it without script; renderer/peek.client.js only places and moves it.
function SameCode({item,earlier,state}:{item:Evidence;earlier:string;state:RenderState}) {
  const peek=state.peekId(item.id), location=`${item.file||`根拠 ${item.id}`}${range(item)}${item.symbol?` ${item.symbol}`:""}`
  return <>
    <button type="button" className="same-code" popoverTarget={peek}><span><b>同じコード</b>{location} ─ {earlier}で説明</span><span className="same-code-open">コードを表示</span></button>
    <div id={peek} popover="auto" className="code-peek" role="dialog" aria-label={`同じコード ${location}`}>
      <div className="code-peek-bar"><button type="button" className="code-peek-handle" title="ドラッグか矢印キーで移動"><span className="code-peek-grip" aria-hidden="true">⠿</span><span><b>同じコード</b>{earlier}で説明</span></button><a href={`#${codeAnchor(item.id)}`}>説明の場所へ移動</a><button type="button" popoverTarget={peek} popoverTargetAction="hide">閉じる</button></div>
      <CodeBlock item={item} state={state} anchored={false}/>
    </div>
  </>
}

export function EvidenceCode({ids,state,where}:{ids:string[];state:RenderState;where:string}) {
  return <>{ids.map(id=>{
    const item=state.evidence.get(id); if(!item) throw new Error(`unresolved evidence: ${id}`)
    const earlier=state.shownAt(id)
    if(earlier)return <SameCode key={id} item={item} earlier={earlier} state={state}/>
    state.markShown(id,where)
    return <div key={id} className="evidence-code"><CodeBlock item={item} state={state}/><OfficialDocs item={item} state={state}/></div>
  })}</>
}

export function EvidenceRefs({ids,state,label="根拠"}:{ids:string[];state:RenderState;label?:string}) {
  if(!ids.length)return null
  return <p className="evidence-refs"><span>{label}</span>{ids.map(id=>{const item=state.evidence.get(id); if(!item) throw new Error(`unresolved evidence: ${id}`)
    const text=item.file?`${item.file.split("/").pop()}${range(item)}`:`根拠 ${item.id}`
    return state.hasCodeBlock(id)?<a key={id} href={`#${codeAnchor(id)}`} data-evidence-ref={id}>{text}</a>:<span key={id} data-evidence-ref={id}>{text}</span>})}</p>
}
