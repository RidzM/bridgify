import { describe, expect, it } from 'vitest'
import { createMlp, topK } from './mlp'

describe('mlp runtime', () => {
  it('computes a 2-layer forward pass with softmax', () => {
    // F=2 -> 2 (relu) -> 2 (none). Identity-ish weights.
    const header = { version: '1', featureSpec: 'v1', F: 2, labels: ['a', 'b'], layers: [{ in: 2, out: 2, activation: 'relu' as const }, { in: 2, out: 2, activation: 'none' as const }], mean: [0, 0], std: [1, 1] }
    const w = new Float32Array([1, 0, 0, 1, 0, 0, /* layer2 */ 2, 0, 0, 2, 0, 0])
    const m = createMlp(header, w)
    const p = m.predict([1, -1]) // relu -> [1,0] -> [2,0]
    expect(p[0]).toBeCloseTo(Math.exp(2) / (Math.exp(2) + 1), 6)
    expect(topK(p, header.labels, 1)[0]!.label).toBe('a')
  })
  it('rejects mismatched weights', () => {
    const header = { version: '1', featureSpec: 'v1', F: 1, labels: ['a'], layers: [{ in: 1, out: 1, activation: 'none' as const }], mean: [0], std: [1] }
    expect(() => createMlp(header, new Float32Array(5))).toThrow()
  })
})
