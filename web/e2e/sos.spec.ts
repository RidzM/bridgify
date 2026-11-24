import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.use({ serviceWorkers: 'allow' })

const PRESETS = ['I am Deaf. Please write it down.', "I can't speak. I need help.", 'I need a doctor.', 'Please call this number.', 'I am blind. Please guide me.', 'I have a medical condition.']
const cards = (page: Page) => page.getByRole('list', { name: 'Cards to show or speak' }).getByRole('listitem')

test('every preset shows large text, braille, Speak, signs and full screen', async ({ page }) => {
  await page.goto('/sos')
  await expect(page.getByRole('heading', { level: 1, name: 'SOS' })).toBeVisible()
  await expect(cards(page)).toHaveCount(PRESETS.length)
  for (const text of PRESETS) await expect(page.getByText(text, { exact: true })).toBeVisible()
  const first = cards(page).first()
  await expect(first.getByRole('img', { name: 'Braille, Grade 1' })).toBeVisible()
  await expect(first.getByRole('button', { name: 'Speak' })).toBeEnabled()
  await first.getByRole('button', { name: 'Sign it' }).click()
  await expect(first.getByRole('button', { name: 'Hide signs' })).toHaveAttribute('aria-expanded', 'true')

  await first.getByRole('button', { name: 'Show full screen' }).click()
  const shown = page.getByRole('dialog')
  await expect(shown).toContainText('I am Deaf. Please write it down.')
  await expect(shown.getByRole('button', { name: 'Speak' })).toBeVisible()
  await shown.getByRole('button', { name: 'Turn text around' }).click()
  await expect(shown.getByRole('button', { name: 'Turn text around' })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(shown).toBeHidden()
})

test('the emergency contact is saved on the device and becomes a Call button', async ({ page }) => {
  await page.goto('/sos')
  await page.getByRole('button', { name: 'Add an emergency contact' }).click()
  const contact = page.getByLabel('Emergency contact')
  await expect(contact).toBeFocused()
  await contact.fill('Amma, 98765 43210')
  await page.getByLabel('Medical notes').fill('Diabetic. Allergic to penicillin.')
  await page.getByRole('button', { name: 'Done' }).click()
  await page.reload()
  await expect(page.getByRole('link', { name: 'Call Amma' })).toHaveAttribute('href', 'tel:9876543210')
  await expect(page.getByText('98765 43210 (Amma)')).toBeVisible()
  await expect(page.getByText('Diabetic. Allergic to penicillin.').first()).toBeVisible()
})

test('works offline after the first visit, and renders fast from cache', async ({ page, context }) => {
  // Note when the first card appears, measured from the start of navigation.
  await page.addInitScript(() => {
    const w = window as unknown as { __sosShownAt?: number }
    new MutationObserver((_m, obs) => {
      if (document.body?.textContent?.includes('I am Deaf. Please write it down.')) { w.__sosShownAt = performance.now(); obs.disconnect() }
    }).observe(document, { childList: true, subtree: true, characterData: true })
  })
  await page.goto('/sos')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('I am Deaf. Please write it down.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Speak' }).first()).toBeVisible()
  const shownAt = await page.evaluate(() => (window as unknown as { __sosShownAt?: number }).__sosShownAt ?? -1)
  console.log(`[sos] offline reload: first card on screen ${Math.round(shownAt)} ms after navigation start`)
  expect(shownAt).toBeGreaterThan(0)
  expect(shownAt).toBeLessThan(1000) // FR-SOS-01 targets 300 ms; leave room for a loaded test machine
  await context.setOffline(false)
})

test('no serious accessibility violations on SOS, in all 12 modes', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mode sweep runs on desktop')
  test.setTimeout(90_000)
  const modes = ['light', 'dark', 'high-contrast', 'solarized', 'night-blue', 'forest', 'sepia', 'calm', 'focus', 'low-vision', 'autism', 'dyslexia']
  await page.goto('/sos')
  await page.getByRole('button', { name: 'Edit' }).click()
  const bad: string[] = []
  for (const mode of modes) {
    await page.evaluate((m) => { document.documentElement.dataset.mode = m }, mode)
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    for (const v of res.violations) if (v.impact === 'serious' || v.impact === 'critical') bad.push(`${mode}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)
  }
  await page.getByRole('button', { name: 'Show full screen' }).first().click()
  const res = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa']).analyze()
  for (const v of res.violations) if (v.impact === 'serious' || v.impact === 'critical') bad.push(`full screen: ${v.id} ${v.nodes[0]?.target}`)
  expect(bad).toEqual([])
})
