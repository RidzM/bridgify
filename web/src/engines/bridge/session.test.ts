import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BridgeSession, defaultProfile, type ChatMessage } from './session'
import type { LinkHandlers, Transport } from './transport'
import { LocalTransport } from './transport'

/** Two in-memory transports wired together; deliver() moves queued data. */
class Wire {
  queue: { to: Fake; data: string }[] = []
  deliver() { while (this.queue.length) { const m = this.queue.shift()!; if (m.to.open) m.to.h.message(m.data, 'local') } }
}
class Fake implements Transport {
  readonly kind = 'local' as const
  open = false
  other: Fake | null = null
  sent: string[] = []
  kicked = 0
  h: LinkHandlers
  wire: Wire
  constructor(h: LinkHandlers, wire: Wire) { this.h = h; this.wire = wire }
  start() {}
  send(d: string) { if (!this.open || !this.other) return false; this.sent.push(d); this.wire.queue.push({ to: this.other, data: d }); return true }
  isOpen() { return this.open }
  relink() { this.open = false }
  kick() { this.kicked++; this.open = false }
  stop() { this.open = false }
}

function room() {
  const wire = new Wire()
  let ht!: Fake
  let gt!: Fake
  const host = new BridgeSession({ code: 'K7M2QX', role: 'host', profile: { ...defaultProfile(), name: 'Asha' }, transport: (h) => (ht = new Fake(h, wire)) })
  const guest = new BridgeSession({ code: 'K7M2QX', role: 'guest', profile: { ...defaultProfile(), name: 'Riya', receive: 'braille' }, transport: (h) => (gt = new Fake(h, wire)) })
  host.start(); guest.start()
  const link = () => {
    ht.other = gt; gt.other = ht; ht.open = gt.open = true
    ht.h.open('local'); gt.h.open('local')
    wire.deliver()
  }
  const drop = () => { ht.open = gt.open = false; ht.h.drop('local'); gt.h.drop('local') }
  return { host, guest, wire, link, drop, ht: () => ht, gt: () => gt }
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] }) })
afterEach(() => { vi.useRealTimers() })

