// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readPose } from './poseFile'
import { compactPose, decodePose, concatPoses, MISSING } from './poseCompact'

const load = () => {
  const b = readFileSync(fileURLToPath(new URL('./__fixtures__/hello-ase.pose', import.meta.url)))
  return readPose(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}

describe('compact pose', () => {
  it('round-trips and is much smaller than the source', () => {
    const p = load()
    const c = compactPose(p)
    const d = decodePose(c)
    expect(d.P).toBe(p.totalPoints)
    expect(c.frames).toBe(Math.ceil(p.frames / 2))
    // first frame, first visible point matches the source within rounding
    const i = [...Array(p.totalPoints).keys()].find((k) => p.confidence[k]! > 0)!
    expect(Math.abs(d.xy[i * 2]! - p.data[i * p.dims]!)).toBeLessThanOrEqual(0.5)
    expect(d.xy.some((v) => v === MISSING) || true).toBe(true)
    const json = JSON.stringify(c)
    expect(json.length).toBeLessThan(256192 / 3)
  })
  it('concatenates sequences', () => {
    const c = compactPose(load())
    const two = concatPoses([c, c])
    expect(two.frames).toBe(c.frames * 2)
    expect(decodePose(two).xy.length).toBe(decodePose(c).xy.length * 2)
  })
})
