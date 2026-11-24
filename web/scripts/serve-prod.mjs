// Serves dist/ with the same headers and SPA rewrite as vercel.json, so CSP can be tested locally.
// Usage: node scripts/serve-prod.mjs [port]
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
const port = Number(process.argv[2] ?? 4180)
const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'))
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.task': 'application/octet-stream', '.bin': 'application/octet-stream', '.webm': 'video/webm', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.md': 'text/markdown' }
const toRe = (src) => new RegExp('^' + src.replace(/\(\.\*\)/g, '(.*)') + '$')
createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  let path = decodeURIComponent(url.pathname)
  for (const h of cfg.headers ?? []) if (toRe(h.source).test(path)) for (const { key, value } of h.headers) res.setHeader(key, value)
  let file = join('dist', path)
  if (!existsSync(file) || statSync(file).isDirectory()) {
    const rw = (cfg.rewrites ?? []).find((r) => toRe(r.source).test(path))
    file = rw ? join('dist', rw.destination) : join('dist', 'index.html')
  }
  if (!existsSync(file)) { res.statusCode = 404; return res.end('not found') }
  res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
  res.end(readFileSync(file))
}).listen(port, () => console.log(`prod-like server on http://localhost:${port}`))
