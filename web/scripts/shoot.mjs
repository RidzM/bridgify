// Usage: node scripts/shoot.mjs <outDir> <route,...> [modes] [--open=personalize]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const [, , out = '../docs/screens/tmp', routesArg = '/', modesArg = 'light,dark,high-contrast,dyslexia', ...flags] = process.argv
const base = process.env.BASE_URL ?? 'http://localhost:4173'
const open = flags.find((f) => f.startsWith('--open='))?.split('=')[1]
mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
for (const vp of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  for (const mode of modesArg.split(',')) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'reduce' })
    await ctx.addInitScript((m) => localStorage.setItem('bridgify.prefs.v1', JSON.stringify({ state: { mode: m }, version: 1 })), mode)
    const page = await ctx.newPage()
    for (const r of routesArg.split(',')) {
      await page.goto(base + r, { waitUntil: 'networkidle' })
      if (open === 'personalize') await page.getByRole('button', { name: 'Personalize' }).click()
      if (open === 'tutorials') await page.getByRole('button', { name: 'Tutorials' }).click()
      await page.waitForTimeout(400)
      const slug = r === '/' ? 'home' : r.replace(/^\//, '').replace(/\//g, '_')
      await page.screenshot({ path: `${out}/${slug}-${mode}-${vp.name}${open ? '-' + open : ''}.png`, fullPage: !open })
    }
    await ctx.close()
  }
}
await browser.close()
console.log('screens in', out)
