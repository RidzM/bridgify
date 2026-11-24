/**
 * Minimal dense-network runtime for the exported letter classifiers.
 * Weights file: little-endian Float32, per layer W (row-major [out][in]) then b.
 */
export interface LayerSpec { in: number; out: number; activation: 'relu' | 'none' }
export interface MlpHeader {
  version: string
  featureSpec: string
  F: number
  labels: string[]
  layers: LayerSpec[]
  mean: number[]
  std: number[]
  sha256?: string
  metrics?: Record<string, unknown>
}
export interface Mlp { header: MlpHeader; predict: (x: ArrayLike<number>) => Float32Array }

export function createMlp(header: MlpHeader, weights: Float32Array): Mlp {
  const expected = header.layers.reduce((n, l) => n + l.in * l.out + l.out, 0)
  if (weights.length !== expected) throw new Error(`Model weights size mismatch: ${weights.length} vs ${expected}`)
  if (header.mean.length !== header.F || header.std.length !== header.F) throw new Error('Model normalisation size mismatch')
  const mats: { W: Float32Array; b: Float32Array; spec: LayerSpec }[] = []
  let off = 0
  for (const spec of header.layers) {
    const W = weights.subarray(off, off + spec.in * spec.out); off += spec.in * spec.out
    const b = weights.subarray(off, off + spec.out); off += spec.out
    mats.push({ W, b, spec })
  }
  const mean = Float32Array.from(header.mean)
  const std = Float32Array.from(header.std, (s) => (s === 0 ? 1 : s))
  const width = Math.max(header.F, ...header.layers.map((l) => l.out))
  const bufA = new Float32Array(width)
  const bufB = new Float32Array(width)

  const predict = (x: ArrayLike<number>) => {
    if (x.length !== header.F) throw new Error(`Expected ${header.F} features, got ${x.length}`)
    let cur = bufA
    let nxt = bufB
    for (let i = 0; i < header.F; i++) cur[i] = ((x[i] as number) - mean[i]!) / std[i]!
    for (const { W, b, spec } of mats) {
      for (let o = 0; o < spec.out; o++) {
        let s = b[o]!
        const row = o * spec.in
        for (let i = 0; i < spec.in; i++) s += W[row + i]! * cur[i]!
        nxt[o] = spec.activation === 'relu' && s < 0 ? 0 : s
      }
      const t = cur; cur = nxt; nxt = t
    }
    const C = header.labels.length
    const out = new Float32Array(C)
    let max = -Infinity
    for (let c = 0; c < C; c++) if (cur[c]! > max) max = cur[c]!
    let sum = 0
    for (let c = 0; c < C; c++) { out[c] = Math.exp(cur[c]! - max); sum += out[c]! }
    for (let c = 0; c < C; c++) out[c]! /= sum
    return out
  }
  return { header, predict }
}

export function topK(probs: Float32Array, labels: string[], k = 3) {
  return [...probs].map((p, i) => ({ label: labels[i]!, p })).sort((a, b) => b.p - a.p).slice(0, k)
}
