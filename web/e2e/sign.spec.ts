import { test, expect } from '@playwright/test'

test.describe('text to sign', () => {
  test('report case: ASL "hello" plays a sign animation', async ({ page }) => {
    test.setTimeout(60_000)
    await page.addInitScript(() => localStorage.setItem('bridgify.prefs.v1', JSON.stringify({ state: { sign: { lang: 'asl' } }, version: 1 })))
    await page.goto('/tools/text-to-sign')
    await expect(page.getByLabel('Text')).toHaveValue('hello')
    await page.getByRole('button', { name: 'Show signs' }).click()
    await expect(page.getByRole('img', { name: /Sign for HELLO/i })).toBeVisible({ timeout: 45_000 })
    await expect(page.getByRole('button', { name: /Pause|Play/ })).toBeVisible()
  })

  test('unknown names are fingerspelled letter by letter', async ({ page }) => {
    test.setTimeout(60_000)
    await page.addInitScript(() => localStorage.setItem('bridgify.prefs.v1', JSON.stringify({ state: { sign: { lang: 'asl' } }, version: 1 })))
    // The app never calls sign.mt live (D-39): no request may leave for it.
    let live = 0
    await page.route('**/spoken_text_to_signed_pose**', (r) => { live++; return r.fulfill({ status: 500, body: '{}' }) })
    await page.goto('/tools/text-to-sign')
    await page.getByLabel('Text', { exact: true }).fill('Riya')
    await page.getByRole('button', { name: 'Show signs' }).click()
    await expect(page.getByRole('list', { name: 'Signs in this sequence' })).toContainText('R')
    await expect(page.getByText(/no stored sign for "riya", so it is fingerspelled/i)).toBeVisible()
    expect(live).toBe(0)
  })

  test('ISL shows the approximate ISL word order', async ({ page }) => {
    test.setTimeout(60_000)
    await page.addInitScript(() => localStorage.setItem('bridgify.prefs.v1', JSON.stringify({ state: { sign: { lang: 'isl' } }, version: 1 })))
    await page.route('**/spoken_text_to_signed_pose**', (r) => r.fulfill({ status: 500, body: '{}' }))
    await page.goto('/tools/text-to-sign')
    await page.getByLabel('Text', { exact: true }).fill('Where is the hospital?')
    await page.getByRole('button', { name: 'Show signs' }).click()
    await expect(page.getByRole('region', { name: 'Words' })).toContainText('HOSPITAL WHERE')
    // Stored ISL signs play even when the live service is down: no fingerspelling fallback.
    await expect(page.getByRole('img', { name: /^Sign for / }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/no stored sign/i)).toHaveCount(0)
  })

  test('all six languages are available', async ({ page }) => {
    await page.goto('/tools/text-to-sign')
    for (const c of ['ISL', 'ASL', 'FSL', 'LSM', 'LIS', 'DGS']) await expect(page.getByRole('button', { name: c, exact: true })).toBeEnabled()
  })
})
