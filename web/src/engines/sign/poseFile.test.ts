// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { readPose } from './poseFile'

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
