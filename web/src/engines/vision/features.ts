/**
 * Hand-landmark feature spec v1. A 1:1 port of ml/bridgify_ml/features.py (the source of truth);
 * checked against __fixtures__/features.json in features.parity.test.ts.
 */
import type { Hand, Landmark } from './types'

export const FEATURE_SPEC = 'v1'
export const HAND_F = 91
export const ISL_F = HAND_F * 2 + 2
const CHAINS = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [0, 9, 10, 11, 12], [0, 13, 14, 15, 16], [0, 17, 18, 19, 20]]
const TIPS = [4, 8, 12, 16, 20]
const TIP_PAIRS: [number, number][] = []
for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) TIP_PAIRS.push([TIPS[i]!, TIPS[j]!])
const Z_WEIGHT = 0.5
const SCALE_EPS = 1e-6
const NORMAL_EPS = 1e-9

type V3 = [number, number, number]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (u: V3, v: V3): V3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
const norm = (u: V3) => Math.hypot(u[0], u[1], u[2])
const dot = (u: V3, v: V3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
const angle = (u: V3, v: V3) => Math.atan2(norm(cross(u, v)), dot(u, v))

export function normaliseHand(lm: Landmark[], mirror: boolean, aspect = 1): V3[] {
  const p: V3[] = lm.map((l) => [l.x * aspect, l.y, l.z * aspect])
  const w = p[0]!
  const q: V3[] = p.map((v) => {
    const t = sub(v, w)
    return [mirror ? -t[0] : t[0], t[1], t[2] * Z_WEIGHT]
  })
  const s = Math.max(norm(q[9]!), SCALE_EPS)
  return q.map((v) => [v[0] / s, v[1] / s, v[2] / s])
}

export function blockFromNormalised(p: V3[], out: Float64Array, off: number) {
  let k = off
  for (const v of p) { out[k++] = v[0]; out[k++] = v[1]; out[k++] = v[2] }
  for (const c of CHAINS) {
    const bones = [0, 1, 2, 3].map((i) => sub(p[c[i + 1]!]!, p[c[i]!]!))
    for (let j = 0; j < 3; j++) out[k++] = angle(bones[j]!, bones[j + 1]!)
  }
  for (const [a, b] of TIP_PAIRS) out[k++] = norm(sub(p[a]!, p[b]!))
  const n = cross(sub(p[5]!, p[0]!), sub(p[17]!, p[0]!))
  const nn = Math.max(norm(n), NORMAL_EPS)
  out[k++] = n[0] / nn; out[k++] = n[1] / nn; out[k++] = n[2] / nn
}

export function handBlock(lm: Landmark[], mirror: boolean, aspect = 1): Float64Array {
  const out = new Float64Array(HAND_F)
  blockFromNormalised(normaliseHand(lm, mirror, aspect), out, 0)
  return out
}

/** ASL: one hand; left hands are mirrored to right. */
export function aslFeatures(hand: Hand, aspect = 1): Float64Array {
  return handBlock(hand.landmarks, hand.handedness === 'Left', aspect)
}

/** ISL: two slots ordered by image position (slot 0 = image-left wrist), presence mask last. */
export function islSlots(hands: Hand[]): [Hand | null, Hand | null] {
  if (hands.length >= 2) {
    let a = hands[0]!; let b = hands[1]!
    if (b.landmarks[0]!.x < a.landmarks[0]!.x) [a, b] = [b, a]
    return [a, b]
  }
  if (hands.length === 1) return hands[0]!.handedness === 'Left' ? [hands[0]!, null] : [null, hands[0]!]
  return [null, null]
}

export function islFeatures(hands: Hand[], aspect = 1): Float64Array {
  const [s0, s1] = islSlots(hands)
  const out = new Float64Array(ISL_F)
  if (s0) blockFromNormalised(normaliseHand(s0.landmarks, true, aspect), out, 0)
  if (s1) blockFromNormalised(normaliseHand(s1.landmarks, false, aspect), out, HAND_F)
  out[182] = s0 ? 1 : 0
  out[183] = s1 ? 1 : 0
  return out
}
