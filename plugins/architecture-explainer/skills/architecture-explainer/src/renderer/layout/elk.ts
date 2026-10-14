import ElkConstructor, { type ELK, type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk-api.js"

type WorkerClass = new () => Worker
let workerClass: WorkerClass | undefined
let elk: ELK | undefined

// Bun defines a global `self`, so elk-worker takes its Web Worker branch and exports nothing.
// Hiding `self` while the module first initializes makes it export the in-process FakeWorker.
function fakeWorker(): WorkerClass {
  if (workerClass) return workerClass
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "self")
  if (descriptor) delete (globalThis as { self?: unknown }).self
  try { workerClass = require("elkjs/lib/elk-worker.min.js").Worker as WorkerClass }
  finally { if (descriptor) Object.defineProperty(globalThis, "self", descriptor) }
  if (typeof workerClass !== "function") throw new Error("elkjs did not expose its in-process worker")
  return workerClass
}

export type ElkGraph = ElkNode & { edges: ElkExtendedEdge[] }
export async function elkLayout(graph: ElkGraph): Promise<ElkGraph> {
  elk ??= new ElkConstructor({ workerFactory: () => new (fakeWorker())() })
  try { return await elk.layout(graph) as ElkGraph }
  catch (error) { throw new Error(`graph layout failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`) }
}
