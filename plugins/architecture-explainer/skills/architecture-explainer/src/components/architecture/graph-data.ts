import type { Actor, Component, DataItem, ExternalSystem } from "../../domain/explanation-model"
import type { PresentationSection } from "../../domain/presentation"
import type { GraphEdge, GraphNode } from "../../renderer/layout/graph"
import { assertEvidenceBacked, RenderState } from "./common"

type GraphSection = Extract<PresentationSection, { type: "system_context" | "component_map" | "data_flow" }>

export function graphData(section:GraphSection,state:RenderState):{nodes:GraphNode[];edges:GraphEdge[]} {
  const nodes:GraphNode[]=[],edges:GraphEdge[]=[]
  if(section.type==="system_context"){
    nodes.push({id:"__subject",label:state.model.subject.title,kind:"system"})
    for(const id of section.sources){
      const source=state.sources.get(id)!
      if(source.kind==="actor"){
        const item=source.value as Actor
        if(!item.role.trim())throw new Error(`actor ${id} needs a role for system context`)
        nodes.push({id,label:state.name(id),concept:id,kind:"actor",detail:item.role,status:item.status,evidence:item.evidence})
        edges.push({from:id,to:"__subject",label:item.role})
      }else{
        const item=source.value as ExternalSystem
        if(!item.interaction.trim())throw new Error(`external system ${id} needs an interaction for system context`)
        nodes.push({id,label:state.name(id),concept:id,kind:"external",detail:item.interaction,status:item.status,evidence:item.evidence})
        edges.push({from:"__subject",to:id,label:item.interaction})
      }
    }
  }else if(section.type==="component_map"){
    for(const id of section.sources){const item=state.get<Component>(id);nodes.push({id,label:state.name(id),concept:id,kind:"component",detail:item.responsibility,status:item.status,evidence:item.evidence})}
    const ids=new Set(section.sources)
    for(const id of section.sources)for(const edge of state.get<Component>(id).depends_on)if(ids.has(edge.target)){
      if(!edge.meaning.trim())throw new Error(`component dependency ${id} → ${edge.target} needs a meaning`)
      edges.push({from:id,to:edge.target,label:edge.meaning})
    }
  }else{
    for(const id of section.sources){
      const item=state.get<DataItem>(id),name=state.name(id)
      assertEvidenceBacked(item.evidence,state)
      nodes.push({id,label:name,concept:id,kind:"data",detail:item.stored_in,evidenceBacked:true,evidence:item.evidence})
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
