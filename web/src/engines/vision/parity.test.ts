// @vitest-environment node
// Proves the browser computes exactly what the Python training pipeline computed.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { aslFeatures, islFeatures } from './features'
import { createMlp, type MlpHeader } from './mlp'
import { classifyGesture, type GestureParams } from './gestures'
import { scoreEmotions, predictEmotion, type EmotionWeights } from './emotion'
import type { Hand } from './types'

const fx = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), 'utf8'))
const model = (id: string) => {
  const dir = fileURLToPath(new URL('../../../public/models/', import.meta.url))
  const header = JSON.parse(readFileSync(`${dir}${id}.json`, 'utf8')) as MlpHeader
  const bin = readFileSync(`${dir}${id}.bin`)
  return createMlp(header, new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4))
}
type RawHand = { landmarks: number[][]; handedness: 'Left' | 'Right' }
const toHand = (h: RawHand): Hand => ({ landmarks: h.landmarks.map(([x, y, z]) => ({ x: x!, y: y!, z: z! })), handedness: h.handedness, score: 1 })

describe('feature parity with Python (features.json)', () => {
  const f = fx('features.json')
  for (const frame of f.frames as { id: string; lang: string; aspect: number; hands: RawHand[]; expected: number[] }[]) {
    it(`${frame.lang} ${frame.id}`, () => {
      const hands = frame.hands.map(toHand)
      const got = frame.lang === 'isl' ? islFeatures(hands, frame.aspect) : aslFeatures(hands[0]!, frame.aspect)
      expect(got.length).toBe(frame.expected.length)
      let max = 0
      for (let i = 0; i < got.length; i++) max = Math.max(max, Math.abs(got[i]! - frame.expected[i]!))
      expect(max).toBeLessThan(1e-5)
    })
  }
})

for (const [id, file] of [['asl-letters', 'mlp-asl.json'], ['isl-letters', 'mlp-isl.json'], ['emotion', 'emotion-model.json']] as const) {
  describe(`${id} model parity (${file})`, () => {
    const m = model(id)
    const f = fx(file)
    const names = (m.header as MlpHeader & { featureNames?: string[] }).featureNames
    for (const [i, c] of (f.cases as { input: number[] | Record<string, number>; probs: number[]; argmax: number | string }[]).entries()) {
      it(`case ${i}`, () => {
        const x = Array.isArray(c.input) ? c.input : names!.map((n) => (c.input as Record<string, number>)[n] ?? 0)
        const p = m.predict(x)
        for (let k = 0; k < p.length; k++) expect(Math.abs(p[k]! - c.probs[k]!)).toBeLessThan(1e-5)
      })
    }
  })
}

describe('gesture rules parity (gestures.json)', () => {
  const f = fx('gestures.json')
  const params = f.params as GestureParams
  for (const [i, s] of (f.samples as { aspect: number; landmarks: number[][]; expected: string; extended: boolean[] }[]).entries()) {
    it(`sample ${i}: ${s.expected}`, () => {
      const r = classifyGesture(s.landmarks.map(([x, y, z]) => ({ x: x!, y: y!, z: z ?? 0 })), f.params ?? params, s.aspect)
      expect(r.name).toBe(s.expected)
      expect(r.extended).toEqual(s.extended)
    })
  }
})

describe('emotion rules parity (emotion.json)', () => {
  const f = fx('emotion.json')
  for (const [i, c] of (f.cases as { blendshapes: Record<string, number>; scores: Record<string, number>; expected: string }[]).entries()) {
    it(`case ${i}`, () => {
      const s = scoreEmotions(c.blendshapes, f.weights as EmotionWeights)
      for (const [k, v] of Object.entries(c.scores)) expect(Math.abs(s[k as keyof typeof s] - v)).toBeLessThan(1e-9)
      expect(predictEmotion(s)).toBe(c.expected)
    })
  }
})
