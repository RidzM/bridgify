/**
 * "Show my hands": hand landmarks quantised to Int16 (×1000) and sent as base64 at up to 15 Hz.
 * Only x and y travel (the skeleton is drawn flat), which keeps one hand to 84 bytes before
 * base64. A byte budget keeps the average stream under 15 kbps (FR-BG-03).
 */
import type { Hand } from '@/engines/vision/types'

export const POINTS_PER_HAND = 21
export const LM_SCALE = 1000
export const LM_MAX_HZ = 15
/** Landmark stream budget: 1,650 bytes/s ≈ 13.2 kbps sustained, bursts of half a second at most. */
export const LM_BUDGET_BYTES_PER_S = 1650
const BURST_S = 0.5

export interface RemoteHand { points: { x: number; y: number }[]; left: boolean }

const clamp16 = (v: number) => Math.max(-32768, Math.min(32767, Math.round(v * LM_SCALE)))

export function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

export function fromBase64(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch { return null }
}

/**
 * Packs up to two hands. mask bit 0/1: hand A/B present; bit 2/3: hand A/B is a left hand.
 * Values are little-endian Int16 so every device decodes them the same way.
 */
export function packHands(hands: readonly Hand[]): { hands: string; mask: number } {
  const used = hands.filter((h) => h.landmarks.length >= POINTS_PER_HAND).slice(0, 2)
  const view = new DataView(new ArrayBuffer(used.length * POINTS_PER_HAND * 4))
  let mask = 0
  used.forEach((h, i) => {
    mask |= 1 << i
    if (h.handedness === 'Left') mask |= 1 << (i + 2)
    for (let p = 0; p < POINTS_PER_HAND; p++) {
      const lm = h.landmarks[p]!
      const o = (i * POINTS_PER_HAND + p) * 4
      view.setInt16(o, clamp16(lm.x), true)
      view.setInt16(o + 2, clamp16(lm.y), true)
    }
  })
  return { hands: toBase64(new Uint8Array(view.buffer)), mask }
}

/** Unpacks what packHands made; null when the byte count does not match the mask. */
export function unpackHands(b64: string, mask: number): RemoteHand[] | null {
  const count = (mask & 1 ? 1 : 0) + (mask & 2 ? 1 : 0)
  const bytes = fromBase64(b64)
  if (!bytes || bytes.length !== count * POINTS_PER_HAND * 4) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const out: RemoteHand[] = []
  for (let i = 0; i < count; i++) {
    const points: { x: number; y: number }[] = []
    for (let p = 0; p < POINTS_PER_HAND; p++) {
      const o = (i * POINTS_PER_HAND + p) * 4
      points.push({ x: view.getInt16(o, true) / LM_SCALE, y: view.getInt16(o + 2, true) / LM_SCALE })
    }
    out.push({ points, left: Boolean(mask & (1 << (i + 2))) })
  }
  return out
}

/** Largest movement of any point between two frames (normalised units). */
export function maxShift(a: readonly Hand[], b: readonly Hand[]): number {
  if (a.length !== b.length) return Infinity
  let m = 0
  for (let i = 0; i < a.length; i++) {
    const pa = a[i]!.landmarks
    const pb = b[i]!.landmarks
    for (let p = 0; p < Math.min(pa.length, pb.length); p++) m = Math.max(m, Math.abs(pa[p]!.x - pb[p]!.x), Math.abs(pa[p]!.y - pb[p]!.y))
  }
  return m
}

/**
 * Decides when to send a landmark frame: at most 15 Hz, only when the hands moved more than
 * camera jitter (or once a second as a keyframe), and within the byte budget (token bucket).
 */
export class HandStreamGate {
  private lastSentAt = -Infinity
  private last: readonly Hand[] = []
  private tokens = LM_BUDGET_BYTES_PER_S * BURST_S
  private refillAt = 0
  private cleared = true
  private budget: number
  private jitter: number
  constructor(budget = LM_BUDGET_BYTES_PER_S, jitter = 0.004) { this.budget = budget; this.jitter = jitter }

  /** Returns the bytes that may be sent now, or 'clear' once when the hands disappear, or null. */
  offer(now: number, hands: readonly Hand[], packetBytes: number): 'send' | 'clear' | null {
    this.tokens = Math.min(this.budget * BURST_S, this.tokens + ((now - this.refillAt) / 1000) * this.budget)
    this.refillAt = now
    if (!hands.length) {
      if (this.cleared) return null
      this.cleared = true
      this.last = []
      return 'clear'
    }
    if (now - this.lastSentAt < 1000 / LM_MAX_HZ) return null
    const moved = maxShift(this.last, hands) > this.jitter
    if (!moved && !this.cleared && now - this.lastSentAt < 1000) return null
    if (this.tokens < packetBytes) return null
    this.tokens -= packetBytes
    this.lastSentAt = now
    this.last = hands.map((h) => ({ ...h, landmarks: h.landmarks.map((l) => ({ ...l })) }))
    this.cleared = false
    return 'send'
  }

  reset() { this.lastSentAt = -Infinity; this.last = []; this.cleared = true }
}
