import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

type Metrics = {
  state: string; connectMs: number | null; rttMedianMs: number | null; rttP95Ms: number | null; rttSamples: number
  deliveryMedianMs: number | null; lmAvgKbps: number; link: string | null
  totals: { sentBytes: number; textPackets: number; textBytes: number; lmPackets: number; lmBytes: number }
}
const CODE = /\/bridge\/([2-9A-HJKMNP-Z]{6})$/
const metrics = (p: Page) => p.evaluate(() => (window as unknown as { __bridgeMetrics: unknown }).__bridgeMetrics) as Promise<Metrics>
const latest = (p: Page) => p.getByRole('region', { name: /^Latest from/ })

/** Starts a conversation on `page` and returns its code. */
async function startHost(page: Page, name = '') {
  await page.goto('/bridge')
  if (name) await page.getByLabel('Your name').fill(name)
  await page.getByRole('button', { name: 'Start a conversation' }).click()
  await expect(page).toHaveURL(CODE)
  await expect(page.getByTestId('room-code')).toBeVisible()
  return CODE.exec(new URL(page.url()).pathname)![1]!
}

/** A second tab whose saved Bridge name differs from the first one's. */
async function guestTab(context: BrowserContext, name: string) {
  const g = await context.newPage()
  await g.addInitScript((n) => localStorage.setItem('bridgify.bridge.v1', JSON.stringify({ state: { name: n, receive: 'captions', send: 'type', grade: 'g1', showHands: false }, version: 1 })), name)
  return g
}

