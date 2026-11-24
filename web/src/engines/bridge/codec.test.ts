import { describe, expect, it } from 'vitest'
import { codeProblem, isValidCode, newRoomCode, normalizeCode, ROOM_ALPHABET, spacedCode, speakableCode } from './code'
import { decodePacket, encodePacket, MAX_PACKET_BYTES, utf8Bytes, type Packet, type Profile } from './packets'
import { HandStreamGate, LM_BUDGET_BYTES_PER_S, packHands, unpackHands } from './landmarks'
import { BridgeMetrics, percentile } from './metrics'
import { encodeQr, qrPath } from './qr'
import fixtures from './__fixtures__/qr-qrencode.json'
import type { Hand } from '@/engines/vision/types'

const profile: Profile = { name: 'Riya', receive: 'braille', send: 'fingerspell', lang: 'en-IN', signLang: 'isl', grade: 'g1' }

describe('room codes', () => {
  it('uses only the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const c = newRoomCode()
      expect(c).toMatch(new RegExp(`^[${ROOM_ALPHABET}]{6}$`))
      expect(c).not.toMatch(/[01ILO]/)
    }
  })
  it('accepts messy input: lowercase, spaces, dashes, a pasted link', () => {
    expect(normalizeCode(' k7m 2qx ')).toBe('K7M2QX')
    expect(normalizeCode('k7m-2qx')).toBe('K7M2QX')
    expect(normalizeCode('https://bridgify.app/bridge/k7m2qx?x=1')).toBe('K7M2QX')
    expect(isValidCode(normalizeCode('k7m 2qx'))).toBe(true)
  })
  it('explains what is wrong in plain words', () => {
    expect(codeProblem('')).toMatch(/Type the 6-character code/)
    expect(codeProblem('K7M')).toMatch(/too short/)
    expect(codeProblem('K7M2QXA')).toMatch(/too long/)
    expect(codeProblem('K0M2QX')).toMatch(/never use 0, O, 1, I or L/)
    expect(codeProblem('k7m2qx')).toBeNull()
  })
  it('formats for eyes and for speech', () => {
    expect(spacedCode('K7M2QX')).toBe('K7M 2QX')
    expect(speakableCode('K7M2QX')).toBe('K, 7, M, 2, Q, X')
  })
})

describe('packets', () => {
  const text: Packet = { k: 'text', id: 'abc123', ts: 1, from: 'me1', text: 'Are you hurt?', lang: 'en-IN', src: 'speech' }
  it('round-trips every packet kind', () => {
    const all: Packet[] = [
      { k: 'hello', v: 1, ts: 1, from: 'me1', sid: 'me1', profile },
      text,
      { k: 'gloss', id: 'g1', ts: 1, from: 'me1', gloss: ['HOSPITAL', 'WHERE'], lang: 'isl' },
      { k: 'lm', ts: 1, from: 'me1', hands: 'AAEC', mask: 1 },
      { k: 'status', ts: 1, from: 'me1', typing: true },
      { k: 'receipt', id: 'abc123', ts: 2 },
      { k: 'ping', ts: 1, t0: 12.5 },
      { k: 'pong', ts: 1, t0: 12.5 },
      { k: 'bye', ts: 1, from: 'me1' },
      { k: 'full', ts: 1 },
    ]
    for (const p of all) expect(decodePacket(encodePacket(p))).toEqual(p)
  })
  it('keeps a text packet around 100 bytes', () => {
    expect(utf8Bytes(encodePacket(text))).toBeLessThan(120)
  })
  it('rejects malformed, unknown and oversized packets', () => {
    expect(decodePacket('not json')).toBeNull()
    expect(decodePacket(42)).toBeNull()
    expect(decodePacket('[]')).toBeNull()
    expect(decodePacket(JSON.stringify({ k: 'nope', ts: 1 }))).toBeNull()
    expect(decodePacket(JSON.stringify({ ...text, ts: 'soon' }))).toBeNull()
    expect(decodePacket(JSON.stringify({ ...text, src: 'telepathy' }))).toBeNull()
    expect(decodePacket(JSON.stringify({ ...text, text: '   ' }))).toBeNull()
    expect(decodePacket(JSON.stringify({ ...text, id: '<script>' }))).toBeNull()
    expect(decodePacket(JSON.stringify({ k: 'lm', ts: 1, from: 'a', hands: 'not base64!', mask: 1 }))).toBeNull()
    expect(decodePacket(JSON.stringify({ k: 'lm', ts: 1, from: 'a', hands: 'AAAA', mask: 99 }))).toBeNull()
    const big = JSON.stringify({ ...text, text: 'x'.repeat(MAX_PACKET_BYTES) })
    expect(decodePacket(big)).toBeNull()
    // Multi-byte text is measured in UTF-8 bytes, not characters.
    expect(decodePacket(JSON.stringify({ ...text, text: 'है'.repeat(1500) }))).toBeNull()
  })
  it('drops unknown fields and control characters', () => {
    const p = decodePacket(JSON.stringify({ ...text, text: 'hi\u0007 there', extra: { evil: true } }))
    expect(p).toEqual({ ...text, text: 'hi there' })
    const hello = decodePacket(JSON.stringify({ k: 'hello', v: 1, ts: 1, from: 'a', sid: 'a', profile: { ...profile, name: '  Riya\u0000  Sharma ' } }))
    expect(hello && hello.k === 'hello' && hello.profile.name).toBe('Riya Sharma')
  })
})

