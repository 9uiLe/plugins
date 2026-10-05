import type { Component, DataItem, Entity } from "../../domain/explanation-model"
import type { PresentationSection } from "../../domain/presentation"
import type { GraphEdge, GraphNode } from "../../renderer/layout/graph"
import { evidencePresentationStatus, RenderState } from "./common"

type GraphSection = Extract<PresentationSection, { type: "system_context" | "component_map" | "data_flow" }>

export function graphData(section:GraphSection,state:RenderState):{nodes:GraphNode[];edges:GraphEdge[]} {
  const nodes:GraphNode[]=[],edges:GraphEdge[]=[]
  if(section.type==="system_context"){
    nodes.push({id:"__subject",label:state.model.subject.title,kind:"system"})
    for(const id of section.sources){
      const source=state.sources.get(id)!,item=source.value as Entity
      nodes.push({id,label:state.name(id),concept:id,kind:source.kind==="actor"?"actor":"external",detail:item.role||item.interaction,status:item.status,evidence:item.evidence})
      edges.push(source.kind==="actor"
        ? {from:id,to:"__subject",label:item.role||item.interaction||"接続する"}
        : {from:"__subject",to:id,label:item.role||item.interaction||"接続する"})
    }
  }else if(section.type==="component_map"){
    for(const id of section.sources){const item=state.get<Component>(id);nodes.push({id,label:state.name(id),concept:id,kind:"component",detail:item.responsibility,status:item.status,evidence:item.evidence})}
    const ids=new Set(section.sources)
    for(const id of section.sources)for(const edge of state.get<Component>(id).depends_on)if(ids.has(edge.target))edges.push({from:id,to:edge.target,label:edge.meaning})
  }else{
    for(const id of section.sources){
      const item=state.get<DataItem>(id),name=state.name(id)
      nodes.push({id,label:name,concept:id,kind:"data",detail:item.stored_in,status:evidencePresentationStatus(item.evidence,state),evidence:item.evidence})
      for(const writer of item.written_by)edges.push({from:writer,to:id,label:`${name}を書き込む`})
      for(const reader of item.read_by)edges.push({from:id,to:reader,label:`${name}を読み出す`})
    }
    const endpoints=new Set(edges.flatMap(edge=>[edge.from,edge.to]))
    for(const id of endpoints)if(!nodes.some(node=>node.id===id)){
      const item=state.get<Component>(id)
      nodes.push({id,label:state.name(id),concept:id,kind:"component",status:item.status,evidence:item.evidence})
    }
  }
  return {nodes,edges}
}
