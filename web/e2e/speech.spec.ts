import { test, expect } from '@playwright/test'

test.describe('text to speech', () => {
  test('quick phrase fills the message and speak needs text', async ({ page }) => {
    await page.goto('/tools/text-to-speech')
    const speak = page.getByRole('button', { name: 'Speak', exact: true })
    await expect(speak).toBeDisabled()
    await page.getByRole('tab', { name: 'Emergency' }).click()
    await page.getByRole('button', { name: 'Call an ambulance' }).click()
    await expect(page.getByLabel('Your message')).toHaveValue('Call an ambulance')
    await expect(page.getByText('Call an ambulance', { exact: false }).last()).toBeVisible()
  })

  test('works by keyboard: type, then Ctrl+Enter speaks', async ({ page }) => {
    await page.goto('/tools/text-to-speech')
    await page.getByLabel('Your message').focus()
    await page.keyboard.type('Please speak slowly')
    await page.keyboard.press('Control+Enter')
    // The caption shows the spoken text (speech itself may be unavailable in headless browsers).
    await expect(page.getByRole('region', { name: 'Live caption' })).toContainText('Please speak slowly')
  })

  test('switching to Hindi shows Hindi phrases', async ({ page }) => {
    await page.goto('/tools/text-to-speech')
    await page.getByLabel('Language').selectOption('hi-IN')
    await page.getByRole('tab', { name: 'वाक्यांश' }).click()
    await expect(page.getByRole('button', { name: 'मुझे मदद चाहिए' })).toBeVisible()
  })
})

test.describe('speech to text', () => {
  test('captions view opens and closes with Escape', async ({ page }) => {
    await page.goto('/tools/speech-to-text')
    await page.getByRole('button', { name: 'Captions view' }).click()
    await expect(page.getByRole('dialog', { name: 'Captions' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Captions' })).toBeHidden()
  })

  test('on-device option explains the download before starting it', async ({ page }) => {
    await page.goto('/tools/speech-to-text')
    await expect(page.getByRole('button', { name: /Start listening/ })).toBeVisible()
    const noisy = page.getByRole('button', { name: /Noisy room/ })
    if (await noisy.count()) await noisy.click()
    await expect(page.getByText(/Downloads about 40 MB once/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download and turn on' })).toBeVisible()
  })
})
