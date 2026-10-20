import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { layoutGraph, type GraphEdge, type GraphNode } from "../src/renderer/layout/graph"
import { measure, wrapLabel } from "../src/renderer/layout/text"
import { bodyWidth, frameWidth, labelWidth, nameWidth } from "../src/renderer/layout/diagram"

test("Japanese glyphs are wider than Latin identifiers",()=>{expect(measure("認証サービス")).toBeGreaterThan(measure("AuthSvc"))})
test("long mixed labels wrap within the node width",()=>{
  const label="認証サービス AuthService がセッションストア SessionStore の refresh token を回転する"
  const lines=wrapLabel(label,180)
  expect(lines.length).toBeGreaterThan(1)
  expect(lines.every(line=>measure(line)<=180)).toBe(true)
})

const crossesLabel=(edge:{points:{x:number;y:number}[];x:number;y:number;width:number;height:number})=>edge.points.slice(1).some((end,i)=>{
  const start=edge.points[i]
  return Array.from({length:21},(_,k)=>({x:start.x+(end.x-start.x)*k/20,y:start.y+(end.y-start.y)*k/20})).some(point=>Math.abs(point.x-edge.x)<edge.width/2&&Math.abs(point.y-edge.y)<edge.height/2)
})
const insideNode=(point:{x:number;y:number},node:{x:number;y:number;width:number;height:number})=>Math.abs(point.x-node.x)<node.width/2-0.5&&Math.abs(point.y-node.y)<node.height/2-0.5
const samples=(points:{x:number;y:number}[])=>points.slice(1).flatMap((end,i)=>{const start=points[i];return Array.from({length:19},(_,k)=>({x:start.x+(end.x-start.x)*(k+1)/20,y:start.y+(end.y-start.y)*(k+1)/20}))})
const endpoints=(pairs:[string,string][]):GraphEdge[]=>pairs.map(([from,to])=>({from,to,label:`${from} から ${to} に渡す`}))
const cases:{name:string;nodes:GraphNode[];edges:GraphEdge[]}[]=[
  {name:"fan-out",nodes:["A","B","C"].map(id=>({id,label:id,kind:"component"})),edges:endpoints([["A","B"],["A","C"]])},
  {name:"fan-in",nodes:["A","B","C"].map(id=>({id,label:id,kind:"component"})),edges:endpoints([["B","A"],["C","A"]])},
  {name:"diamond",nodes:["A","B","C","D"].map(id=>({id,label:id,kind:"component"})),edges:endpoints([["A","B"],["A","C"],["B","D"],["C","D"]])},
  {name:"cycle",nodes:["A","B","C"].map(id=>({id,label:id,kind:"component"})),edges:endpoints([["A","B"],["B","C"],["C","A"]])},
  {name:"backward edge",nodes:["A","B","C","D"].map(id=>({id,label:id,kind:"component"})),edges:endpoints([["A","B"],["B","C"],["C","D"],["D","B"]])},
  {name:"long Japanese edge label",nodes:["A","B"].map(id=>({id,label:id,kind:"component"})),edges:[{from:"A",to:"B",label:"認証サービス AuthService がセッションストア SessionStore の refresh token を回転する"}]},
  {name:"long node labels",nodes:[
    {id:"jp",label:"非常に長い日本語の認証処理とセッション管理の責務を表す構成要素",detail:"条件に応じて利用者と外部システムの状態を確認する",kind:"component"},
    {id:"code",label:"ExtremelyLongAuthenticationServiceIdentifierWithNoSpaces",detail:"LongSessionStoreIdentifierWithNoSpaces",kind:"component"},
    {id:"mixed",label:"認証サービス AuthService と SessionStore の関係",detail:"refresh token を安全に回転する",kind:"component"}
  ],edges:endpoints([["jp","code"],["code","mixed"]])},
  {name:"one node without edges",nodes:[{id:"A",label:"単一のシステム",kind:"system"}],edges:[]},
  {name:"multiple nodes without edges",nodes:["A","B","C"].map(id=>({id,label:id,kind:"component"})),edges:[]},
  {name:"self-loop",nodes:[{id:"A",label:"再帰的な構成要素",kind:"component"}],edges:[{from:"A",to:"A",label:"自分へ通知する"}]},
  {name:"realistic architecture",...JSON.parse(readFileSync(resolve(import.meta.dir,"../../../tests/fixtures/presentation/architecture-graph.json"),"utf8"))}
]

