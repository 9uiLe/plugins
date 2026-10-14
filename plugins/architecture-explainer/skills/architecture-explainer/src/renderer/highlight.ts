import hljs from "highlight.js/lib/core"
import bash from "highlight.js/lib/languages/bash"
import c from "highlight.js/lib/languages/c"
import cpp from "highlight.js/lib/languages/cpp"
import csharp from "highlight.js/lib/languages/csharp"
import css from "highlight.js/lib/languages/css"
import go from "highlight.js/lib/languages/go"
import java from "highlight.js/lib/languages/java"
import javascript from "highlight.js/lib/languages/javascript"
import json from "highlight.js/lib/languages/json"
import kotlin from "highlight.js/lib/languages/kotlin"
import markdown from "highlight.js/lib/languages/markdown"
import php from "highlight.js/lib/languages/php"
import python from "highlight.js/lib/languages/python"
import ruby from "highlight.js/lib/languages/ruby"
import rust from "highlight.js/lib/languages/rust"
import sql from "highlight.js/lib/languages/sql"
import swift from "highlight.js/lib/languages/swift"
import typescript from "highlight.js/lib/languages/typescript"
import xml from "highlight.js/lib/languages/xml"
import yaml from "highlight.js/lib/languages/yaml"

const grammars = { bash, c, cpp, csharp, css, go, java, javascript, json, kotlin, markdown, php, python, ruby, rust, sql, swift, typescript, xml, yaml }
for (const [name, grammar] of Object.entries(grammars)) hljs.registerLanguage(name, grammar)

const byExtension: Record<string, keyof typeof grammars> = {
  sh: "bash", bash: "bash", zsh: "bash", c: "c", h: "c", cc: "cpp", cpp: "cpp", cxx: "cpp", hpp: "cpp", cs: "csharp", css: "css",
  go: "go", java: "java", js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript", json: "json", kt: "kotlin", kts: "kotlin",
  md: "markdown", php: "php", py: "python", rb: "ruby", rs: "rust", sql: "sql", swift: "swift", ts: "typescript", tsx: "typescript",
  mts: "typescript", cts: "typescript", html: "xml", xml: "xml", svg: "xml", yml: "yaml", yaml: "yaml",
}

// The highlighted HTML is inserted without React escaping, so only highlight.js's own output shape is accepted:
// escaped text and <span class="hljs-…"> / <span class="language-…"> (embedded languages) wrappers. Anything else falls back to plain, React-escaped text.
const token = /&(?:amp|lt|gt|quot|#x27);|<span class="(?:hljs-[a-z0-9_ -]+|language-[a-z0-9_-]+)">|<\/span>|\n|[^<>&\n]+/g
const accepted = /^(?:&(?:amp|lt|gt|quot|#x27);|<span class="(?:hljs-[a-z0-9_ -]+|language-[a-z0-9_-]+)">|<\/span>|\n|[^<>&\n])*$/

export function highlightLines(file: string, lines: string[]): { language: string; lines: string[] } | null {
  const language = byExtension[file.split(".").pop()?.toLowerCase() ?? ""]
  if (!language) return null
  const html = hljs.highlight(lines.join("\n"), { language, ignoreIllegals: true }).value
  if (!accepted.test(html)) return null
  const result: string[] = [], open: string[] = []
  let current = ""
  for (const [part] of html.matchAll(token)) {
    if (part === "\n") { result.push(current + "</span>".repeat(open.length)); current = open.join(""); continue }
    if (part.startsWith("<span")) open.push(part)
    else if (part === "</span>") open.pop()
    current += part
  }
  result.push(current)
  return result.length === lines.length ? { language, lines: result } : null
}
