/** Exponential moving average over class probabilities. */
export class ProbSmoother {
  private state: Float32Array | null = null
  private alpha: number
  constructor(alpha = 0.35) { this.alpha = alpha }
  push(p: Float32Array): Float32Array {
    if (!this.state || this.state.length !== p.length) { this.state = Float32Array.from(p); return this.state }
    for (let i = 0; i < p.length; i++) this.state[i] = this.alpha * p[i]! + (1 - this.alpha) * this.state[i]!
    return this.state
  }
  reset() { this.state = null }
}