describe('bridge session', () => {
  it('connects and exchanges profiles', () => {
    const r = room()
    expect(r.host.snapshot.state).toBe('waiting')
    expect(r.guest.snapshot.state).toBe('connecting')
    r.link()
    expect(r.host.snapshot.state).toBe('connected')
    expect(r.guest.snapshot.state).toBe('connected')
    expect(r.host.snapshot.peerProfile?.name).toBe('Riya')
    expect(r.host.snapshot.peerProfile?.receive).toBe('braille')
    expect(r.guest.snapshot.peerProfile?.name).toBe('Asha')
  })

  it('delivers text and confirms it with a receipt', () => {
    const r = room()
    r.link()
    const got: ChatMessage[] = []
    const updates: string[] = []
    r.host.onChatMessage((m) => got.push(m))
    r.guest.onMessageUpdate((id, s) => updates.push(`${id}:${s}`))
    const m = r.guest.sendText('  Where is the hospital?  ', 'typed', 'en-IN')!
    expect(m.state).toBe('sent')
    r.wire.deliver()
    expect(got.map((g) => g.text)).toEqual(['Where is the hospital?'])
    expect(got[0]!.mine).toBe(false)
    expect(updates).toEqual([`${m.id}:delivered`])
  })

  it('keeps messages typed while reconnecting and sends them after', () => {
    const r = room()
    r.link()
    r.drop()
    expect(r.guest.snapshot.state).toBe('reconnecting')
    const m = r.guest.sendText('Still there?', 'typed', 'en-IN')!
    expect(m.state).toBe('queued')
    const got: string[] = []
    r.host.onChatMessage((x) => got.push(x.text))
    r.link()
    r.wire.deliver()
    expect(got).toEqual(['Still there?'])
  })

  it('ends for both when one person leaves', () => {
    const r = room()
    r.link()
    r.guest.leave()
    r.wire.deliver()
    expect(r.guest.snapshot).toMatchObject({ state: 'ended', ended: 'you-left' })
    expect(r.host.snapshot).toMatchObject({ state: 'ended', ended: 'left' })
  })

  it('turns away a third person who has the code', () => {
    const r = room()
    r.link()
    // A different guest (new sid) arrives on the host's link.
    r.ht().h.message(JSON.stringify({ k: 'hello', v: 1, ts: 1, from: 'stranger', sid: 'stranger', profile: defaultProfile() }), 'local')
    r.wire.deliver()
    vi.advanceTimersByTime(400)
    expect(r.ht().kicked).toBe(1)
    expect(r.ht().sent.some((s) => s.includes('"k":"full"'))).toBe(true)
    expect(r.host.snapshot.peerProfile?.name).toBe('Riya')
  })

  it('ignores malformed packets and data before hello', () => {
    const r = room()
    const got: string[] = []
    r.host.onChatMessage((m) => got.push(m.text))
    r.ht().other = r.gt(); r.ht().open = true
    r.ht().h.message(JSON.stringify({ k: 'text', id: 'x1', ts: 1, from: 'g', text: 'sneaky', lang: 'en', src: 'typed' }), 'local')
    r.ht().h.message('{"k":', 'local')
    r.ht().h.message('x'.repeat(9000), 'local')
    expect(got).toEqual([])
    expect(r.host.snapshot.state).toBe('waiting')
  })

  it('measures round-trip time with ping/pong every 5 s', () => {
    const r = room()
    r.link()
    vi.advanceTimersByTime(5000)
    r.wire.deliver()
    expect(r.guest.metrics.snapshot().rttSamples).toBeGreaterThan(0)
    expect(r.host.metrics.snapshot().rttSamples).toBeGreaterThan(0)
  })

  it('notices silence, reconnects, then gives up after the window', () => {
    const r = room()
    r.link()
    r.ht().open = r.gt().open = false // link dies silently
    vi.advanceTimersByTime(16_000)
    expect(r.guest.snapshot.state).toBe('reconnecting')
    vi.advanceTimersByTime(31_000)
    expect(r.guest.snapshot).toMatchObject({ state: 'ended', ended: 'lost' })
  })

  it('expires after 30 minutes without messages', () => {
    const r = room()
    r.link()
    for (let i = 0; i < 31 * 12; i++) { vi.advanceTimersByTime(5000); r.wire.deliver() } // pings keep the link alive
    expect(r.host.snapshot.ended === 'expired' || r.guest.snapshot.ended === 'expired').toBe(true)
  })

  it('updates the other side when a profile changes', () => {
    const r = room()
    r.link()
    r.guest.setProfile({ ...defaultProfile(), name: 'Riya', receive: 'speech' })
    r.wire.deliver()
    expect(r.host.snapshot.peerProfile?.receive).toBe('speech')
  })
})

describe('local transport (BroadcastChannel)', () => {
  it('host welcomes the first guest and turns away a second', async () => {
    vi.useRealTimers()
    const events: string[] = []
    const mk = (role: 'host' | 'guest', tag: string) => new LocalTransport('ABCDEF', role, {
      open: () => events.push(`${tag}:open`),
      message: (d) => events.push(`${tag}:msg:${d}`),
      drop: () => events.push(`${tag}:drop`),
      fail: (r) => events.push(`${tag}:fail:${r}`),
    }, 300)
    const host = mk('host', 'h'); host.start()
    const g1 = mk('guest', 'g1'); g1.start()
    await new Promise((r) => setTimeout(r, 50))
    expect(events).toContain('h:open')
    expect(events).toContain('g1:open')
    g1.send('hello')
    host.send('hi back')
    await new Promise((r) => setTimeout(r, 50))
    expect(events).toContain('h:msg:hello')
    expect(events).toContain('g1:msg:hi back')
    const g2 = mk('guest', 'g2'); g2.start()
    await new Promise((r) => setTimeout(r, 50))
    expect(events).not.toContain('g2:open')
    g1.stop()
    await new Promise((r) => setTimeout(r, 50))
    expect(events).toContain('h:drop')
    host.stop(); g2.stop()
  })
  it('reports not-found when nobody has the code', async () => {
    vi.useRealTimers()
    let failed = ''
    const g = new LocalTransport('ZZZZZZ', 'guest', { open: () => {}, message: () => {}, drop: () => {}, fail: (r) => { failed = r } }, 100)
    g.start()
    await new Promise((r) => setTimeout(r, 200))
    expect(failed).toBe('not-found')
    g.stop()
  })
})
