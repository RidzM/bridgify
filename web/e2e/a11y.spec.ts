import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const MODES = ['light', 'dark', 'high-contrast', 'solarized', 'night-blue', 'forest', 'sepia', 'calm', 'focus', 'low-vision', 'autism', 'dyslexia']
const ROUTES = ['/', '/tools/text-to-speech', '/tools/speech-to-text', '/tools/text-to-braille', '/tools/braille-to-text', '/tools/sign-to-text', '/tools/text-to-sign', '/tools/gesture-emotion', '/bridge', '/sos', '/learn/braille/alphabet', '/learn/sign/isl/alphabet', '/about', '/about/evidence', '/about/credits', '/does-not-exist']

for (const mode of MODES) {
  test(`no serious accessibility violations in ${mode} mode`, async ({ page }) => {
    await page.addInitScript((m) => localStorage.setItem('bridgify.prefs.v1', JSON.stringify({ state: { mode: m }, version: 1 })), mode)
    for (const route of ROUTES) {
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()
      // Let lazy routes, content and fonts settle, so axe sees the finished page rather than a loading state.
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForFunction(() => !document.querySelector('main')?.textContent?.includes('Loading'), null, { timeout: 10_000 }).catch(() => {})
      await page.evaluate(() => document.fonts.ready)
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(bad.map((v) => `${route}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([])
    }
  })
}

test('display settings work by keyboard and persist without a flash', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Display settings' }).first()
  await trigger.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Display settings' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('radio', { name: /High contrast/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'high-contrast')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await page.reload({ waitUntil: 'commit' })
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'high-contrast')
})

test('hiding a tool removes it from the menu and survives reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: 'Gesture and emotion' })).toBeVisible()
  await page.getByRole('button', { name: 'Display settings' }).first().click()
  await page.getByRole('switch', { name: 'Gesture and emotion' }).click()
  await page.keyboard.press('Escape')
  await expect(nav.getByRole('link', { name: 'Gesture and emotion' })).toHaveCount(0)
  await page.reload()
  await expect(nav.getByRole('link', { name: 'Gesture and emotion' })).toHaveCount(0)
})

test('200% text reflows without horizontal scroll at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.addInitScript(() => localStorage.setItem('bridgify.prefs.v1', JSON.stringify({ state: { textScale: 2 }, version: 1 })))
  await page.goto('/')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