const hand = (dx = 0, side: 'Left' | 'Right' = 'Right'): Hand => ({
  handedness: side,
  score: 0.9,
  landmarks: Array.from({ length: 21 }, (_, i) => ({ x: 0.3 + i * 0.01 + dx, y: 0.6 - i * 0.012, z: -0.02 })),
})

describe('hand landmarks', () => {
  it('packs Int16 ×1000 and unpacks to within 0.001', () => {
    const packed = packHands([hand(0, 'Left'), hand(0.2)])
    expect(packed.mask).toBe(0b0111)
    const back = unpackHands(packed.hands, packed.mask)!
    expect(back).toHaveLength(2)
    expect(back[0]!.left).toBe(true)
    expect(back[1]!.left).toBe(false)
    expect(Math.abs(back[1]!.points[20]!.x - (0.3 + 0.2 + 0.2))).toBeLessThan(0.001)
  })
  it('one hand fits the 15 kbps budget at a useful frame rate', () => {
    const { hands, mask } = packHands([hand()])
    const bytes = utf8Bytes(encodePacket({ k: 'lm', ts: Date.now(), from: 'abcdefghijkl', hands, mask }))
    expect(bytes).toBeLessThan(200)
    expect(LM_BUDGET_BYTES_PER_S / bytes).toBeGreaterThanOrEqual(8.5) // about 9 frames per second within budget
  })
  it('rejects data that does not match the mask', () => {
    expect(unpackHands(packHands([hand()]).hands, 0b11)).toBeNull()
  })
  it('gate: ≤ 15 Hz, skips still hands, keeps the average under budget', () => {
    const g = new HandStreamGate()
    let sent = 0
    let bytes = 0
    for (let t = 0; t < 10_000; t += 33) { // 30 fps for 10 s, hand always moving
      if (g.offer(t, [hand((t % 1000) / 4000)], 170) === 'send') { sent++; bytes += 170 }
    }
    expect(sent / 10).toBeLessThanOrEqual(15)
    expect((bytes * 8) / 10 / 1000).toBeLessThan(15) // FR-BG-03, burst included
    // Two hands (bigger packets) are held to the same budget.
    const two = new HandStreamGate()
    let twoBytes = 0
    for (let t = 0; t < 10_000; t += 33) if (two.offer(t, [hand((t % 1000) / 4000), hand(0.3 + (t % 1000) / 4000, 'Left')], 300) === 'send') twoBytes += 300
    expect((twoBytes * 8) / 10 / 1000).toBeLessThan(15)
    const still = new HandStreamGate()
    let stillSent = 0
    for (let t = 0; t < 5000; t += 33) if (still.offer(t, [hand()], 170) === 'send') stillSent++
    expect(stillSent).toBeLessThanOrEqual(6) // keyframe about once a second
    expect(still.offer(6000, [], 20)).toBe('clear')
    expect(still.offer(6100, [], 20)).toBeNull()
  })
})

describe('metrics', () => {
  it('computes percentiles', () => {
    expect(percentile([], 50)).toBeNull()
    expect(percentile([5, 1, 3], 50)).toBe(3)
    expect(percentile([...Array(100).keys()].map((i) => i + 1), 95)).toBe(95)
  })
  it('reports bytes per second over a 5 s window and RTT stats', () => {
    let now = 0
    const m = new BridgeMetrics(() => now)
    for (let i = 0; i < 10; i++) { now = i * 500; m.record('out', 100, 'text'); m.record('in', 50, 'text') }
    const s = m.snapshot()
    expect(s.sentBps).toBe(200)
    expect(s.recvBps).toBe(100)
    for (const r of [40, 20, 30, 100]) m.addRtt(r)
    const r = m.snapshot()
    expect(r.rttMedianMs).toBe(30)
    expect(r.rttP95Ms).toBe(100)
    expect(r.totals.textPackets).toBe(20)
  })
})

describe('QR code', () => {
  it('matches qrencode bit for bit', () => {
    for (const c of fixtures.cases as { text: string; ecc: 'L' | 'M' | 'Q' | 'H'; rows: string[]; mask?: number }[]) {
      const q = encodeQr(c.text, c.ecc, c.mask)
      expect(q.modules.map((r) => r.map((b) => (b ? '1' : '0')).join(''))).toEqual(c.rows)
    }
  })
  it('a Bridge link fits version 3–4 and renders as one path', () => {
    const q = encodeQr('https://bridgify.vercel.app/bridge/K7M2QX')
    expect(q.version).toBeLessThanOrEqual(4)
    expect(qrPath(q)).toMatch(/^M4 4h7v1h-7z/)
  })
})
