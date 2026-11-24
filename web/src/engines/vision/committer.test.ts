import { describe, expect, it } from 'vitest'
import { LetterCommitter } from './committer'

const run = (frames: [number, string | null, number][]) => {
  const c = new LetterCommitter()
  const out: string[] = []
  for (const [t, l, p] of frames) { const r = c.update(t, l ? { label: l, p } : null); if (r) out.push(r) }
  return out
}
const hold = (label: string, from: number, ms: number, p = 0.9) =>
  Array.from({ length: Math.floor(ms / 33) }, (_, i) => [from + i * 33, label, p] as [number, string, number])

describe('letter committer', () => {
  it('commits after a 700 ms hold', () => {
    expect(run(hold('A', 0, 800))).toEqual(['A'])
  })
  it('does not commit a flickering label', () => {
    const f: [number, string, number][] = []
    for (let i = 0; i < 40; i++) f.push([i * 33, i % 2 ? 'A' : 'S', 0.9])
    expect(run(f)).toEqual([])
  })
  it('does not commit low confidence', () => {
    expect(run(hold('A', 0, 1500, 0.7))).toEqual([])
  })
  it('needs a change before repeating the same letter', () => {
    expect(run([...hold('L', 0, 2000)])).toEqual(['L'])
    expect(run([...hold('L', 0, 800), ...hold('O', 800, 300, 0.5), ...hold('L', 1100, 800)])).toEqual(['L', 'L'])
  })
  it('allows a repeat after the hand drops out', () => {
    const f = [...hold('E', 0, 800), [900, null, 0] as [number, null, number], [1300, null, 0] as [number, null, number], ...hold('E', 1350, 800)]
    expect(run(f)).toEqual(['E', 'E'])
  })
})
