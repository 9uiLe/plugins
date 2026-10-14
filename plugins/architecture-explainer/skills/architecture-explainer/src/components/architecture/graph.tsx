import React from "react"
import type { GraphLayout, GraphNode } from "../../renderer/layout/graph"
import { BoxText, Connector, DiagramFrame, Label } from "./diagram"

export function ArchitectureGraph({id,question,caption,graph}:{id:string;question:string;caption:string;graph:GraphLayout}) {
  return <DiagramFrame id={id} question={question} caption={caption} width={graph.width} height={graph.height}>
    {graph.edges.map((edge,i)=><Connector key={`${edge.from}-${edge.to}-${i}`} id={id} points={edge.points}/>)}
    {graph.edges.map((edge,i)=><Label key={`${edge.from}-${edge.to}-${i}`} className="arrow-label" x={edge.x} y={edge.y} lines={edge.lines}/>)}
    {graph.nodes.map(node=>{
      const left=node.x-node.width/2, top=node.y-node.height/2
      return <g key={node.id} className="node" data-kind={node.kind} data-evidence={node.status} data-evidence-backed={node.evidenceBacked?"true":undefined} data-evidence-ids={node.evidence?.join(" ")}>
        <title data-concept={node.concept}>{node.label}</title>
        <rect className={node.kind==="system"?"diagram-box accent":"diagram-box"} x={left} y={top} width={node.width} height={node.height} rx={node.kind==="actor"?node.height/2:0}/>
        {node.kind==="system"&&<path className="diagram-corner" d={[[left,top],[left+node.width,top],[left,top+node.height],[left+node.width,top+node.height]].map(([x,y])=>`M${x-5.5} ${y}h11M${x} ${y-5.5}v11`).join("")}/>}
        {node.kind==="data"&&<line className="diagram-rule" x1={left} x2={left+node.width} y1={top+6} y2={top+6}/>}
        <BoxText x={node.x} y={node.kind==="data"?node.y+3:node.y} nameLines={node.nameLines} bodyLines={node.bodyLines}/>
      </g>
    })}
  </DiagramFrame>
}
const kindNames:Record<GraphNode["kind"],string>={system:"対象",component:"構成要素",actor:"利用者",external:"外部",data:"データ"}
export function GraphLegend({kinds}:{kinds:GraphNode["kind"][]}) {
  return <p className="legend">凡例: {kinds.map(kind=><span key={kind} className="legend-item" data-kind={kind}><svg className="legend-swatch" width="28" height="16" viewBox="0 0 28 16" aria-hidden="true">
    <rect className={kind==="system"?"diagram-box accent":"diagram-box"} x="1" y="1" width="26" height="14" rx={kind==="actor"?7:0}/>
    {kind==="data"&&<line className="diagram-rule" x1="1" x2="27" y1="4" y2="4"/>}
  </svg>{kindNames[kind]}</span>)}</p>
}
