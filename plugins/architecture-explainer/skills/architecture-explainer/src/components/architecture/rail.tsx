import React from "react"
import type { Status } from "../../domain/explanation-model"
import { RenderState, StatusLabel } from "./common"
import { EvidenceCode } from "./code"

export type RailKind = "start" | "step" | "process" | "transition" | "decision" | "state"
export type RailRowData = {
  id: string; kind: RailKind; num?: string; title: React.ReactNode; titleMono?: boolean
  text?: React.ReactNode; cond?: string; route?: React.ReactNode; edges?: React.ReactNode[]; orLabel?: string
  result?: string; note?: string; status?: Status; claimStatus?: React.ReactNode; emphasis?: boolean
  evidence?: string[]; backed?: boolean; where: string; hasNext?: boolean
}

export function Corners() { return <><i className="corner tl"/><i className="corner tr"/><i className="corner bl"/><i className="corner br"/></> }

function Marker({row}:{row:RailRowData}) {
  const line=row.status==="inferred"?" dashed":row.status==="unknown"?" dotted":""
  if(row.kind==="step"||row.kind==="process")return <span className={`rail-marker rail-num${line}${row.emphasis?" emphasis":""}`} aria-hidden="true">{row.num}</span>
  if(row.kind==="transition")return <span className={`rail-marker rail-transition${line}`} aria-hidden="true"><i/></span>
  if(row.kind==="decision")return <><span className={`rail-diamond${line}`} aria-hidden="true"/><span className="rail-arrow" aria-hidden="true"/></>
  return <span className={`rail-state-mark${row.emphasis?" emphasis":""}`} aria-hidden="true"/>
}

function evidenceAttrs(row:RailRowData) {
  if(!row.evidence?.length)return {}
  return row.backed?{"data-evidence-backed":"true","data-evidence-ids":row.evidence.join(" ")}:{"data-evidence":row.status}
}

function StepBody({row,state}:{row:RailRowData;state:RenderState}) {
  const code=row.evidence?.length?<div className="rail-code"><EvidenceCode ids={row.evidence} state={state} where={row.where}/></div>:null
  return <div className={`rail-card blueprint${row.status==="inferred"?" dashed":row.status==="unknown"?" dotted":""}${row.emphasis?" emphasis":""}`}>
    <Corners/>
    <div className="rail-meta">
      {row.orLabel&&<div className="rail-or">{row.orLabel}</div>}
      <h3 className={row.titleMono?"rail-title mono":"rail-title"}>{row.title}</h3>
      {row.route&&<div className={row.kind==="transition"?"rail-transition-route":"rail-route"}>{row.route}</div>}
      {row.text&&<p className="rail-text">{row.text}</p>}
      {row.cond&&<p className="rail-cond"><span>条件</span>{row.cond}</p>}
      {row.edges?.map((edge,i)=><div key={i} className="rail-route">{edge}</div>)}
      {row.claimStatus}
    </div>
    {code}
  </div>
}

function DecisionBody({row,state}:{row:RailRowData;state:RenderState}) {
  return <div className="rail-decision">
    <div className="rail-decision-head"><span className="rail-decision-label">分岐</span><h3 className="rail-title">{row.title}</h3></div>
    <div className="rail-branch">
      <div className="rail-branch-stub" aria-hidden="true"><span className="yes">はい</span><i className="stub-line"/><i className="stub-head"/><i className="stub-dot"/>{row.hasNext&&<><span className="no">いいえ</span><span className="next">↓ 次へ</span></>}</div>
      <div className={`rail-terminal blueprint${row.status==="inferred"?" dashed":row.status==="unknown"?" dotted":""}`}>
        <Corners/>
        <div className="rail-terminal-label"><i/>終点 ─ 次のステップへは進まない</div>
        <div className="rail-terminal-result"><span>{row.result}</span>{row.claimStatus}</div>
        {row.evidence?.length?<div className="rail-code"><EvidenceCode ids={row.evidence} state={state} where={row.where}/></div>:null}
      </div>
    </div>
  </div>
}

function StateBody({row}:{row:RailRowData}) {
  return <div className="rail-state">
    <span className={`rail-chip${row.emphasis?" blueprint emphasis":""}${row.status==="inferred"?" dashed":row.status==="unknown"?" dotted":""}`}>{row.emphasis&&<Corners/>}{row.title}</span>
    {row.text&&<span className="rail-state-text">{row.text}</span>}
    {row.note&&<span className="rail-state-note">─ {row.note}</span>}
  </div>
}

