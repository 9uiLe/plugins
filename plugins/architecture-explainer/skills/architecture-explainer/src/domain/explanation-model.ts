export type Status = "observed" | "inferred" | "unknown"
export type Claim = { id?: string; status: Status; evidence: string[] }
export type CodeLocation = { file: string; symbol?: string; line?: number }
export type Entity = Claim & { id: string; name: string; role?: string; interaction?: string }
export type Component = Entity & { level: "system" | "container" | "module" | "class" | "function"; responsibility: string; depends_on: { target: string; meaning: string }[]; code_locations: CodeLocation[] }
export type Scenario = { id: string; name: string; trigger: string; steps: (Claim & { from: string; to: string; action: string })[]; exceptional_paths: (Claim & { at_step: number; condition: string; result: string })[] }
export type State = { id: string; owner: string; name: string; status?: Status; transitions: { event: string; guard: string; to: string; evidence: string[] }[] }
export type DataItem = { id: string; name: string; stored_in: string; written_by: string[]; read_by: string[]; evidence: string[] }
export type Decision = Claim & { id: string; context: string; decision: string; rationale: Claim & { text: string }; tradeoffs: string[]; alternatives: string[] }
export type Invariant = Claim & { id: string; description: string; enforced_by: string }
export type Change = { id: string; change: string; before: Claim & { id: string; behavior: string }; after: Claim & { id: string; behavior: string }; affected: { target: string; reason: string; evidence: string[] }[]; unaffected: { target: string; reason: string; evidence: string[] }[]; requires_verification: { target: string; reason: string }[] }
export type GlossaryEntry = { id: string; concept: string; preferred: string; code_terms: string[]; aliases: string[]; avoid: string[]; meaning: string; evidence: string[] }
export type Unknown = { id: string; about: string; question: string; reason: string; how_to_resolve: string }
export type Evidence = { id: string; kind: "code" | "test" | "doc" | "config" | "commit" | "diff" | "issue"; revision: string; file?: string; symbol?: string; line?: number; note?: string }
export type ExplanationModel = {
  subject: { title: string; question: string; scope: { in: string[]; out: string[] } }
  source: { root: string; revision: string; base_revision?: string; materials: string[] }
  audience: { profile: "newcomer" | "implementer" | "reviewer" | "architect" | "debugger"; familiarity: string; goal: string; inferred_from?: string }
  purpose: Claim & { problem: string; responsibility: string }
  context: { actors: Entity[]; external_systems: Entity[]; boundaries: { id: string; kind: string; contains: string[] }[] }
  components: Component[]; runtime_scenarios: Scenario[]; states: State[]; data: DataItem[];
  decisions: Decision[]; invariants: Invariant[]; change_impacts: Change[]; glossary: GlossaryEntry[];
  unknowns: Unknown[]; evidence: Evidence[]
}
export type ModelKind = "purpose" | "actor" | "external" | "component" | "scenario" | "state" | "data" | "decision" | "invariant" | "change" | "unknown" | "evidence"
export type ModelSource = { kind: ModelKind; value: unknown }
export function sourceIndex(model: ExplanationModel): Map<string, ModelSource> {
  const index = new Map<string, ModelSource>([["purpose", { kind: "purpose", value: model.purpose }]])
  const groups: [ModelKind, { id: string }[]][] = [
    ["actor", model.context.actors], ["external", model.context.external_systems], ["component", model.components],
    ["scenario", model.runtime_scenarios], ["state", model.states], ["data", model.data], ["decision", model.decisions],
    ["invariant", model.invariants], ["change", model.change_impacts], ["unknown", model.unknowns], ["evidence", model.evidence]
  ]
  for (const [kind, items] of groups) for (const value of items) {
    if (!value.id || index.has(value.id)) throw new Error(`missing or duplicate model ID: ${value.id}`)
    index.set(value.id, { kind, value })
  }
  return index
}
