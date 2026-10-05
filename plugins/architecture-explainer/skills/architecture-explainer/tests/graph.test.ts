import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { layoutGraph, type GraphEdge, type GraphNode } from "../src/renderer/layout/graph"
import { measure, wrapLabel } from "../src/renderer/layout/text"

test("Japanese glyphs are wider than Latin identifiers",()=>{expect(measure("認証サービス")).toBeGreaterThan(measure("AuthSvc"))})
test("long mixed labels wrap within the node width",()=>{
  const label="認証サービス AuthService がセッションストア SessionStore の refresh token を回転する"
  const lines=wrapLabel(label,180)
  expect(lines.length).toBeGreaterThan(1)
  expect(lines.every(line=>measure(line)<=180)).toBe(true)
})

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

for(const {name,nodes,edges} of cases)test(`${name} graph keeps layout invariants`,()=>{
  const graph=layoutGraph(nodes,edges)
  expect(graph).toEqual(layoutGraph(nodes,edges))
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
    for(const line of [...node.lines,...node.detailLines])expect(measure(line)).toBeLessThanOrEqual(node.width-28)
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
    for(const line of edge.lines)expect(measure(line)).toBeLessThanOrEqual(edge.width-14)
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
test("missing graph endpoints fail before SVG rendering",()=>{expect(()=>layoutGraph([{id:"a",label:"A",kind:"actor"}],[{from:"a",to:"missing",label:"send"}])).toThrow("unknown graph endpoint")})
test("duplicate graph node IDs fail instead of silently overwriting",()=>{
  expect(()=>layoutGraph([{id:"a",label:"A",kind:"actor"},{id:"a",label:"別の要素",kind:"actor"}],[])).toThrow("duplicate graph node ID")
})
