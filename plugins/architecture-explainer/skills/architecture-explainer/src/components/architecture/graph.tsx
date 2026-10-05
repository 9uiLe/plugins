import React from "react"
import { layoutGraph, type GraphEdge, type GraphNode } from "../../renderer/layout/graph"

export function ArchitectureGraph({id,question,caption,nodes,edges}:{id:string;question:string;caption:string;nodes:GraphNode[];edges:GraphEdge[]}) {
  const graph=layoutGraph(nodes,edges), titleId=`svg-${id}-title`, markerId=`arrow-${id}`
  return <svg className="graph" viewBox={`0 0 ${graph.width} ${graph.height}`} width={graph.width} role="img" aria-labelledby={titleId}>
    <title id={titleId}>{question}</title><desc>{caption}</desc>
    <defs><marker id={markerId} markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><path d="M0 0 L9 3.5 L0 7 Z" fill="var(--muted-foreground)"/></marker></defs>
    {graph.edges.map((edge,i)=><g key={`${edge.from}-${edge.to}-${i}`}>
      <polyline className="graph-edge" points={edge.points.map(point=>`${point.x},${point.y}`).join(" ")} markerEnd={`url(#${markerId})`}/>
      <rect className="graph-label-bg" x={edge.x-edge.width/2} y={edge.y-edge.height/2} width={edge.width} height={edge.height} rx="4"/>
      <text className="graph-edge-text arrow-label" x={edge.x} y={edge.y-(edge.lines.length-1)*8} textAnchor="middle">{edge.lines.map((line,j)=><tspan key={j} x={edge.x} dy={j?17:0}>{line}</tspan>)}</text>
    </g>)}
    {graph.nodes.map(node=><g key={node.id} className="node" data-kind={node.kind} data-evidence={node.status} data-evidence-ids={node.evidence?.join(" ")}>
      <title data-concept={node.concept}>{node.label}</title>
      <rect className={`graph-node ${node.kind}`} x={node.x-node.width/2} y={node.y-node.height/2} width={node.width} height={node.height} rx={node.kind==="actor"?28:10}/>
      {node.kind==="data"&&<line x1={node.x-node.width/2+6} x2={node.x+node.width/2-6} y1={node.y-node.height/2+6} y2={node.y-node.height/2+6} stroke="var(--architecture-data)"/>}
      <text className="graph-text" x={node.x} y={node.y-node.height/2+25} textAnchor="middle">{node.lines.map((line,i)=><tspan key={i} x={node.x} dy={i?20:0}>{line}</tspan>)}{node.detailLines.map((line,i)=><tspan key={`d${i}`} x={node.x} dy="18" fontSize="11">{line}</tspan>)}</text>
    </g>)}
  </svg>
}
