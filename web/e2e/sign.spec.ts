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
    await page.route('**/spoken_text_to_signed_pose**', (r) => r.fulfill({ status: 500, body: '{"message":"No poses found"}' }))
    await page.goto('/tools/text-to-sign')
    await page.getByLabel('Text').fill('Riya')
    await page.getByRole('button', { name: 'Show signs' }).click()
    await expect(page.getByRole('list', { name: 'Signs in this sequence' })).toContainText('R')
    await expect(page.getByText(/is fingerspelled/)).toBeVisible()
  })

  test('ISL shows the approximate ISL word order', async ({ page }) => {
    test.setTimeout(60_000)
    await page.addInitScript(() => localStorage.setItem('bridgify.prefs.v1', JSON.stringify({ state: { sign: { lang: 'isl' } }, version: 1 })))
    await page.route('**/spoken_text_to_signed_pose**', (r) => r.fulfill({ status: 500, body: '{}' }))
    await page.goto('/tools/text-to-sign')
    await page.getByLabel('Text').fill('Where is the hospital?')
    await page.getByRole('button', { name: 'Show signs' }).click()
    await expect(page.getByText('HOSPITAL WHERE')).toBeVisible()
  })

  test('all six languages are available', async ({ page }) => {
    await page.goto('/tools/text-to-sign')
    for (const c of ['ISL', 'ASL', 'FSL', 'LSM', 'LIS', 'DGS']) await expect(page.getByRole('button', { name: c, exact: true })).toBeEnabled()
  })
})
