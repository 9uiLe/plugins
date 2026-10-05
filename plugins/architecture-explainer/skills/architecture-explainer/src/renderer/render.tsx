import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import css from "./generated.css" with { type: "text" }
import type { ExplanationModel } from "../domain/explanation-model"
import type { Presentation } from "../domain/presentation"
import { assertModel } from "../domain/evidence"
import { checkPresentation } from "../domain/presentation"
import { Document } from "./document"

export function render(model:ExplanationModel,presentation:Presentation):string {
  assertModel(model)
  checkPresentation(presentation,model)
  return "<!doctype html>\n"+renderToStaticMarkup(<Document model={model} presentation={presentation} css={css}/>) + "\n"
}
