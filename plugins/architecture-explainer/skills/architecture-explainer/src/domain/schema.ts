import Ajv from "ajv"
import modelSchema from "../../schemas/explanation-model.schema.json"
import presentationSchema from "../../schemas/presentation.schema.json"
import type { ExplanationModel } from "./explanation-model"
import type { Presentation } from "./presentation"

const ajv = new Ajv({ allErrors: true, strict: false })
const modelValidator = ajv.compile(modelSchema)
const presentationValidator = ajv.compile(presentationSchema)
export function parseModel(value: unknown): ExplanationModel {
  if (!modelValidator(value)) throw new Error(`Explanation Model schema: ${ajv.errorsText(modelValidator.errors)}`)
  return value as ExplanationModel
}
export function parsePresentation(value: unknown): Presentation {
  if (!presentationValidator(value)) throw new Error(`Presentation schema: ${ajv.errorsText(presentationValidator.errors)}`)
  return value as Presentation
}
