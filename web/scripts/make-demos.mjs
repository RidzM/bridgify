// Records the animated clips shown in the README from a running copy of the site.
// Usage: node scripts/make-demos.mjs [baseUrl]   (needs ffmpeg)
// Writes docs/assets/demo-home.gif, demo-sign.gif and demo-braille.gif.
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.argv[2] ?? 'https://bridgify-vcet.vercel.app'
const OUT = '../docs/assets'
const WIDTH = 640

const browser = await chromium.launch()

/** Captures frames with `grab` while `script` runs, then encodes them as a looping GIF. */
async function record(name, { path, prefs = {}, fps = 10, holdEnd = 1.6, realTime = false, scale = 2 }, script) {
  const dir = mkdtempSync(join(tmpdir(), `bridgify-${name}-`))
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: scale, serviceWorkers: 'block' })
  await ctx.addInitScript((p) => localStorage.setItem('bridgify.prefs.v1', JSON.stringify({ state: p, version: 1 })), prefs)
  const page = await ctx.newPage()
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  let n = 0
  const frame = async (clip) => { await page.screenshot({ path: join(dir, `f${String(n++).padStart(4, '0')}.png`), clip }) }
  const t0 = Date.now()
  await script(page, frame)
  // For live animation, play back at the speed the frames were captured.
  if (realTime) fps = Math.max(4, Math.round(n / ((Date.now() - t0) / 1000)))
  const last = join(dir, `f${String(n - 1).padStart(4, '0')}.png`)
  for (let i = 0; i < Math.round(holdEnd * fps); i++) copyFileSync(last, join(dir, `f${String(n++).padStart(4, '0')}.png`))
  await ctx.close()
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(fps), '-i', join(dir, 'f%04d.png'),
    '-vf', `scale=${WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    '-loop', '0', join(OUT, `demo-${name}.gif`)])
  rmSync(dir, { recursive: true, force: true })
  console.log(`wrote docs/assets/demo-${name}.gif (${n} frames)`)
}

async function clipOf(page, locators, pad = 16) {
  const boxes = []
  for (const l of locators) boxes.push(await l.boundingBox())
  const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad)
  const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad)
  const r = Math.max(...boxes.map((b) => b.x + b.width)) + pad
  const btm = Math.max(...boxes.map((b) => b.y + b.height)) + pad
  // Grow the shorter side around the centre to an exact 16:10 frame, so the clips line up in the README.
  let w = r - x
  let h = btm - y
  const cx = x + w / 2
  const cy = y + h / 2
  if (h / w > 0.625) w = h / 0.625
  else h = w * 0.625
  const vp = page.viewportSize()
  return { x: Math.round(Math.min(Math.max(0, cx - w / 2), vp.width - w)), y: Math.round(Math.max(0, cy - h / 2)), width: Math.round(w), height: Math.round(h) }
}

async function typeAndGrab(page, input, text, frame, clip) {
  await frame(clip)
  for (const ch of text) {
    await input.press(ch === ' ' ? 'Space' : ch)
    await page.waitForTimeout(40)
    await frame(clip)
  }
}

// 1. Home: one message shown every way.
await record('home', { path: '/', prefs: { sign: { lang: 'asl' } } }, async (page, frame) => {
  const box = page.getByLabel('What do you want to say?')
  await box.click()
  await box.fill('')
  const region = page.locator('[aria-label="Say something"]')
  const clip = await clipOf(page, [region])
  await typeAndGrab(page, box, 'Where is the hospital?', frame, clip)
})

// 2. Text to sign: an animated signer.
await record('sign', { path: '/tools/text-to-sign', prefs: { sign: { lang: 'asl' } }, holdEnd: 0, realTime: true, scale: 1 }, async (page, frame) => {
  await page.getByLabel('Text', { exact: true }).fill('hello')
  await page.getByRole('button', { name: 'Show signs' }).click()
  const fig = page.getByRole('img', { name: /Sign for HELLO/i })
  await fig.waitFor({ timeout: 60_000 })
  const clip = await clipOf(page, [fig], 12)
  const end = Date.now() + 4200
  while (Date.now() < end) await frame(clip)
})

// 3. Text to braille as you type.
await record('braille', { path: '/tools/text-to-braille' }, async (page, frame) => {
  const input = page.getByLabel('Text', { exact: true })
  await input.click()
  await input.fill('')
  const out = page.getByRole('region', { name: 'Braille output' })
  const clip = await clipOf(page, [input, out])
  await typeAndGrab(page, input, 'Hello, how are you?', frame, clip)
})

await browser.close()
