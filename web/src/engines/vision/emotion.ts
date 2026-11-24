/** Emotion scorer on FaceLandmarker blendshapes. 1:1 port of ml/bridgify_ml/emotion.py. */
import type { Emotion } from './types'

export const EMOTIONS: Emotion[] = ['neutral', 'happy', 'surprised', 'sad', 'angry', 'disgusted', 'fearful']
const PAIRS = ['mouthSmile', 'mouthFrown', 'eyeWide', 'browDown', 'mouthPress', 'noseSneer', 'mouthUpperUp', 'mouthStretch']
const SINGLE = ['browInnerUp', 'jawOpen']

export type EmotionWeights = Record<Exclude<Emotion, 'neutral'>, Record<string, number>> & { bias: Partial<Record<Emotion, number>> }

export function terms(bs: Record<string, number>): Record<string, number> {
  const t: Record<string, number> = {}
  for (const p of PAIRS) t[p] = ((bs[`${p}Left`] ?? 0) + (bs[`${p}Right`] ?? 0)) / 2
  for (const s of SINGLE) t[s] = bs[s] ?? 0
  return t
}

export function scoreEmotions(bs: Record<string, number>, w: EmotionWeights): Record<Emotion, number> {
  const t = terms(bs)
  const out = {} as Record<Emotion, number>
  let mx = -Infinity
  for (const e of EMOTIONS.slice(1) as Exclude<Emotion, 'neutral'>[]) {
    let v = w.bias[e] ?? 0
    for (const [name, wt] of Object.entries(w[e])) v += wt * (t[name] ?? 0)
    out[e] = v
    if (v > mx) mx = v
  }
  out.neutral = 1 - mx + (w.bias.neutral ?? 0)
  return out
}

export function predictEmotion(scores: Record<Emotion, number>): Emotion {
  let best: Emotion = 'neutral'
  for (const e of EMOTIONS) if (scores[e] > scores[best]) best = e
  return best
}

/** Top blendshape terms behind a prediction (shown to the user as "why"). */
export function drivers(bs: Record<string, number>, w: EmotionWeights, e: Emotion, n = 3) {
  if (e === 'neutral') return []
  const t = terms(bs)
  return Object.entries(w[e]).map(([name, wt]) => ({ name, value: wt * (t[name] ?? 0) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, n)
}
