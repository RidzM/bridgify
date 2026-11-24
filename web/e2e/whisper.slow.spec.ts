import { test, expect, chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'

// Real on-device Whisper run with a recorded sentence as the microphone. Slow (downloads ~40 MB).
test('on-device Whisper transcribes a spoken sentence', async () => {
  test.setTimeout(240_000)
  const wav = fileURLToPath(new URL('./fixtures/hello-hospital.wav', import.meta.url))
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`] })
  const page = await browser.newPage()
  await page.goto((process.env.BASE_URL ?? 'http://localhost:4173') + '/tools/speech-to-text')
  await expect(page.getByRole('button', { name: /Start listening/ })).toBeVisible()
  const noisy = page.getByRole('button', { name: /Noisy room/ })
  if (await noisy.count()) await noisy.click()
  await page.getByRole('button', { name: 'Download and turn on' }).click()
  await expect(page.getByRole('button', { name: /Start listening/ })).toBeEnabled({ timeout: 200_000 })
  await page.getByRole('button', { name: /Start listening/ }).click()
  await expect(page.getByRole('region', { name: 'Transcript' })).toContainText(/hospital/i, { timeout: 60_000 })
  console.log('transcript:', await page.getByRole('region', { name: 'Transcript' }).innerText())
  await browser.close()
})
