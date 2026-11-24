import { test, expect } from '@playwright/test'

test.describe('sign to text', () => {
  test('ASL and ISL are selectable; other languages explain why not', async ({ page }) => {
    await page.goto('/tools/sign-to-text')
    await expect(page.getByRole('button', { name: 'ISL' })).toBeEnabled()
    await page.getByRole('button', { name: 'ASL' }).click()
    await expect(page.getByRole('button', { name: 'ASL' })).toHaveAttribute('aria-pressed', 'true')
    for (const l of ['FSL', 'LSM', 'LIS', 'DGS']) await expect(page.getByRole('button', { name: l })).toBeDisabled()
    await expect(page.getByText(/use Text to sign and Tutorials/)).toBeVisible()
  })

  test('shows a plain error with a way out when no camera is available', async ({ page }) => {
    await page.goto('/tools/sign-to-text')
    await page.evaluate(() => { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) } }) })
    await page.getByRole('button', { name: 'Start camera' }).click()
    await expect(page.getByText(/Camera blocked/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('Space and Delete edit the detected text by keyboard', async ({ page }) => {
    await page.goto('/tools/sign-to-text')
    await expect(page.getByRole('button', { name: 'Delete last letter' })).toBeDisabled()
    await page.getByRole('button', { name: 'Space' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Delete last letter' })).toBeEnabled()
  })
})

test.describe('gesture and emotion', () => {
  test('explains every gesture and keeps the log on the device', async ({ page }) => {
    await page.goto('/tools/gesture-emotion')
    for (const g of ['Thumbs up', 'Open palm', 'Wave', 'I love you']) await expect(page.getByRole('region', { name: 'Gesture guide' })).toContainText(g)
    await expect(page.getByText('The log stays on this device.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeDisabled()
  })
})
