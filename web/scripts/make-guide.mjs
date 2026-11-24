// Builds docs/Bridgify-User-Guide.pdf: screenshots from the live site + step-by-step instructions.
// Usage: node scripts/make-guide.mjs [baseUrl]
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { encodeQr, qrPath } from '../src/engines/bridge/qr.ts'

const BASE = process.argv[2] ?? 'https://bridgify-vcet.vercel.app'
const OUT = '../docs/guide'
const SHOTS = `${OUT}/shots`
mkdirSync(SHOTS, { recursive: true })
const url = (p) => `${BASE}${p}`

// ---------- 1. screenshots ----------
const browser = await chromium.launch()
async function shot(name, path, { mobile = false, prefs = {}, act } = {}) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 820 }, deviceScaleFactor: mobile ? 2 : 1.5, reducedMotion: 'reduce', serviceWorkers: 'block' })
  await ctx.addInitScript((p) => localStorage.setItem('bridgify.prefs.v1', JSON.stringify({ state: p, version: 1 })), prefs)
  const page = await ctx.newPage()
  await page.goto(url(path), { waitUntil: 'networkidle' })
  if (act) await act(page)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: 'jpeg', quality: 80 })
  await ctx.close()
}
await shot('home', '/')
await shot('home-mobile', '/', { mobile: true })
await shot('settings', '/', { act: (p) => p.getByRole('button', { name: 'Display settings' }).first().click() })
await shot('dyslexia', '/tools/text-to-speech', { prefs: { mode: 'dyslexia' } })
await shot('tts', '/tools/text-to-speech', { act: async (p) => { await p.getByRole('tab', { name: 'Emergency' }).click() } })
await shot('stt', '/tools/speech-to-text')
await shot('t2b', '/tools/text-to-braille', { act: async (p) => { await p.getByLabel('Text', { exact: true }).fill('HELLO, HOW ARE YOU?'); await p.waitForTimeout(800) } })
await shot('b2t', '/tools/braille-to-text', { act: async (p) => { for (const d of [1, 2, 5]) await p.getByRole('button', { name: `Dot ${d}` }).click(); await p.getByRole('button', { name: 'Add cell' }).click(); for (const d of [2, 4]) await p.getByRole('button', { name: `Dot ${d}` }).click(); await p.getByRole('button', { name: 'Add cell' }).click(); await p.waitForTimeout(500) } })
await shot('s2t', '/tools/sign-to-text', { prefs: { sign: { lang: 'asl' } } })
await shot('t2s', '/tools/text-to-sign', { prefs: { sign: { lang: 'asl' } }, act: async (p) => { await p.getByRole('button', { name: 'Show signs' }).click(); await p.getByRole('img', { name: /Sign for/ }).waitFor({ timeout: 40000 }).catch(() => {}); await p.waitForTimeout(900) } })
await shot('gesture', '/tools/gesture-emotion')
await shot('bridge', '/bridge')
await shot('sos', '/sos')
await shot('learn-braille', '/learn/braille/alphabet')
await shot('evidence', '/about/evidence')
await browser.close()

// ---------- 2. document ----------
const css = readFileSync(`${OUT}/guide.css`, 'utf8')
const qr = encodeQr(BASE, 'M')
const qrSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.size + 8} ${qr.size + 8}" width="40mm" height="40mm" role="img" aria-label="QR code for ${BASE}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${qrPath(qr, 4)}" fill="#18131f"/></svg>`
writeFileSync(`${OUT}/qr.svg`, qrSvg)
const body = readFileSync(`${OUT}/guide.html`, 'utf8').replaceAll('{{BASE}}', BASE).replace('{{QR}}', qrSvg)
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Bridgify user guide</title><style>${css}</style></head><body>${body}</body></html>`
writeFileSync(`${OUT}/guide.build.html`, html)
const b2 = await chromium.launch()
const pg = await b2.newPage()
await pg.goto(`file://${process.cwd()}/${OUT}/guide.build.html`, { waitUntil: 'networkidle' })
await pg.pdf({
  path: '../docs/Bridgify-User-Guide.pdf', format: 'A4', printBackground: true,
  margin: { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: `<div style="font:9px Helvetica,Arial,sans-serif;color:#595363;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>Bridgify user guide</span><span>${BASE.replace('https://', '')}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
})
await b2.close()
console.log('wrote docs/Bridgify-User-Guide.pdf')
