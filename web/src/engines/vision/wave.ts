/** Detects a wave: open palm moving side to side (>= 3 direction changes within 1.2 s). */
export class WaveDetector {
  private xs: { t: number; x: number }[] = []
  private windowMs: number
  private minFlips: number
  private minAmp: number
  constructor(windowMs = 1200, minFlips = 3, minAmp = 0.04) { this.windowMs = windowMs; this.minFlips = minFlips; this.minAmp = minAmp }
  push(t: number, wristX: number | null, openPalm: boolean): boolean {
    if (wristX === null || !openPalm) { this.xs = []; return false }
    this.xs.push({ t, x: wristX })
    while (this.xs.length && t - this.xs[0]!.t > this.windowMs) this.xs.shift()
    if (this.xs.length < 6) return false
    let flips = 0
    let dir = 0
    let anchor = this.xs[0]!.x
    for (const { x } of this.xs) {
      const d = x - anchor
      if (Math.abs(d) < this.minAmp) continue
      const s = Math.sign(d)
      if (dir !== 0 && s !== dir) flips++
      dir = s
      anchor = x
    }
    return flips >= this.minFlips
  }
  reset() { this.xs = [] }
}