test.describe('Bridge between two tabs (same-browser link)', () => {
  test('connect, type, switch to braille, then leave', async ({ context, page }) => {
    const code = await startHost(page, 'Asha')
    const guest = await guestTab(context, 'Riya')
    const t0 = Date.now()
    await guest.goto(`/bridge/${code}?via=local`)
    await expect(guest.getByRole('heading', { name: 'Talking with Asha' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Talking with Riya' })).toBeVisible()
    const connectedAfter = Date.now() - t0
    expect(connectedAfter).toBeLessThan(2000) // FR-BG-01: both see Connected within 2 s

    // A types → B sees it, large, and the sender gets a delivery receipt.
    await page.getByLabel('Your message').fill('Where is the hospital?')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(latest(guest)).toContainText('Where is the hospital?')
    await expect(page.getByRole('region', { name: 'Conversation so far' })).toContainText('delivered')

    // B switches how they receive to braille → cells appear, and A is told.
    await guest.getByRole('radio', { name: 'Braille' }).click()
    await expect(latest(guest).getByRole('list', { name: 'Braille cells' }).locator('li').first()).toBeVisible()
    await expect(page.getByText('Riya reads braille (Grade 1) and types.')).toBeVisible()

    // B answers with a quick phrase; A reads it as captions.
    await guest.getByRole('radio', { name: 'Quick phrases' }).click()
    await guest.getByRole('tab', { name: 'Emergency' }).click()
    await guest.getByRole('button', { name: 'Call an ambulance' }).click()
    await expect(latest(page)).toContainText('Call an ambulance')
    await expect(latest(page)).toContainText('quick phrase')

    // Leaving ends the room for both.
    await page.getByRole('button', { name: 'Leave' }).click()
    await expect(guest.getByText('Asha left the conversation.')).toBeVisible()
    await expect(page.getByText('You left the conversation.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save the conversation' })).toBeVisible()
    console.log(`[bridge] local link: both connected ${connectedAfter} ms after the guest opened the link`)
  })

  test('receiving as sign plays the stored ISL sign for a typed message', async ({ context, page }) => {
    const code = await startHost(page, 'Asha')
    const guest = await guestTab(context, 'Riya')
    await guest.goto(`/bridge/${code}?via=local`)
    await expect(guest.getByRole('heading', { name: 'Talking with Asha' })).toBeVisible()
    await guest.getByRole('radio', { name: 'Sign' }).click()
    await page.getByLabel('Your message').fill('I need a doctor')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    // The guest's phone converts the text itself: ISL word order, then the stored phrase animation.
    await expect(latest(guest).locator('[aria-label^="Sign for "], [aria-label^="Signer video for "]').first()).toBeVisible({ timeout: 20_000 })
    await expect(latest(guest)).not.toContainText('no stored sign')
  })

  test('keyboard only: type a messy code, Tab to Join, Enter, then send with Enter', async ({ context, page, isMobile }) => {
    test.skip(isMobile, 'physical keyboard flow')
    const code = await startHost(page)
    const guest = await guestTab(context, 'Riya')
    await guest.goto('/bridge')
    await guest.getByLabel('Code from the other phone').focus()
    await guest.keyboard.type(`${code.slice(0, 3).toLowerCase()} ${code.slice(3).toLowerCase()}`)
    await guest.keyboard.press('Tab')
    await expect(guest.getByRole('button', { name: 'Join' })).toBeFocused()
    await guest.keyboard.press('Enter')
    await expect(guest).toHaveURL(new RegExp(`/bridge/${code}$`)) // no ?via: this browser is found first
    await expect(guest.getByText(/^Connected/)).toBeVisible()
    await guest.getByLabel('Your message').focus()
    await guest.keyboard.type('Hello from the keyboard')
    await guest.keyboard.press('Enter')
    await expect(latest(page)).toContainText('Hello from the keyboard')
  })

  test('bad codes get a plain message, and nobody is waiting on an unused code', async ({ page }) => {
    await page.goto('/bridge')
    const input = page.getByLabel('Code from the other phone')
    await input.fill('K7M0QX')
    await input.press('Enter')
    await expect(page.getByRole('alert')).toContainText('Codes never use 0, O, 1, I or L')
    await expect(input).toBeFocused()
    await input.fill('k7m')
    await page.getByRole('button', { name: 'Join' }).click()
    await expect(page.getByRole('alert')).toContainText('too short')
    await page.goto('/bridge/ZZZZZZ?via=local')
    await expect(page.getByRole('alert')).toContainText('No one is using code ZZZ ZZZ right now')
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    await page.goto('/bridge/HELLO1')
    await expect(page.getByRole('alert')).toContainText("This link's code doesn't work")
  })

  test('a third tab with the code is turned away', async ({ context, page }) => {
    const code = await startHost(page, 'Asha')
    const second = await guestTab(context, 'Riya')
    await second.goto(`/bridge/${code}?via=local`)
    await expect(second.getByText(/^Connected/)).toBeVisible()
    const third = await guestTab(context, 'Sam')
    await third.goto(`/bridge/${code}?via=local`)
    await expect(third.getByRole('alert')).toContainText('already has two people', { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Talking with Riya' })).toBeVisible()
  })

  test('meter: round trip and bytes per message', async ({ context, page }) => {
    test.setTimeout(60_000)
    const code = await startHost(page, 'Asha')
    const guest = await guestTab(context, 'Riya')
    await guest.goto(`/bridge/${code}?via=local`)
    await expect(guest.getByText(/^Connected/)).toBeVisible()
    for (let i = 1; i <= 10; i++) {
      await page.getByLabel('Your message').fill(`Message number ${i}, are you okay?`)
      await page.getByLabel('Your message').press('Enter')
    }
    await expect(latest(guest)).toContainText('Message number 10')
    await expect.poll(async () => (await metrics(page)).rttSamples, { timeout: 20_000 }).toBeGreaterThanOrEqual(2)
    const m = await metrics(page)
    expect(m.rttMedianMs).not.toBeNull()
    expect(m.totals.textPackets).toBe(10)
    const perText = m.totals.textBytes / m.totals.textPackets
    expect(perText).toBeLessThan(160) // about 100 B per text packet (SYSTEM-ARCHITECTURE §11)
    await expect(page.getByText(/round trip \d+ ms \(median \d+, p95 \d+\)/)).toBeVisible()
    console.log(`[bridge] local link: RTT median ${m.rttMedianMs} ms, p95 ${m.rttP95Ms} ms (${m.rttSamples} pings); text packet ${perText.toFixed(0)} B; delivery median ${m.deliveryMedianMs} ms; connect ${(await metrics(guest)).connectMs} ms`)
  })
})

const MODES = ['light', 'dark', 'high-contrast', 'solarized', 'night-blue', 'forest', 'sepia', 'calm', 'focus', 'low-vision', 'autism', 'dyslexia']
async function seriousViolations(page: Page, where: string) {
  const out: string[] = []
  for (const mode of MODES) {
    await page.evaluate((m) => { document.documentElement.dataset.mode = m }, mode)
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    for (const v of res.violations) if (v.impact === 'serious' || v.impact === 'critical') out.push(`${where} [${mode}]: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)
  }
  return out
}

test('show my hands: a moving hand streams at up to 15 Hz and stays under 15 kbps', async ({ context, page }) => {
  test.setTimeout(60_000)
  const code = await startHost(page, 'Asha')
  const guest = await guestTab(context, 'Riya')
  await guest.goto(`/bridge/${code}?via=local`)
  await expect(page.getByRole('heading', { name: 'Talking with Riya' })).toBeVisible()
  // One open hand moving in a slow circle, offered at camera rate (30 fps) for 10 s.
  await page.evaluate(() => new Promise<void>((done) => {
    const w = window as unknown as { __bridgeTest: { sendHands: (h: unknown[]) => void } }
    const t0 = performance.now()
    const timer = setInterval(() => {
      const t = (performance.now() - t0) / 1000
      if (t > 10) { clearInterval(timer); done(); return }
      const cx = 0.5 + 0.15 * Math.sin(t * 2); const cy = 0.5 + 0.1 * Math.cos(t * 2)
      const landmarks = Array.from({ length: 21 }, (_, i) => ({ x: cx + Math.cos(i) * 0.08, y: cy + Math.sin(i) * 0.1 - i * 0.004, z: 0 }))
      w.__bridgeTest.sendHands([{ landmarks, handedness: 'Right', score: 0.95 }])
    }, 33)
  }))
  await expect(guest.getByRole('img', { name: "Live outline of Asha's hands" })).toBeVisible()
  const m = await metrics(page)
  const perPacket = m.totals.lmBytes / m.totals.lmPackets
  const kbps = (m.totals.lmBytes * 8) / 10 / 1000
  console.log(`[bridge] hands (synthetic, moving, 30 fps in): ${(m.totals.lmPackets / 10).toFixed(1)} packets/s, ${perPacket.toFixed(0)} B each, ${kbps.toFixed(1)} kbps average over 10 s (stream ${m.lmAvgKbps} kbps)`)
  expect(m.totals.lmPackets / 10).toBeLessThanOrEqual(15.5)
  expect(m.totals.lmPackets / 10).toBeGreaterThan(5)
  expect(kbps).toBeLessThan(15) // FR-BG-03
})

test('no serious accessibility violations on any Bridge screen, in all 12 modes', async ({ context, page, isMobile }) => {
  test.skip(isMobile, 'mode sweep runs on desktop')
  test.setTimeout(120_000)
  const bad: string[] = []
  await page.goto('/bridge')
  bad.push(...await seriousViolations(page, 'start'))
  const code = await startHost(page, 'Asha')
  bad.push(...await seriousViolations(page, 'waiting'))
  const guest = await guestTab(context, 'Riya')
  await guest.goto(`/bridge/${code}?via=local`)
  await expect(guest.getByText(/^Connected/)).toBeVisible()
  await page.getByLabel('Your message').fill('Where is the hospital?')
  await page.getByLabel('Your message').press('Enter')
  await expect(latest(guest)).toContainText('Where is the hospital?')
  bad.push(...await seriousViolations(guest, 'conversation, captions'))
  await guest.getByRole('radio', { name: 'Braille' }).click()
  await guest.getByRole('radio', { name: 'Fingerspell' }).click()
  bad.push(...await seriousViolations(guest, 'conversation, braille + fingerspell'))
  await page.getByRole('button', { name: 'Leave' }).click()
  await expect(guest.getByText('Asha left the conversation.')).toBeVisible()
  bad.push(...await seriousViolations(guest, 'ended'))
  expect(bad).toEqual([])
})

test.describe('Bridge between two phones through the public PeerJS broker @online', () => {
  test.skip(Boolean(process.env.OFFLINE), 'offline run')

  test('connects two browser contexts and exchanges text both ways', async ({ browser, browserName }) => {
    test.setTimeout(90_000)
    test.skip(browserName !== 'chromium', 'WebRTC check runs on Chromium')
    const reachable = await fetch(`https://0.peerjs.com/peerjs/id?ts=${Date.now()}`, { signal: AbortSignal.timeout(10_000) }).then((r) => r.ok).catch(() => false)
    test.skip(!reachable, 'PeerJS broker is not reachable from this machine')
    const a = await browser.newContext()
    const b = await browser.newContext()
    try {
      const host = await a.newPage()
      const code = await startHost(host, 'Asha')
      // Wait until the broker has registered the code ("Waiting for the other phone").
      const waiting = host.getByText('Waiting for the other phone to join')
      const down = host.getByText("Phones can't reach this conversation right now")
      await expect(waiting.or(down)).toBeVisible({ timeout: 30_000 })
      test.skip(await down.isVisible(), 'broker refused the connection')
      const guest = await b.newPage()
      const t0 = Date.now()
      await guest.goto(`/bridge/${code}?via=peer`)
      await expect(guest.getByRole('heading', { name: 'Talking with Asha' })).toBeVisible({ timeout: 30_000 })
      const connectMs = Date.now() - t0
      await host.getByLabel('Your message').fill('Hello over WebRTC')
      await host.getByLabel('Your message').press('Enter')
      await expect(latest(guest)).toContainText('Hello over WebRTC')
      await guest.getByLabel('Your message').fill('Loud and clear')
      await guest.getByLabel('Your message').press('Enter')
      await expect(latest(host)).toContainText('Loud and clear')
      await expect.poll(async () => (await metrics(guest)).rttSamples, { timeout: 20_000 }).toBeGreaterThanOrEqual(2)
      const m = await metrics(guest)
      expect(m.link).toBe('peer')
      console.log(`[bridge] peer link: guest connected ${connectMs} ms after opening the link (session ${m.connectMs} ms); RTT median ${m.rttMedianMs} ms, p95 ${m.rttP95Ms} ms; delivery ${m.deliveryMedianMs} ms`)
      await guest.getByRole('button', { name: 'Leave' }).click()
      await expect(host.getByText(/left the conversation/)).toBeVisible({ timeout: 15_000 })
    } finally {
      await a.close()
      await b.close()
    }
  })
})

// "Show my hands" with a real camera pipeline: held-out signer photos as a fake webcam.
// Needs ffmpeg and the hand model download; run with SLOW=1.
test('show my hands streams landmarks under 15 kbps', async () => {
  test.skip(!process.env.SLOW, 'set SLOW=1 to run the camera pipeline')
  test.skip(test.info().project.name !== 'desktop', 'launches its own browser; once is enough')
  test.setTimeout(180_000)
  const fx = (f: string) => fileURLToPath(new URL(`./fixtures/${f}`, import.meta.url))
  const out = fileURLToPath(new URL('../test-results/camera/', import.meta.url))
  mkdirSync(out, { recursive: true })
  // An open hand that keeps moving (a slow circle), so every frame differs: the worst case for bandwidth.
  const y4m = `${out}bridge-hands-moving.y4m`
  if (!existsSync(y4m)) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', fx('asl-B-heldout.png'), '-t', '12',
      '-vf', "scale=640:480,crop=560:420:x='40+40*sin(2*PI*t/3)':y='30+30*cos(2*PI*t/3)',scale=640:480,fps=15,format=yuv420p",
      '-f', 'yuv4mpegpipe', y4m])
  }
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`] })
  const base = process.env.BASE_URL ?? 'http://localhost:4173'
  const context = await browser.newContext({ baseURL: base })
  try {
    const page = await context.newPage()
    const code = await startHost(page, 'Asha')
    const guest = await guestTab(context, 'Riya')
    await guest.goto(`/bridge/${code}?via=local`)
    await expect(page.getByRole('heading', { name: 'Talking with Riya' })).toBeVisible()
    await page.getByRole('radio', { name: 'Fingerspell' }).click()
    await page.getByRole('switch', { name: /Show my hands/ }).click()
    await page.getByRole('button', { name: 'Start camera' }).click()
    await expect(guest.getByRole('img', { name: "Live outline of Asha's hands" })).toBeVisible({ timeout: 90_000 })
    const before = await metrics(page)
    await page.waitForTimeout(20_000)
    const m = await metrics(page)
    const packets = m.totals.lmPackets - before.totals.lmPackets
    const bytes = m.totals.lmBytes - before.totals.lmBytes
    const camera = await page.getByText(/fps · .* ms per frame/).innerText().catch(() => 'camera stats unavailable')
    console.log(`[bridge] hands, moving: ${(packets / 20).toFixed(1)} packets/s, ${(bytes / Math.max(1, packets)).toFixed(0)} B each, ${((bytes * 8) / 20 / 1000).toFixed(1)} kbps over 20 s (stream average ${m.lmAvgKbps} kbps); camera ${camera}`)
    expect(packets).toBeGreaterThan(10) // headless vision runs at a few fps; real devices 24–30
    expect((bytes * 8) / 20 / 1000).toBeLessThan(15) // FR-BG-03: under 15 kbps
  } finally {
    await browser.close()
  }
})
