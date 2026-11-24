import { test, expect } from '@playwright/test'
import golden from '../src/engines/braille/__fixtures__/golden.json' with { type: 'json' }

type Case = { table: string; input: string; expected: string; mode?: string; direction?: string }
const cases = ((golden as unknown as { cases?: Case[] }).cases ?? (golden as unknown as Case[]))
const find = (table: string, input: string) => cases.find((c) => c.table === table && c.input === input)

const output = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Braille output' })

test.describe('text to braille', () => {
  test('report case: grade 1 matches liblouis exactly', async ({ page }) => {
    await page.goto('/tools/text-to-braille')
    await page.getByLabel('Text').fill('HELLO, HOW ARE YOU?')
    const want = find('en-ueb-g1', 'HELLO, HOW ARE YOU?')?.expected ?? '⠠⠠⠠⠓⠑⠇⠇⠕⠂⠀⠓⠕⠺⠀⠁⠗⠑⠀⠽⠕⠥⠦⠠⠄'
    await expect(output(page).getByLabel(/^Braille text:/)).toHaveText(want)
    await expect(output(page)).not.toContainText('Offline')
  })

  test('report case: grade 2 contracts THE RED FORT', async ({ page }) => {
    await page.goto('/tools/text-to-braille')
    await page.getByRole('radio', { name: 'Grade 2' }).click()
    await page.getByLabel('Text').fill('THE RED FORT')
    await expect(output(page).getByLabel(/^Braille text:/)).toHaveText(find('en-ueb-g2', 'THE RED FORT')?.expected ?? '⠠⠠⠠⠮⠀⠗⠫⠀⠿⠞⠠⠄')
  })

  test('Hindi Bharati braille', async ({ page }) => {
    await page.goto('/tools/text-to-braille')
    await page.getByRole('radio', { name: 'Hindi (Bharati)' }).click()
    const hi = cases.find((c) => c.table === 'hi-in-g1' && ((c as Case & { kind?: string }).kind ?? 'translate') === 'translate')!
    await page.getByLabel('Text').fill(hi.input)
    await expect(output(page).getByLabel(/^Braille text:/)).toHaveText(hi.expected)
  })

  test('download produces the conversation log', async ({ page }) => {
    await page.goto('/tools/text-to-braille')
    await page.getByLabel('Text').fill('Hi')
    await expect(output(page).getByLabel(/^Braille text:/)).toHaveText('⠠⠓⠊')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download .txt' }).click()])
    const path = await dl.path()
    const text = (await import('node:fs')).readFileSync(path!, 'utf8')
    expect(text).toContain('[1] Input: Hi')
  })
})

test.describe('braille to text', () => {
  test('keyboard chording F+J writes c, then H-I reads as text', async ({ page, isMobile }) => {
    test.skip(isMobile, 'physical keyboard flow')
    await page.goto('/tools/braille-to-text')
    await page.getByRole('application', { name: /Braille keyboard/ }).focus()
    const chord = async (keys: string[]) => { for (const k of keys) await page.keyboard.down(k); for (const k of keys) await page.keyboard.up(k) }
    await chord(['f', 'j']) // c
    await expect(page.getByRole('region', { name: 'Result' })).toContainText('c')
    await page.keyboard.press('Backspace')
    await chord(['f', 'd', 'k']) // h = dots 1 2 5
    await chord(['d', 'j']) // i = dots 2 4
    await expect(page.getByRole('region', { name: 'Result' })).toContainText('hi')
  })

  test('touch: tap dots and add cells', async ({ page }) => {
    await page.goto('/tools/braille-to-text')
    for (const d of [1, 2, 5]) await page.getByRole('button', { name: `Dot ${d}` }).click()
    await page.getByRole('button', { name: 'Add cell' }).click()
    for (const d of [2, 4]) await page.getByRole('button', { name: `Dot ${d}` }).click()
    await page.getByRole('button', { name: 'Add cell' }).click()
    await expect(page.getByRole('region', { name: 'Result' })).toContainText('hi')
  })
})