for(const {name,nodes,edges} of cases)test(`${name} graph keeps layout invariants`,async()=>{
  const graph=await layoutGraph(nodes,edges)
  expect(graph).toEqual(await layoutGraph(nodes,edges))
  expect(graph.width).toBeGreaterThan(0)
  expect(graph.height).toBeGreaterThan(0)
  expect(new Set(graph.nodes.map(node=>node.id))).toEqual(new Set(nodes.map(node=>node.id)))
  expect(graph.edges.map(edge=>[edge.from,edge.to])).toEqual(edges.map(edge=>[edge.from,edge.to]))
  for(const node of graph.nodes){
    expect(node.width).toBeGreaterThan(0)
    expect(node.height).toBeGreaterThan(0)
    expect(node.x-node.width/2).toBeGreaterThanOrEqual(0)
    expect(node.x+node.width/2).toBeLessThanOrEqual(graph.width)
    expect(node.y-node.height/2).toBeGreaterThanOrEqual(0)
    expect(node.y+node.height/2).toBeLessThanOrEqual(graph.height)
    for(const line of node.nameLines)expect(nameWidth(line)).toBeLessThanOrEqual(node.width-24)
    for(const line of node.bodyLines)expect(bodyWidth(line)).toBeLessThanOrEqual(node.width-24)
  }
  for(let i=0;i<graph.nodes.length;i++)for(let j=i+1;j<graph.nodes.length;j++){
    const a=graph.nodes[i],b=graph.nodes[j]
    expect(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=(a.height+b.height)/2).toBe(true)
  }
  for(const edge of graph.edges){
    expect(edge.points.length).toBeGreaterThanOrEqual(2)
    expect(edge.width).toBeGreaterThan(0)
    expect(edge.height).toBeGreaterThan(0)
    expect(edge.x-edge.width/2).toBeGreaterThanOrEqual(0)
    expect(edge.x+edge.width/2).toBeLessThanOrEqual(graph.width)
    expect(edge.y-edge.height/2).toBeGreaterThanOrEqual(0)
    expect(edge.y+edge.height/2).toBeLessThanOrEqual(graph.height)
    for(const line of edge.lines)expect(labelWidth(line)).toBeLessThanOrEqual(edge.width)
    expect(crossesLabel(edge)).toBe(false)
    for(const [i,end] of edge.points.slice(1).entries())expect(Math.abs(end.x-edge.points[i].x)<0.01||Math.abs(end.y-edge.points[i].y)<0.01).toBe(true)
    for(const node of graph.nodes)for(const point of samples(edge.points))expect(insideNode(point,node)).toBe(false)
    for(const point of edge.points){expect(point.x).toBeGreaterThanOrEqual(0);expect(point.x).toBeLessThanOrEqual(graph.width);expect(point.y).toBeGreaterThanOrEqual(0);expect(point.y).toBeLessThanOrEqual(graph.height)}
    for(const node of graph.nodes){
      const overlaps=Math.abs(edge.x-node.x)<(edge.width+node.width)/2&&Math.abs(edge.y-node.y)<(edge.height+node.height)/2
      expect(overlaps).toBe(false)
    }
  }
  for(let i=0;i<graph.edges.length;i++)for(let j=i+1;j<graph.edges.length;j++){
    const a=graph.edges[i],b=graph.edges[j]
    expect(Math.abs(a.x-b.x)>=(a.width+b.width)/2||Math.abs(a.y-b.y)>=(a.height+b.height)/2).toBe(true)
  }
  if(name==="long Japanese edge label")expect(graph.edges[0].lines.length).toBeGreaterThan(1)
})
test("missing graph endpoints fail before SVG rendering",async()=>{await expect(layoutGraph([{id:"a",label:"A",kind:"actor"}],[{from:"a",to:"missing",label:"send"}])).rejects.toThrow("unknown graph endpoint")})
test("duplicate graph node IDs fail instead of silently overwriting",async()=>{
  await expect(layoutGraph([{id:"a",label:"A",kind:"actor"},{id:"a",label:"別の要素",kind:"actor"}],[])).rejects.toThrow("duplicate graph node ID")
})
test("boxes in one graph share one size so they line up",async()=>{
  const graph=await layoutGraph([{id:"a",label:"短い",kind:"component"},{id:"b",label:"とても長い名前を持つ構成要素",detail:"二行目の説明",kind:"component"}],endpoints([["a","b"]]))
  expect(new Set(graph.nodes.map(node=>`${node.width}x${node.height}`)).size).toBe(1)
})
test("a graph that fits the frame keeps left-to-right ranks",async()=>{
  const graph=await layoutGraph(["A","B"].map(id=>({id,label:id,kind:"component"})),endpoints([["A","B"]]))
  expect(graph.direction).toBe("LR")
  expect(graph.edges[0].y).toBeLessThan(graph.edges[0].points[0].y)
  expect(graph.width).toBeLessThanOrEqual(frameWidth)
})
test("a chain too wide for the frame grows downward instead",async()=>{
  const ids=["A","B","C","D","E","F"]
  const graph=await layoutGraph(ids.map(id=>({id,label:`構成要素 ${id}`,kind:"component"})),endpoints(ids.slice(1).map((id,i)=>[ids[i],id])))
  expect(graph.direction).toBe("TB")
  expect(graph.width).toBeLessThanOrEqual(frameWidth)
  for(const edge of graph.edges)expect(edge.x-edge.width/2).toBeGreaterThan(edge.points[0].x)
})
test("identifiers wrap at token boundaries when they fit on a line",()=>{
  expect(wrapLabel("セッション SessionStore._sessions を更新する",180)).toEqual(["セッション","SessionStore._sessions","を更新する"])
})
test("punctuation and small kana never start a wrapped line",()=>{
  for(const text of ["既存の Run を返し、二重に起動しない","準備後に設計・判断・Profile・コード状態が変わった","daemon の組み立て、IPC、CLI、MCP サーバーという外部との入口をまとめる。"])
    for(const width of [60,90,120,150])for(const line of wrapLabel(text,width,12).slice(1))expect(line).not.toMatch(/^[、。・ーっゃゅょ]/)
})
