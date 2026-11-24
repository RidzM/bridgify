import { test, expect, chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Real camera pipeline: held-out signer photos (ASL-HG P10, never used in training) played as a
// fake webcam. Needs ffmpeg to build the .y4m clips.
const fx = (f: string) => fileURLToPath(new URL(`./fixtures/${f}`, import.meta.url))
const out = fileURLToPath(new URL('../test-results/camera/', import.meta.url))

function clip(name: string, parts: [string, number][]) {
  mkdirSync(out, { recursive: true })
  const list = `${out}${name}.txt`
  writeFileSync(list, parts.map(([f, d]) => `file '${fx(f)}'\nduration ${d}`).join('\n') + `\nfile '${fx('blank.png')}'\n`)
  const y4m = `${out}${name}.y4m`
  if (!existsSync(y4m)) execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=15,format=yuv420p', '-f', 'yuv4mpegpipe', y4m])
  return y4m
}

test('ASL fingerspelling: L, O, V from an unseen signer become "LOV"', async () => {
  test.setTimeout(120_000)
  const video = clip('lov', [['asl-L-heldout.png', 2.6], ['blank.png', 0.8], ['asl-O-heldout.png', 2.6], ['blank.png', 0.8], ['asl-V-heldout.png', 2.6], ['blank.png', 3]])
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`] })
  const page = await browser.newPage()
  await page.addInitScript(() => localStorage.setItem('bridgify.prefs.v1', JSON.stringify({ state: { sign: { lang: 'asl' } }, version: 1 })))
  await page.goto('http://localhost:4173/tools/sign-to-text')
  await page.getByRole('button', { name: 'Start camera' }).click()
  const out = page.getByRole('region', { name: 'Detected text' }).locator('p[aria-live]')
  // The fake camera loops the clip, so read the first pass only.
  await expect(out).toHaveText(/LOV/, { timeout: 60_000 }) // the clip loops and the camera may start mid-clip
  const stats = await page.getByText(/fps · .* ms per frame/).innerText()
  console.log('detected:', (await out.innerText()).trim(), '|', stats)
  await browser.close()
})

test('Gesture: an open hand is recognised as an open palm', async () => {
  test.setTimeout(120_000)
  const video = clip('palm', [['asl-B-heldout.png', 4]])
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`] })
  const page = await browser.newPage()
  await page.goto('http://localhost:4173/tools/gesture-emotion')
  await page.getByRole('button', { name: 'Start camera' }).click()
  await expect(page.getByRole('region', { name: 'Gesture', exact: true })).toContainText('Open palm', { timeout: 60_000 })
  await browser.close()
})
