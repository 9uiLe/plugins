import dagre from "@dagrejs/dagre"
import { measure, wrapLabel } from "./text"
import type { Status } from "../../domain/explanation-model"

export type GraphNode = { id: string; label: string; concept?:string; detail?: string; kind: "system" | "component" | "external" | "actor" | "data"; status?: Status; evidence?: string[] }
export type GraphEdge = { from: string; to: string; label: string }
export type PositionedNode = GraphNode & { x: number; y: number; width: number; height: number; lines: string[]; detailLines: string[] }
export type PositionedEdge = GraphEdge & { points: {x:number;y:number}[]; x: number; y: number; width: number; height: number; lines: string[] }
export function layoutGraph(nodes: GraphNode[], edges: GraphEdge[]): { width:number; height:number; nodes:PositionedNode[]; edges:PositionedEdge[] } {
  const graph = new dagre.graphlib.Graph({ multigraph:true })
  graph.setGraph({ rankdir:"LR", nodesep:38, ranksep:100, marginx:24, marginy:24 })
  graph.setDefaultEdgeLabel(() => ({}))
  const lines = new Map<string,{title:string[]; detail:string[]}>()
  for (const node of nodes) {
    if(lines.has(node.id))throw new Error(`duplicate graph node ID: ${node.id}`)
    const title = wrapLabel(node.label, 176), detail = node.detail ? wrapLabel(node.detail, 176) : []
    if(node.status==="inferred")detail.push("推論")
    if(node.status==="unknown")detail.push("? 不明")
    const width = Math.max(170,Math.min(220,Math.max(...[...title,...detail].map(measure))+28))
    const height = Math.max(64,26+title.length*21+detail.length*18)
    lines.set(node.id,{title,detail})
    graph.setNode(node.id,{ width,height })
  }
  for (const [i,edge] of edges.entries()) {
    if (!graph.hasNode(edge.from) || !graph.hasNode(edge.to)) throw new Error(`unknown graph endpoint: ${edge.from} → ${edge.to}`)
    const labelLines = wrapLabel(edge.label, 116)
    graph.setEdge(edge.from,edge.to,{ width:Math.max(48,Math.max(...labelLines.map(measure))+14),height:labelLines.length*18+12 },String(i))
  }
  dagre.layout(graph)
  const positionedNodes = nodes.map(node => {
    const geometry = graph.node(node.id), text = lines.get(node.id)!
    return { ...node, x:geometry.x, y:geometry.y, width:geometry.width, height:geometry.height, lines:text.title, detailLines:text.detail }
  })
  const positionedEdges = edges.map((edge,i) => {
    const geometry = graph.edge({v:edge.from,w:edge.to,name:String(i)})
    return { ...edge, points:geometry.points, x:geometry.x, y:geometry.y, width:geometry.width, height:geometry.height, lines:wrapLabel(edge.label,116) }
  })
  return { width:Math.ceil(graph.graph().width || 1), height:Math.ceil(graph.graph().height || 1), nodes:positionedNodes, edges:positionedEdges }
}
