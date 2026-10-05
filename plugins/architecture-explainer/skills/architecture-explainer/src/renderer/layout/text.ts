export function glyphWidth(char: string): number {
  if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|[\u3000-\u303f\uff00-\uffef]/u.test(char)) return 15
  if (/[il.,:;|!'`]/.test(char)) return 4
  if (/[MW@#%]/.test(char)) return 11
  return 8
}
export function measure(text: string): number { return [...text].reduce((width, char) => width + glyphWidth(char), 0) }
export function wrapLabel(text: string, maxWidth = 180): string[] {
  const lines: string[] = []
  let line = ""
  for (const char of text) {
    if (char === "\n" || (line && measure(line + char) > maxWidth)) { lines.push(line); line = "" }
    if (char !== "\n") line += char
  }
  if (line) lines.push(line)
  return lines.length ? lines : [""]
}
