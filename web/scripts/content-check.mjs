// Fails the build if any content file points at sign media that isn't in public/.
// Checks lexicons, lesson phrases and fingerspelling files in ../content.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const CONTENT = '../content'
const PUBLIC = 'public'
const missing = []
let refs = 0

const check = (file, src) => {
  if (!src || typeof src !== 'string' || !src.startsWith('/')) return
  refs++
  if (!existsSync(join(PUBLIC, src))) missing.push(`${file}: ${src}`)
}
const each = (dir, fn) => {
  const d = join(CONTENT, dir)
  if (!existsSync(d)) return
  for (const f of readdirSync(d).filter((x) => x.endsWith('.json'))) fn(`${dir}/${f}`, JSON.parse(readFileSync(join(d, f), 'utf8')))
}

each('lexicons', (file, lex) => {
  for (const e of lex.entries ?? []) {
    check(file, e.pose)
    check(file, e.video?.src)
    check(file, e.video?.poster)
  }
})
each('tutorials/phrases', (file, set) => {
  for (const p of set.phrases ?? []) check(file, p.media?.src)
})
each('tutorials/fingerspelling', (file, fs) => {
  check(file, fs.chart)
  for (const l of [...(fs.letters ?? []), ...(fs.numbers ?? [])]) check(file, l.media?.src)
})

if (missing.length) {
  console.error(`content: ${missing.length} of ${refs} media references point at missing files:`)
  for (const m of missing.slice(0, 20)) console.error(`  ${m}`)
  process.exit(1)
}
console.log(`content: all ${refs} media references resolve`)
