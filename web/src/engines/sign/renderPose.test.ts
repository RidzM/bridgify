import { describe, expect, it } from 'vitest'
import { solveElbow } from './renderPose'

const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

describe('solveElbow', () => {
  it('keeps both arm segments at their lengths when the hand is within reach', () => {
    const s = { x: 100, y: 100 }, h = { x: 120, y: 20 }
    const e = solveElbow(s, h, 60, 50, -1)
    expect(d(s, e)).toBeCloseTo(60, 5)
    expect(d(e, h)).toBeCloseTo(50, 5)
  })
  it('bends the elbow down and away from the body for a raised hand', () => {
    const s = { x: 100, y: 100 }, h = { x: 110, y: 30 }
    const left = solveElbow(s, h, 60, 50, -1)
    expect(left.y).toBeGreaterThan(Math.min(s.y, h.y))
    expect(left.x).toBeLessThan(s.x + 10)
    const right = solveElbow(s, h, 60, 50, 1)
    expect(right.x).toBeGreaterThan(left.x)
  })
  it('straightens the arm when the hand is out of reach', () => {
    const s = { x: 0, y: 0 }, h = { x: 300, y: 0 }
    const e = solveElbow(s, h, 60, 40, 1)
    expect(e.y).toBeCloseTo(0, 5)
    expect(e.x).toBeCloseTo(180, 5)
  })
})
