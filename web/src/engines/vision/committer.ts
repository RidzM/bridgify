/**
 * Decides when a recognised letter "counts" (SYSTEM-ARCHITECTURE §8.3).
 * Commit when the same top label is held at >= commitAt for holdMs. After a commit the
 * label is locked until the top label changes or the hand is lost, so repeated letters
 * need a deliberate change in between.
 */
export type CommitterState = 'no-hand' | 'tracking' | 'candidate' | 'locked'
export interface CommitterConfig { commitAt: number; releaseAt: number; holdMs: number; lostMs: number }
export const DEFAULT_COMMITTER: CommitterConfig = { commitAt: 0.8, releaseAt: 0.65, holdMs: 700, lostMs: 300 }

export interface CommitterView { state: CommitterState; label: string | null; p: number; progress: number }

export class LetterCommitter {
  private state: CommitterState = 'no-hand'
  private label: string | null = null
  private since = 0
  private lastHandAt = -Infinity
  private lockedLabel: string | null = null
  private cfg: CommitterConfig
  constructor(cfg: CommitterConfig = DEFAULT_COMMITTER) { this.cfg = cfg }

  /** Feed one frame. Returns a committed letter (once) or null. */
  update(t: number, top: { label: string; p: number } | null): string | null {
    if (!top) {
      if (t - this.lastHandAt > this.cfg.lostMs) { this.state = 'no-hand'; this.label = null; this.lockedLabel = null }
      return null
    }
    this.lastHandAt = t
    if (this.state === 'locked') {
      if (top.label !== this.lockedLabel || top.p < this.cfg.releaseAt) { this.state = 'tracking'; this.lockedLabel = null } else return null
    }
    if (this.state === 'candidate') {
      if (top.label !== this.label || top.p < this.cfg.releaseAt) { this.state = 'tracking' }
      else if (t - this.since >= this.cfg.holdMs) {
        this.state = 'locked'; this.lockedLabel = top.label; const out = top.label; this.label = null; return out
      }
      return null
    }
    // no-hand or tracking
    this.state = 'tracking'
    if (top.p >= this.cfg.commitAt) { this.state = 'candidate'; this.label = top.label; this.since = t }
    return null
  }

  view(t: number, top: { label: string; p: number } | null): CommitterView {
    const progress = this.state === 'candidate' ? Math.min(1, (t - this.since) / this.cfg.holdMs) : this.state === 'locked' ? 1 : 0
    return { state: this.state, label: this.state === 'candidate' ? this.label : this.state === 'locked' ? this.lockedLabel : top?.label ?? null, p: top?.p ?? 0, progress }
  }

  reset() { this.state = 'no-hand'; this.label = null; this.lockedLabel = null; this.lastHandAt = -Infinity }
}
