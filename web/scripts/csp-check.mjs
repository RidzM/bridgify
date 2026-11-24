// Keeps the CSP hash of the inline boot script (index.html) in vercel.json in sync. Run after build.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const html = readFileSync('dist/index.html', 'utf8')
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
const hashes = scripts.map((s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`)
const vercel = readFileSync('vercel.json', 'utf8')
const missing = hashes.filter((h) => !vercel.includes(h))
if (missing.length) { console.error(`CSP: add ${missing.join(' ')} to script-src in vercel.json`); process.exit(1) }
console.log(`CSP: ${hashes.length} inline script hash(es) present`)
