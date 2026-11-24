// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isSyntheticFingerspelling, readPose } from './poseFile'

describe('pose file reader', () => {
  it('reads a sign.mt pose (ASL "hello")', () => {
    const b = readFileSync(fileURLToPath(new URL('./__fixtures__/hello-ase.pose', import.meta.url)))
    const p = readPose(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
    console.log(JSON.stringify({ v: p.version, w: p.width, h: p.height, fps: p.fps, frames: p.frames, people: p.people, dims: p.dims, comps: p.components.map((c) => [c.name, c.format, c.points.length]) }))
    expect(p.frames).toBeGreaterThan(10)
    expect(p.components.map((c) => c.name)).toEqual(expect.arrayContaining(['POSE_LANDMARKS', 'LEFT_HAND_LANDMARKS', 'RIGHT_HAND_LANDMARKS']))
    expect(p.data.length).toBe(p.frames * p.people * p.totalPoints * p.dims)
  })
})

describe('isSyntheticFingerspelling', () => {
  const components = [
    { name: 'POSE_LANDMARKS', format: 'XYC', points: ['a', 'b'], limbs: [] },
    { name: 'LEFT_HAND_LANDMARKS', format: 'XYC', points: ['w', 't'], limbs: [] },
    { name: 'RIGHT_HAND_LANDMARKS', format: 'XYC', points: ['w', 't'], limbs: [] },
  ] as { name: string; format: string; points: string[]; limbs: [number, number][] }[]
  const make = (frames: number, left: (f: number) => boolean, right: (f: number) => boolean) => {
    const totalPoints = 6
    const confidence = new Float32Array(frames * totalPoints)
    for (let f = 0; f < frames; f++) {
      confidence[f * totalPoints] = 1
      if (left(f)) confidence[f * totalPoints + 2] = 0.9
      if (right(f)) confidence[f * totalPoints + 4] = 0.9
    }
    return { components, confidence, frames, people: 1, totalPoints }
  }
  it('flags one hand in every frame and the other never', () => {
    expect(isSyntheticFingerspelling(make(40, () => false, () => true))).toBe(true)
    expect(isSyntheticFingerspelling(make(40, () => true, () => false))).toBe(true)
  })
  it('accepts a real sign that starts and ends at rest', () => {
    expect(isSyntheticFingerspelling(make(40, () => false, (f) => f > 5 && f < 30))).toBe(false)
  })
  it('accepts two-handed signs and empty files', () => {
    expect(isSyntheticFingerspelling(make(40, () => true, () => true))).toBe(false)
    expect(isSyntheticFingerspelling(make(0, () => false, () => false))).toBe(false)
  })
})
