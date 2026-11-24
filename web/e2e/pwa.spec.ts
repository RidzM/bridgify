import { test, expect } from '@playwright/test'

test.use({ serviceWorkers: 'allow' })

const pngSize = (b: Buffer) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) })

test('the web app manifest is linked and installable', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBe('/manifest.webmanifest')
  const res = await request.get(href!)
  expect(res.ok()).toBe(true)
  const m = await res.json()
  expect(m).toMatchObject({ name: 'Bridgify', short_name: 'Bridgify', start_url: '/', scope: '/', display: 'standalone', theme_color: '#3d0075', background_color: '#f6f5f8' })
  const icons = m.icons as { src: string; sizes: string; type: string; purpose: string }[]
  expect(icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(expect.arrayContaining(['192x192 any', '512x512 any', '192x192 maskable', '512x512 maskable']))
  for (const icon of icons) {
    const r = await request.get(icon.src)
    expect(r.ok(), icon.src).toBe(true)
    expect(r.headers()['content-type']).toContain(icon.type)
    if (icon.type === 'image/png') {
      const { w, h } = pngSize(await r.body())
      expect(`${w}x${h}`).toBe(icon.sizes)
    }
  }
  expect((m.shortcuts as { url: string }[]).map((s) => s.url)).toEqual(['/sos', '/bridge'])
})

test('the service worker registers and precaches the app shell, not the models', async ({ page }) => {
  await page.goto('/')
  const info = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    const name = (await caches.keys()).find((k) => k.startsWith('workbox-precache'))
    const urls = name ? (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname) : []
    return { active: Boolean(reg.active), script: reg.active?.scriptURL ?? '', urls }
  })
  expect(info.active).toBe(true)
  expect(info.script).toMatch(/\/sw\.js$/)
  expect(info.urls).toContain('/index.html')
  expect(info.urls.some((u) => /^\/assets\/SosPage-[\w-]+\.js$/.test(u))).toBe(true)
  expect(info.urls.some((u) => u.endsWith('.woff2'))).toBe(true)
  expect(info.urls.filter((u) => /^\/(models|wasm|signs)\//.test(u))).toEqual([])
})

test('after the first visit, text to speech opens and works offline', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await context.setOffline(true)
  await page.goto('/tools/text-to-speech')
  await expect(page.getByRole('heading', { level: 1, name: 'Text to speech' })).toBeVisible()
  await page.getByLabel('Your message').fill('Hello without internet')
  await expect(page.getByRole('button', { name: 'Speak', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Speak', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Live caption' })).toContainText('Hello without internet')
  await context.setOffline(false)
})
