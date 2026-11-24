import { describe, expect, it } from 'vitest'
import { WaveDetector } from './wave'

describe('wave detector', () => {
  it('detects a side-to-side open palm', () => {
    const w = new WaveDetector()
    let hit = false
    for (let i = 0; i < 36; i++) hit = w.push(i * 33, 0.5 + 0.08 * Math.sin(i / 2.2), true) || hit
    expect(hit).toBe(true)
  })
  it('ignores a still palm and a moving fist', () => {
    const a = new WaveDetector(); const b = new WaveDetector()
    let ha = false; let hb = false
    for (let i = 0; i < 36; i++) { ha = a.push(i * 33, 0.5, true) || ha; hb = b.push(i * 33, 0.5 + 0.08 * Math.sin(i / 2.2), false) || hb }
    expect(ha).toBe(false); expect(hb).toBe(false)
  })
})
