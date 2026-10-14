import { readFileSync, realpathSync, statSync } from "node:fs"
import { resolve, sep } from "node:path"
import type { Evidence } from "../domain/explanation-model"
import { highlightLines } from "./highlight"

export type ExcerptLine = { number: number; text: string; html?: string }
export type Excerpt = { language?: string; lines: ExcerptLine[] }

function readLines(root: string, file: string): string[] {
  const base = realpathSync(root), path = resolve(base, file)
  if (!path.startsWith(base + sep)) throw new Error(`${file} points outside the source root`)
  const real = realpathSync(path)
  if (!real.startsWith(base + sep) || !statSync(real).isFile()) throw new Error(`${file} is not a file under the source root`)
  return readFileSync(real, "utf8").split(/\r?\n/)
}

export function readExcerpts(evidence: Evidence[], sourceRoot: string): Map<string, Excerpt> {
  if (!statSync(sourceRoot, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`source root is not a readable directory: ${sourceRoot}`)
  const excerpts = new Map<string, Excerpt>(), files = new Map<string, string[]>()
  for (const item of evidence) {
    if (!item.file || !item.line) continue
    const lines = files.get(item.file) ?? readLines(sourceRoot, item.file)
    files.set(item.file, lines)
    const last = item.end_line ?? item.line
    if (last > lines.length) throw new Error(`evidence ${item.id} reads ${item.file}:${item.line}-${last} but the file has ${lines.length} lines`)
    const text = lines.slice(item.line - 1, last), highlighted = highlightLines(item.file, text)
    excerpts.set(item.id, { language: highlighted?.language, lines: text.map((line, i) => ({ number: item.line! + i, text: line, html: highlighted?.lines[i] })) })
  }
  return excerpts
}