export function Rail({rows,state}:{rows:RailRowData[];state:RenderState}) {
  return <div className="rail">{rows.map((row,i)=><div key={row.id} id={row.id} className={`rail-row is-${row.kind}${i===0?" first":""}${i===rows.length-1?" last":""}`} {...evidenceAttrs(row)}>
    <div className="rail-track"><span className="rail-line"/><Marker row={row}/></div>
    <div className="rail-body">{row.kind==="decision"?<DecisionBody row={row} state={state}/>:row.kind==="state"||row.kind==="start"?<StateBody row={row}/>:<StepBody row={row} state={state}/>}</div>
  </div>)}</div>
}

export type OverviewStep = { href: string; num: string; title: string; status?: Status; emphasis?: boolean; exits: { href: string; result: string }[] }
export function FlowOverview({steps,label}:{steps:OverviewStep[];label:string}) {
  const columns=steps.flatMap((step,i)=>i<steps.length-1||step.exits.length?["minmax(0,1fr)","minmax(64px,112px)"]:["minmax(0,1fr)"])
  return <div className="flow-overview" role="group" aria-label={label}>
    <p className="flow-overview-note"><b>全体像</b>下の行を 1 枚に縮めた図。押すと該当の行へ移動する。</p>
    <div className="flow-overview-grid" style={{gridTemplateColumns:columns.join(" ")}}>
      {steps.map((step,i)=><React.Fragment key={step.href}>
        <a className="flow-node" href={step.href} style={{gridColumn:i*2+1,gridRow:1}}><span className={`rail-marker rail-num static${step.emphasis?" emphasis":""}`}>{step.num}</span><span>{step.title}</span><StatusLabel status={step.status??"observed"}/></a>
        {(i<steps.length-1||step.exits.length>0)&&<div className={step.exits.length?"flow-link decision":"flow-link"} style={{gridColumn:i*2+2,gridRow:1}} aria-hidden="true"><i className="fl-line"/>{step.exits.length>0&&<><i className="fl-diamond"/><i className="fl-down"/><span className="fl-no">いいえ</span></>}{i<steps.length-1&&<i className="fl-head"/>}</div>}
        {step.exits.length>0&&<><div className="flow-yes" style={{gridColumn:i*2+2,gridRow:2}} aria-hidden="true"><i className="fl-down"/><i className="fl-head-down"/><span>はい</span></div>
          <div className={i<steps.length-1?"flow-exits":"flow-exits trailing"} style={{gridColumn:i<steps.length-1?`${i*2+1} / span 3`:`${i*2+1} / span 2`,gridRow:3}}>{step.exits.map(exit=><a key={exit.href} className="flow-node terminal" href={exit.href}><i/><span><b>終点</b>{exit.result}</span></a>)}</div></>}
      </React.Fragment>)}
    </div>
  </div>
}

type StateName = { plain: string; node: React.ReactNode }
export type StateOverviewData = { states: { href: string; label: StateName }[]; links: { href: string; text: string }[][]; exits: { at: number; href: string; text: string; target: StateName }[] }
export function StateOverview({states,links,exits,label}:StateOverviewData&{label:string}) {
  const columns=states.flatMap((_,i)=>i<states.length-1?["minmax(0,1fr)","minmax(0,1fr)"]:["minmax(0,1fr)"])
  return <div className="flow-overview" role="group" aria-label={label}>
    <p className="flow-overview-note"><b>全体像</b>四角が状態、矢印が状態を変える操作。押すと該当の行へ移動する。</p>
    <div className="flow-overview-grid" style={{gridTemplateColumns:columns.join(" ")}}>
      {states.map((item,i)=><React.Fragment key={`${item.href}-${i}`}>
        <a className="flow-node state-node" href={item.href} style={{gridColumn:i*2+1,gridRow:1}}>{item.label.node}</a>
        {i<states.length-1&&<div className="state-link" style={{gridColumn:i*2+2,gridRow:1}}>{links[i].map((link,j)=><React.Fragment key={link.href}>{j>0&&<span className="state-or">または</span>}<a href={link.href}>{link.text}</a></React.Fragment>)}<i className="state-arrow" aria-hidden="true"/></div>}
      </React.Fragment>)}
      {exits.map(exit=><div key={exit.href} className="state-exit" style={{gridColumn:exit.at<states.length-1?`${exit.at*2+1} / span 2`:exit.at*2+1,gridRow:2}}>
        <i className="state-down" aria-hidden="true"/><a href={exit.href}>{exit.text}</a><span className="flow-node state-node state-end">{exit.target.node}</span>
      </div>)}
    </div>
  </div>
}
