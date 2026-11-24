// Fails the build if the entry JS chunk exceeds the budget (gzip).
import { readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
const BUDGET = 180 * 1024
const html = readFileSync('dist/index.html', 'utf8')
const entries = [...html.matchAll(/<script[^>]+src="\/assets\/([^"]+\.js)"/g)].map((m) => m[1])
const preloads = [...html.matchAll(/<link rel="modulepreload"[^>]+href="\/assets\/([^"]+\.js)"/g)].map((m) => m[1])
let total = 0
for (const f of [...entries, ...preloads]) total += gzipSync(readFileSync(`dist/assets/${f}`)).length
const all = readdirSync('dist/assets').filter((f) => f.endsWith('.js')).length
console.log(`entry JS (gzip): ${(total / 1024).toFixed(1)} KB of ${BUDGET / 1024} KB budget · ${all} chunks total`)
if (total > BUDGET) { console.error('Entry bundle over budget'); process.exit(1) }
