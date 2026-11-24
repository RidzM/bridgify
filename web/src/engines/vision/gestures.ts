/** Rule-based static gestures on 2-D landmarks. 1:1 port of ml/bridgify_ml/gestures.py. */
import type { GestureName, Landmark } from './types'

export interface GestureParams {
  finger_ratio: number; thumb_ratio: number; thumb_away: number; thumb_ip_max_deg: number
  dir_margin: number; dir_vertical: number; palm_needs_thumb: boolean
}
export const DEFAULT_GESTURE_PARAMS: GestureParams = { finger_ratio: 1.1, thumb_ratio: 1.5, thumb_away: 1.0, thumb_ip_max_deg: 40, dir_margin: 0.3, dir_vertical: 1.0, palm_needs_thumb: true }
const FINGERS: [number, number][] = [[6, 8], [10, 12], [14, 16], [18, 20]]

type P = [number, number]
const d = (p: P[], a: number, b: number) => Math.hypot(p[a]![0] - p[b]![0], p[a]![1] - p[b]![1])
function angleDeg(p: P[], a: number, b: number, c: number) {
  const u: P = [p[a]![0] - p[b]![0], p[a]![1] - p[b]![1]]
  const v: P = [p[c]![0] - p[b]![0], p[c]![1] - p[b]![1]]
  return (Math.atan2(Math.abs(u[0] * v[1] - u[1] * v[0]), u[0] * v[0] + u[1] * v[1]) * 180) / Math.PI
}

export interface GestureResult { name: GestureName; extended: [boolean, boolean, boolean, boolean, boolean] }

export function classifyGesture(lm: Landmark[], params: GestureParams = DEFAULT_GESTURE_PARAMS, aspect = 1): GestureResult {
  const p: P[] = lm.map((l) => [l.x * aspect, l.y])
  const S = d(p, 0, 9)
  const fing = FINGERS.map(([pip, tip]) => d(p, tip, 0) > params.finger_ratio * d(p, pip, 0))
  const thumb = d(p, 4, 2) > params.thumb_ratio * d(p, 3, 2)
    && angleDeg(p, 2, 3, 4) >= 180 - params.thumb_ip_max_deg
    && d(p, 4, 17) > params.thumb_away * d(p, 2, 17)
  const [i, m, r, k] = fing as [boolean, boolean, boolean, boolean]
  const extended: GestureResult['extended'] = [thumb, i, m, r, k]
  const E4 = Number(i) + Number(m) + Number(r) + Number(k)
  const dy = p[4]![1] - p[2]![1]
  const dx = p[4]![0] - p[2]![0]
  const vertical = Math.abs(dy) >= params.dir_vertical * Math.abs(dx) && Math.abs(dy) >= params.dir_margin * S
  let name: GestureName = 'none'
  if (E4 === 4 && (thumb || !params.palm_needs_thumb)) name = 'open_palm'
  else if (E4 === 0 && thumb && vertical && dy < 0) name = 'thumbs_up'
  else if (E4 === 0 && thumb && vertical && dy > 0) name = 'thumbs_down'
  else if (E4 === 0 && !thumb) name = 'fist'
  else if (i && !m && !r && !k && !thumb) name = 'pointing'
  else if (i && m && !r && !k && !thumb) name = 'peace'
  else if (i && !m && !r && k && thumb) name = 'ily'
  return { name, extended }
}
