const referenceSize = 15
export function glyphWidth(char: string): number {
  if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|[\u3000-\u303f\uff00-\uffef]/u.test(char)) return 15
  if (/[il.,:;|!'`]/.test(char)) return 4
  if (/[MW@#%]/.test(char)) return 11
  return 8
}
export function measure(text: string, fontSize = referenceSize): number { return [...text].reduce((width, char) => width + glyphWidth(char), 0) * fontSize / referenceSize }
const noLineStart = "、。，．・：；！？）」』】〕ー々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ"
const tokenPattern = new RegExp(`\\n|[A-Za-z0-9_$.:/#-]+[${noLineStart}]*|.[${noLineStart}]*`, "gsu")
function tokens(text: string): string[] { return text.match(tokenPattern) || [] }
function splitToFit(token: string, maxWidth: number, fontSize: number): string[] {
  const parts: string[] = []
  let part = ""
  for (const char of token) {
    if (part && measure(part + char, fontSize) > maxWidth) { parts.push(part); part = "" }
    part += char
  }
  return part ? [...parts, part] : parts
}
function greedyWrap(text: string, maxWidth: number, fontSize: number): { lines: string[]; splits: number } {
  const lines: string[] = []
  let line = "", splits = 0
  for (const token of tokens(text)) {
    if (token === "\n") { lines.push(line); line = ""; continue }
    if (measure(line + token, fontSize) <= maxWidth) { line += token; continue }
    if (line.trim()) lines.push(line.trimEnd())
    line = ""
    if (token === " ") continue
    const parts = measure(token, fontSize) > maxWidth ? splitToFit(token, maxWidth, fontSize) : [token]
    splits += parts.length - 1
    lines.push(...parts.slice(0, -1))
    line = parts.at(-1) || ""
  }
  if (line) lines.push(line)
  return { lines: lines.length ? lines : [""], splits }
}
export function wrapLabel(text: string, maxWidth = 180, fontSize = referenceSize): string[] {
  const greedy = greedyWrap(text, maxWidth, fontSize)
  if (greedy.lines.length < 2 || text.includes("\n")) return greedy.lines
  let low = 0, high = maxWidth, best = greedy.lines
  while (high - low > 1) {
    const width = (low + high) / 2, candidate = greedyWrap(text, width, fontSize)
    if (candidate.lines.length === greedy.lines.length && candidate.splits <= greedy.splits) { high = width; best = candidate.lines } else low = width
  }
  return best
}
