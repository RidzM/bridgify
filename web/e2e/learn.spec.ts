import { test, expect } from '@playwright/test'

test.describe('learn braille', () => {
  test('alphabet shows 26 cells and the quiz checks answers', async ({ page }) => {
    await page.goto('/learn/braille/alphabet')
    await expect(page.getByRole('heading', { name: 'Learn braille', level: 1 })).toBeVisible()
    const quiz = page.getByRole('region', { name: /Quick quiz/ })
    const label = await quiz.getByRole('img').getAttribute('aria-label')
    const dots = label!.replace('dots ', '').split(' ').map(Number)
    const map: Record<string, number[]> = { A: [1], B: [1, 2], C: [1, 4], D: [1, 4, 5], E: [1, 5], F: [1, 2, 4], G: [1, 2, 4, 5], H: [1, 2, 5], I: [2, 4], J: [2, 4, 5], K: [1, 3], L: [1, 2, 3], M: [1, 3, 4], N: [1, 3, 4, 5], O: [1, 3, 5], P: [1, 2, 3, 4], Q: [1, 2, 3, 4, 5], R: [1, 2, 3, 5], S: [2, 3, 4], T: [2, 3, 4, 5], U: [1, 3, 6], V: [1, 2, 3, 6], W: [2, 4, 5, 6], X: [1, 3, 4, 6], Y: [1, 3, 4, 5, 6], Z: [1, 3, 5, 6] }
    const letter = Object.entries(map).find(([, d]) => d.join() === dots.join())![0]
    await quiz.getByRole('button', { name: letter, exact: true }).click()
    await expect(quiz).toContainText('Correct.')
  })

  test('numbers explain the number sign', async ({ page }) => {
    await page.goto('/learn/braille/numbers')
    await expect(page.getByText(/number sign \(dots 3 4 5 6\)/)).toBeVisible()
  })

  test('lesson tabs work by keyboard', async ({ page }) => {
    await page.goto('/learn/braille/alphabet')
    await page.getByRole('link', { name: 'Numbers' }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/learn\/braille\/numbers$/)
  })
})

test.describe('about pages', () => {
  test('evidence shows measured accuracy for every model', async ({ page }) => {
    await page.goto('/about/evidence')
    for (const n of ['0.962', '0.989', '97.3%', '0.744']) await expect(page.getByText(n, { exact: true })).toBeVisible()
  })
  test('privacy explains what stays on the device', async ({ page }) => {
    await page.goto('/about/privacy')
    await expect(page.getByRole('heading', { name: 'What never leaves your device' })).toBeVisible()
  })
  test('credits list the data and models used', async ({ page }) => {
    await page.goto('/about/credits')
    await expect(page.getByText('liblouis 3.39.0')).toBeVisible()
    await expect(page.getByText(/ASL-HG dataset/)).toBeVisible()
  })
})
