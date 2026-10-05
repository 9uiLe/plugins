import { expect, test } from "bun:test"
import { layoutGraph } from "../src/renderer/layout/graph"
import { measure, wrapLabel } from "../src/renderer/layout/text"

test("Japanese glyphs are wider than Latin identifiers",()=>{expect(measure("認証サービス")).toBeGreaterThan(measure("AuthSvc"))})
test("long mixed labels wrap within the node width",()=>{
  const label="認証サービス AuthService がセッションストア SessionStore の refresh token を回転する"
  const lines=wrapLabel(label,180)
  expect(lines.length).toBeGreaterThan(1)
  expect(lines.every(line=>measure(line)<=180)).toBe(true)
})
test("Dagre places nodes and labelled edges deterministically without node collisions",()=>{
  const nodes=["クライアント","認証サービス AuthService","セッションストア SessionStore","監査ログ"].map((label,i)=>({id:String(i),label,kind:"component" as const}))
  const edges=[{from:"0",to:"1",label:"refresh token を提示する"},{from:"1",to:"2",label:"token を回転する"},{from:"1",to:"3",label:"更新結果を記録する"}]
  const graph=layoutGraph(nodes,edges)
  expect(graph).toEqual(layoutGraph(nodes,edges))
  for(let i=0;i<graph.nodes.length;i++)for(let j=i+1;j<graph.nodes.length;j++){
    const a=graph.nodes[i],b=graph.nodes[j]
    expect(Math.abs(a.x-b.x)>=(a.width+b.width)/2 || Math.abs(a.y-b.y)>=(a.height+b.height)/2).toBe(true)
  }
  expect(graph.edges.every(e=>e.points.length>=2&&e.width>=measure(e.lines[0]))).toBe(true)
  for(const edge of graph.edges)for(const node of graph.nodes){
    const overlaps=Math.abs(edge.x-node.x)<(edge.width+node.width)/2&&Math.abs(edge.y-node.y)<(edge.height+node.height)/2
    expect(overlaps).toBe(false)
  }
})
test("missing graph endpoints fail before SVG rendering",()=>{expect(()=>layoutGraph([{id:"a",label:"A",kind:"actor"}],[{from:"a",to:"missing",label:"send"}])).toThrow("unknown graph endpoint")})
