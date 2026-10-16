import { elkLayout, type ElkGraph } from "./elk"
import { frameWidth, labelBox, margin, textBox, type TextBox } from "./diagram"
import type { Status } from "../../domain/explanation-model"

type GraphNodeBase = { id: string; label: string; concept?:string; detail?: string; evidence?: string[] }
export type GraphNode = GraphNodeBase & ({ kind:"data"; evidenceBacked?:true; status?:never } | { kind:"system" | "component" | "external" | "actor"; status?:Status; evidenceBacked?:never })
export type GraphEdge = { from: string; to: string; label: string }
export type Point = { x:number; y:number }
export type PositionedNode = GraphNode & TextBox & Point
export type PositionedEdge = GraphEdge & Point & { points: Point[]; width: number; height: number; lines: string[] }
export type GraphLayout = { direction:"LR"|"TB"; width:number; height:number; nodes:PositionedNode[]; edges:PositionedEdge[] }

const nodeTextWidth = 196, minNodeWidth = 160, edgeLabelWidth = 132

export function nodeText(node: GraphNode): TextBox {
  const body = node.detail ? [node.detail] : []
  if (node.status === "inferred") body.push("推論")
  if (node.status === "unknown") body.push("? 不明")
  if (node.evidenceBacked) body.push("根拠あり")
  return textBox(node.label, body, nodeTextWidth, minNodeWidth)
}
export async function layoutGraph(nodes: GraphNode[], edges: GraphEdge[]): Promise<GraphLayout> {
  const ids = new Set<string>()
  for (const node of nodes) { if (ids.has(node.id)) throw new Error(`duplicate graph node ID: ${node.id}`); ids.add(node.id) }
  for (const edge of edges) if (!ids.has(edge.from) || !ids.has(edge.to)) throw new Error(`unknown graph endpoint: ${edge.from} → ${edge.to}`)
  const wide = await place(nodes, edges, "LR")
  if (wide.width <= frameWidth) return wide
  const tall = await place(nodes, edges, "TB")
  return tall.width < wide.width ? tall : wide
}
async function place(nodes: GraphNode[], edges: GraphEdge[], direction: "LR"|"TB"): Promise<GraphLayout> {
  const texts = nodes.map(nodeText), labels = edges.map(edge => labelBox(edge.label, edgeLabelWidth))
  const width = Math.max(...texts.map(text => text.width)), height = Math.max(...texts.map(text => text.height))
  const graph: ElkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction === "LR" ? "RIGHT" : "DOWN",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.spacing.nodeNode": "32",
      "elk.layered.spacing.nodeNodeBetweenLayers": "48",
      "elk.spacing.edgeNode": "16",
      "elk.layered.spacing.edgeNodeBetweenLayers": "16",
      "elk.spacing.edgeEdge": "12",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "12",
      "elk.spacing.edgeLabel": "8",
      "elk.edgeLabels.inline": "false",
      "elk.edgeLabels.placement": "CENTER",
      "elk.layered.edgeLabels.sideSelection": "ALWAYS_UP",
      "elk.padding": `[top=${margin},left=${margin},bottom=${margin},right=${margin}]`,
    },
    children: nodes.map(node => ({ id: node.id, width, height })),
    edges: edges.map((edge, i) => ({ id: `edge-${i}`, sources: [edge.from], targets: [edge.to], labels: [{ id: `label-${i}`, text: edge.label, width: labels[i].width, height: labels[i].height }] })),
  }
  const result = await elkLayout(graph)
  const placed = new Map((result.children || []).map(child => [child.id, child]))
  const positionedNodes = nodes.map((node, i) => {
    const child = placed.get(node.id)!
    return { ...node, ...texts[i], width, height, x: child.x! + width / 2, y: child.y! + height / 2 }
  })
  const positionedEdges = edges.map((edge, i) => {
    const routed = result.edges[i], label = routed.labels![0]
    const points = (routed.sections || []).flatMap(section => [section.startPoint, ...(section.bendPoints || []), section.endPoint]).map(({ x, y }) => ({ x, y }))
    return { ...edge, points, x: label.x! + labels[i].width / 2, y: label.y! + labels[i].height / 2, width: labels[i].width, height: labels[i].height, lines: labels[i].lines }
  })
  return { direction, width: Math.ceil(result.width || 1), height: Math.ceil(result.height || 1), nodes: positionedNodes, edges: positionedEdges }
}
