// WCAG contrast check for every display mode's token pairs (reads modes.css + tokens.css).
import { readFileSync } from 'node:fs'
const css = readFileSync('src/design/tokens.css', 'utf8') + readFileSync('src/design/modes.css', 'utf8')
const parse = (block) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]))
const root = parse(css.match(/:root\s*{([^}]*)}/)[1])
const modes = { light: root }
for (const m of css.matchAll(/\[data-mode='([a-z-]+)'\]\s*{([^}]*)}/g)) modes[m[1]] = { ...root, ...parse(m[2]) }
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const AAA = new Set(['high-contrast', 'low-vision'])
const pairs = [
  ['ink', 'bg', 4.5, 7], ['ink', 'surface', 4.5, 7], ['ink-muted', 'bg', 4.5, 4.5], ['ink-muted', 'surface', 4.5, 4.5],
  ['brand', 'bg', 4.5, 7], ['brand-ink', 'brand', 4.5, 7], ['live', 'surface', 4.5, 4.5], ['ok', 'surface', 3, 3],
  ['danger-ink', 'danger', 4.5, 4.5], ['line-strong', 'surface', 3, 3], ['focus', 'bg', 3, 3], ['ink', 'surface-2', 4.5, 7],
]
let fail = 0
for (const [name, t] of Object.entries(modes)) {
  for (const [fg, bg, aa, aaa] of pairs) {
    const need = AAA.has(name) ? aaa : aa
    const r = ratio(t[fg], t[bg])
    if (r < need) { fail++; console.log(`FAIL ${name.padEnd(14)} ${fg} on ${bg}: ${r.toFixed(2)} < ${need}`) }
  }
}
console.log(`${Object.keys(modes).length} modes × ${pairs.length} pairs checked, ${fail} failures`)
process.exit(fail ? 1 : 0)
