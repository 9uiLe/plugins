import { measure, wrapLabel } from "./text"

// The page has no max width, so diagrams are fitted to the main column at the 1280px reference viewport:
// 1280 - .page padding (32 × 2) - .toc (210) - grid gap (40). Diagrams render at 1:1 so text never shrinks;
// a layout wider than this scrolls inside the figure.
export const frameWidth = 1280 - 2 * 32 - 210 - 40
export const margin = 24
export const font = { name: 14, body: 12.5, label: 12 } as const
const lineHeight = { name: 18, body: 16, label: 16 } as const
const padding = { x: 12, y: 14, gap: 4 } as const

export type TextBox = { width: number; height: number; nameLines: string[]; bodyLines: string[] }
export type PlacedBox = TextBox & { x: number; y: number }

export function nameWidth(text: string): number { return measure(text, font.name) * 1.05 }
export function bodyWidth(text: string): number { return measure(text, font.body) }
export function labelWidth(text: string): number { return measure(text, font.label) }

export function textBox(name: string, body: string[], textWidth: number, minWidth = 0): TextBox {
  const nameLines = name ? wrapLabel(name, textWidth / 1.05, font.name) : []
  const bodyLines = body.flatMap(line => wrapLabel(line, textWidth, font.body))
  const longest = Math.max(0, ...nameLines.map(nameWidth), ...bodyLines.map(bodyWidth))
  return { width: Math.ceil(Math.max(minWidth, longest + 2 * padding.x)), height: textHeight(nameLines.length, bodyLines.length) + 2 * padding.y, nameLines, bodyLines }
}
export function widen<T extends TextBox>(box: T, width: number): T { return { ...box, width: Math.max(box.width, width) } }
function textHeight(names: number, bodies: number): number { return names * lineHeight.name + (names && bodies ? padding.gap : 0) + bodies * lineHeight.body }
export function baselines(centerY: number, names: number, bodies: number): { name: number[]; body: number[] } {
  let y = centerY - textHeight(names, bodies) / 2
  const line = (height: number, size: number) => { const baseline = y + height / 2 + size / 3; y += height; return baseline }
  const name = Array.from({ length: names }, () => line(lineHeight.name, font.name))
  if (names && bodies) y += padding.gap
  return { name, body: Array.from({ length: bodies }, () => line(lineHeight.body, font.body)) }
}
export function labelBox(text: string, maxWidth: number): { lines: string[]; width: number; height: number } {
  const lines = wrapLabel(text, maxWidth, font.label)
  return { lines, width: Math.ceil(Math.max(...lines.map(labelWidth))), height: lines.length * lineHeight.label }
}
export function labelBaselines(centerY: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => centerY - count * lineHeight.label / 2 + i * lineHeight.label + lineHeight.label / 2 + font.label / 3)
}
