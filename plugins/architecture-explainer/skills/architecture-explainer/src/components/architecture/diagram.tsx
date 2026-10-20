import React from "react"
import { baselines, font, labelBaselines } from "../../renderer/layout/diagram"

export function DiagramFrame({id,question,caption,width,height,children,role="img"}:{id:string;question:string;caption:string;width:number;height:number;children:React.ReactNode;role?:"img"|"group"}) {
  const titleId=`svg-${id}-title`
  return <svg className="diagram" viewBox={`0 0 ${width} ${height}`} width={width} role={role} aria-labelledby={titleId}>
    <title id={titleId}>{question}</title><desc>{caption}</desc>
    <defs><marker id={arrowId(id)} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.2" markerHeight="7.2" orient="auto-start-reverse"><path className="diagram-arrowhead" d="M0 0L10 5L0 10z"/></marker></defs>
    {children}
  </svg>
}
export function arrowId(id:string):string { return `${id}-arrow` }
export function Connector({id,points,className}:{id:string;points:{x:number;y:number}[];className?:string}) {
  return <polyline className={className?`diagram-edge ${className}`:"diagram-edge"} points={points.map(point=>`${point.x},${point.y}`).join(" ")} markerEnd={`url(#${arrowId(id)})`}/>
}
export function BoxText({x,y,nameLines,bodyLines,className}:{x:number;y:number;nameLines:string[];bodyLines:string[];className?:string}) {
  const lines=baselines(y,nameLines.length,bodyLines.length)
  return <>
    {nameLines.length>0&&<text className={className?`diagram-name ${className}`:"diagram-name"} textAnchor="middle" fontSize={font.name}>{nameLines.map((line,i)=><tspan key={i} x={x} y={lines.name[i]}>{line}</tspan>)}</text>}
    {bodyLines.length>0&&<text className="diagram-body" textAnchor="middle" fontSize={font.body}>{bodyLines.map((line,i)=><tspan key={i} x={x} y={lines.body[i]}>{line}</tspan>)}</text>}
  </>
}
export function Label({x,y,lines,anchor="middle",className}:{x:number;y:number;lines:string[];anchor?:"middle"|"start";className?:string}) {
  const ys=labelBaselines(y,lines.length)
  return <text className={className?`diagram-label ${className}`:"diagram-label"} textAnchor={anchor} fontSize={font.label}>{lines.map((line,i)=><tspan key={i} x={x} y={ys[i]}>{line}</tspan>)}</text>
}
