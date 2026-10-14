import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import css from "./generated.css" with { type: "text" }
import peekScript from "./peek.client.js" with { type: "text" }
import type { ExplanationModel } from "../domain/explanation-model"
import type { Presentation } from "../domain/presentation"
import { assertModel } from "../domain/evidence"
import { checkPresentation } from "../domain/presentation"
import { RenderState } from "../components/architecture/common"
import { graphData, isGraphSection } from "../components/architecture/graph-data"
import { layoutGraph, type GraphLayout } from "./layout/graph"
import { readExcerpts } from "./source"
import { Document } from "./document"

export async function render(model:ExplanationModel,presentation:Presentation,options:{sourceRoot?:string}={}):Promise<string> {
  assertModel(model)
  checkPresentation(presentation,model)
  const layouts=new Map<string,GraphLayout>()
  for(const section of presentation.sections)if(isGraphSection(section)){
    const {nodes,edges}=graphData(section,new RenderState(model))
    layouts.set(section.id,await layoutGraph(nodes,edges))
  }
  if(!options.sourceRoot&&presentation.sections.some(section=>section.type==="annotated_code"))throw new Error("annotated_code sections need --source-root to read code excerpts")
  const excerpts=options.sourceRoot?readExcerpts(model.evidence,options.sourceRoot):new Map()
  const page=(state:RenderState,script?:string)=>renderToStaticMarkup(<Document presentation={presentation} css={css} state={state} script={script}/>)
  // Evidence references may precede the code block they point to, so a first pass finds which evidence gets a code block.
  const draft=new RenderState(model,layouts,excerpts)
  page(draft)
  return "<!doctype html>\n"+page(new RenderState(model,layouts,excerpts,draft.shownIds()),draft.hasPeeks()?peekScript:undefined)+"\n"
}
