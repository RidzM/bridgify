/**
 * Bridge meter (FR-BG-03): bytes per second each way (from the serialised packet length),
 * round-trip time from ping/pong every 5 s, and delivery time for text (send → receipt).
 * Keeps running median and p95 so /about/evidence and tests can report them.
 */
export type Direction = 'out' | 'in'

export interface MetricsSnapshot {
  /** Bytes per second over the last 5 s. */
  sentBps: number
  recvBps: number
  /** Landmark ("show my hands") share of the above. */
  lmSentBps: number
  lmRecvBps: number
  /** Average landmark bandwidth while the stream was on, in kbps. */
  lmAvgKbps: number
  rttLastMs: number | null
  rttMedianMs: number | null
  rttP95Ms: number | null
  rttSamples: number
  deliveryMedianMs: number | null
  connectMs: number | null
  totals: { sentBytes: number; recvBytes: number; sentPackets: number; recvPackets: number; textPackets: number; textBytes: number; lmPackets: number; lmBytes: number }
  link: 'peer' | 'local' | null
}

export function percentile(values: readonly number[], p: number): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))
  return s[idx]!
}

interface Sample { t: number; dir: Direction; bytes: number; lm: boolean }
const WINDOW_MS = 5000
const MAX_SAMPLES = 500

export class BridgeMetrics {
  private events: Sample[] = []
  private rtts: number[] = []
  private deliveries: number[] = []
  private lmStreamMs = 0
  private lmStreamBytes = 0
  private lmLastAt: number | null = null
  connectMs: number | null = null
  link: 'peer' | 'local' | null = null
  totals = { sentBytes: 0, recvBytes: 0, sentPackets: 0, recvPackets: 0, textPackets: 0, textBytes: 0, lmPackets: 0, lmBytes: 0 }
  private now: () => number

  constructor(now: () => number = () => performance.now()) { this.now = now }

  record(dir: Direction, bytes: number, kind: string) {
    const t = this.now()
    const lm = kind === 'lm'
    this.events.push({ t, dir, bytes, lm })
    this.trim(t)
    if (dir === 'out') { this.totals.sentBytes += bytes; this.totals.sentPackets++ } else { this.totals.recvBytes += bytes; this.totals.recvPackets++ }
    if (kind === 'text') { this.totals.textPackets++; this.totals.textBytes += bytes }
    if (lm && dir === 'out') {
      this.totals.lmPackets++; this.totals.lmBytes += bytes
      // Stream time counts gaps under 1.5 s, so pauses with no hands don't dilute the average.
      if (this.lmLastAt !== null && t - this.lmLastAt < 1500) { this.lmStreamMs += t - this.lmLastAt; this.lmStreamBytes += bytes }
      this.lmLastAt = t
    }
  }

  addRtt(ms: number) { this.rtts.push(ms); if (this.rtts.length > MAX_SAMPLES) this.rtts.shift() }
  addDelivery(ms: number) { this.deliveries.push(ms); if (this.deliveries.length > MAX_SAMPLES) this.deliveries.shift() }

  private trim(t: number) {
    while (this.events.length && t - this.events[0]!.t > WINDOW_MS) this.events.shift()
  }

  snapshot(): MetricsSnapshot {
    const t = this.now()
    this.trim(t)
    const sum = (f: (e: Sample) => boolean) => this.events.filter(f).reduce((a, e) => a + e.bytes, 0)
    const span = WINDOW_MS / 1000
    return {
      sentBps: Math.round(sum((e) => e.dir === 'out') / span),
      recvBps: Math.round(sum((e) => e.dir === 'in') / span),
      lmSentBps: Math.round(sum((e) => e.dir === 'out' && e.lm) / span),
      lmRecvBps: Math.round(sum((e) => e.dir === 'in' && e.lm) / span),
      lmAvgKbps: this.lmStreamMs > 0 ? Math.round(((this.lmStreamBytes * 8) / this.lmStreamMs) * 10) / 10 : 0,
      rttLastMs: this.rtts.at(-1) ?? null,
      rttMedianMs: percentile(this.rtts, 50),
      rttP95Ms: percentile(this.rtts, 95),
      rttSamples: this.rtts.length,
      deliveryMedianMs: percentile(this.deliveries, 50),
      connectMs: this.connectMs,
      totals: { ...this.totals },
      link: this.link,
    }
  }
}
