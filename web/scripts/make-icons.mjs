// Renders the Bridgify app icons (braille cell for "b": dots 1 and 2 raised) from SVG to PNG.
// Usage (from web/): node scripts/make-icons.mjs public/icons
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
const out = process.argv[2]
const BRAND = '#3d0075'

function cell({ scale, rounded }) {
  const c = 256
  const dx = 68 * scale, dy = 128 * scale, raised = 54 * scale, flat = 41.5 * scale, stroke = 20.8 * scale
  const cols = [c - dx, c + dx], rows = [c - dy, c, c + dy]
  const on = new Set(['0,0', '0,1']) // dots 1 and 2 (left column, top two)
  const dots = []
  cols.forEach((x, ci) => rows.forEach((y, ri) => {
    dots.push(on.has(`${ci},${ri}`)
      ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${raised.toFixed(1)}" fill="#fff"/>`
      : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${flat.toFixed(1)}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="${stroke.toFixed(1)}"/>`)
  }))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512"${rounded ? ' rx="112"' : ''} fill="${BRAND}"/>${dots.join('')}</svg>`
}

const any = cell({ scale: 1, rounded: true })
const maskable = cell({ scale: 0.88, rounded: false })
writeFileSync(`${out}/icon.svg`, any + '\n')
writeFileSync(`${out}/maskable.svg`, maskable + '\n')

const browser = await chromium.launch()
for (const [name, svg] of [['icon', any], ['maskable', maskable]]) {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
    await page.screenshot({ path: `${out}/${name}-${size}.png`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
    await page.close()
  }
}
// iOS home screen icon: full square, no transparency.
const page = await browser.newPage({ viewport: { width: 180, height: 180 } })
await page.setContent(`<html><body style="margin:0">${cell({ scale: 0.82, rounded: false }).replace('<svg ', '<svg width="180" height="180" ')}</body></html>`)
await page.screenshot({ path: `${out}/apple-touch-icon-180.png`, clip: { x: 0, y: 0, width: 180, height: 180 } })
await browser.close()
console.log('icons written to', out)
