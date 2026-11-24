/**
 * Compact sign animation format ("bridgify-pose" v1), built from sign.mt .pose files.
 * Keeps every point, halves the frame rate and stores pixel coordinates as Int16, so a word is
 * ~10× smaller than the source. The build script and the browser use this same module.
 *
 * JSON: { v: 1, fps, w, h, frames, components: [{ name, n, limbs: [[a,b],...] }], xy: base64(Int16Array) }
 * xy layout: frame-major, then point (components in order), then x,y. Missing point = -32768.
 */
import type { PoseFile } from './poseFile.ts'

export interface CompactPose {
  v: 1
  fps: number
  w: number
  h: number
  frames: number
  components: { name: string; n: number; limbs: [number, number][] }[]
  xy: string
}

export const MISSING = -32768
/** Points the tracker was less sure of than this are dropped (they draw as wild limbs). */
export const MIN_CONFIDENCE = 0.3

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

export function compactPose(p: PoseFile, step = 2, minConfidence = MIN_CONFIDENCE): CompactPose {
  const P = p.totalPoints
  const frames = Math.ceil(p.frames / step)
  const xy = new Int16Array(frames * P * 2)
  let k = 0
  for (let f = 0; f < p.frames; f += step) {
    for (let i = 0; i < P; i++) {
      const c = p.confidence[f * p.people * P + i]!
      const base = (f * p.people * P + i) * p.dims
      if (c >= minConfidence) { xy[k++] = Math.round(p.data[base]!); xy[k++] = Math.round(p.data[base + 1]!) }
      else { xy[k++] = MISSING; xy[k++] = MISSING }
    }
  }
  return {
    v: 1, fps: Math.round((p.fps / step) * 100) / 100, w: p.width, h: p.height, frames,
    components: p.components.map((c) => ({ name: c.name, n: c.points.length, limbs: c.limbs })),
    xy: toBase64(new Uint8Array(xy.buffer)),
  }
}

export interface DecodedPose { pose: CompactPose; xy: Int16Array; P: number }
export function decodePose(c: CompactPose): DecodedPose {
  const bytes = fromBase64(c.xy)
  const xy = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)
  const P = c.components.reduce((n, x) => n + x.n, 0)
  if (xy.length !== c.frames * P * 2) throw new Error('Damaged sign animation')
  return { pose: c, xy, P }
}

/** Joins several animations into one sequence (e.g. a sentence of words). */
export function concatPoses(list: CompactPose[]): CompactPose {
  if (list.length === 1) return list[0]!
  const first = list[0]!
  const parts = list.map((c) => decodePose(c).xy)
  const total = parts.reduce((n, a) => n + a.length, 0)
  const out = new Int16Array(total)
  let o = 0
  for (const a of parts) { out.set(a, o); o += a.length }
  return { ...first, frames: list.reduce((n, c) => n + c.frames, 0), xy: toBase64(new Uint8Array(out.buffer)) }
}
