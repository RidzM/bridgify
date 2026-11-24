/**
 * A transport moves strings between exactly two people. Two kinds exist:
 *   - peer:  WebRTC data channel, found through the free PeerJS broker (two phones)
 *   - local: BroadcastChannel between two tabs of the same browser (one-laptop demos, tests)
 * Transports only carry bytes; the session (session.ts) owns hello/bye, ping and receipts.
 */
import { channelFor } from './code'
import { newId } from './packets'

export type LinkKind = 'peer' | 'local'
export type Role = 'host' | 'guest'
export type FailReason = 'not-found' | 'full' | 'network' | 'unsupported' | 'taken'
export type LinkStatus = 'connecting' | 'listening' | 'down'
/** A link with no traffic for this long is treated as dead (pings flow every 5 s). */
export const STALE_MS = 8000

export interface LinkHandlers {
  /** Progress of one transport, for the waiting screen. */
  status?: (kind: LinkKind, status: LinkStatus, reason?: FailReason) => void
  open: (kind: LinkKind) => void
  message: (data: string, kind: LinkKind) => void
  /** An open link was lost. The guest side keeps retrying until stop(). */
  drop: (kind: LinkKind) => void
  /** This transport cannot work (bad code, no network, room full…). Reported once. */
  fail: (reason: FailReason, kind: LinkKind) => void
}

export interface Transport {
  readonly kind: LinkKind
  start(): void
  send(data: string): boolean
  isOpen(): boolean
  /** The session believes the link is dead: drop it and look for the other person again. */
  relink(): void
  /** Host only: turn away whoever is connected (wrong person) and keep listening. */
  kick(): void
  stop(): void
}

interface Envelope { t: 'knock' | 'welcome' | 'busy' | 'data' | 'close'; from: string; to?: string; d?: string }
const KINDS = new Set(['knock', 'welcome', 'busy', 'data', 'close'])

function readEnvelope(v: unknown): Envelope | null {
  if (typeof v !== 'object' || v === null) return null
  const e = v as Record<string, unknown>
  if (typeof e.t !== 'string' || !KINDS.has(e.t) || typeof e.from !== 'string' || e.from.length > 40) return null
  if (e.to !== undefined && typeof e.to !== 'string') return null
  if (e.d !== undefined && typeof e.d !== 'string') return null
  return e as unknown as Envelope
}

/**
 * Same-browser link over BroadcastChannel. The guest "knocks"; the host answers "welcome"
 * (or "busy" when it already has someone). Each tab has its own random id, so a third tab
 * can't read messages meant for someone else.
 */
export class LocalTransport implements Transport {
  readonly kind = 'local' as const
  private ch: BroadcastChannel | null = null
  private readonly me = newId(12)
  private other: string | null = null
  private open = false
  private stopped = false
  private knockTimer: ReturnType<typeof setTimeout> | null = null
  private retryTimer: ReturnType<typeof setInterval> | null = null
  private lastHeardAt = 0
  private busyCount = 0
  private readonly code: string
  private readonly role: Role
  private readonly h: LinkHandlers
  private readonly knockTimeoutMs: number

  constructor(code: string, role: Role, handlers: LinkHandlers, knockTimeoutMs = 1500) {
    this.code = code
    this.role = role
    this.h = handlers
    this.knockTimeoutMs = knockTimeoutMs
  }

  start() {
    if (typeof BroadcastChannel === 'undefined') { this.h.status?.('local', 'down', 'unsupported'); this.h.fail('unsupported', 'local'); return }
    this.ch = new BroadcastChannel(channelFor(this.code))
    this.ch.onmessage = (e: MessageEvent) => this.onEnvelope(e.data)
    if (typeof window !== 'undefined') window.addEventListener('pagehide', this.onPageHide)
    if (this.role === 'host') { this.h.status?.('local', 'listening'); return }
    this.h.status?.('local', 'connecting')
    this.knock()
    this.knockTimer = setTimeout(() => {
      this.knockTimer = null
      if (!this.open && !this.stopped) this.h.fail('not-found', 'local')
    }, this.knockTimeoutMs)
  }

  private post(e: Envelope) { try { this.ch?.postMessage(e) } catch { /* channel closed */ } }
  private knock() { this.post({ t: 'knock', from: this.me }) }

  private onEnvelope(raw: unknown) {
    const e = readEnvelope(raw)
    if (!e || e.from === this.me || this.stopped) return
    if (e.to !== undefined && e.to !== this.me) return
    switch (e.t) {
      case 'knock': {
        if (this.role !== 'host') return
        // Someone else knocks while a live link is open: the room is full. A silent link is
        // probably the same person after a reload, so the newcomer replaces it.
        if (this.open && this.other !== e.from && Date.now() - this.lastHeardAt < STALE_MS) { this.post({ t: 'busy', from: this.me, to: e.from }); return }
        const fresh = !this.open || this.other !== e.from
        this.other = e.from
        this.open = true
        this.lastHeardAt = Date.now()
        this.post({ t: 'welcome', from: this.me, to: e.from })
        if (fresh) this.h.open('local')
        return
      }
      case 'welcome':
        if (this.role !== 'guest' || (this.open && this.other === e.from)) return
        this.clearTimers()
        this.other = e.from
        this.open = true
        this.lastHeardAt = Date.now()
        this.h.open('local')
        return
      case 'busy':
        if (this.role !== 'guest' || this.open) return
        this.clearTimers()
        // The host may still hold a link from before a reload; ask twice more before giving up.
        if (++this.busyCount >= 3) this.h.fail('full', 'local')
        else this.retry()
        return
      case 'data':
        if (this.open && e.from === this.other && e.d !== undefined) { this.lastHeardAt = Date.now(); this.h.message(e.d, 'local') }
        return
      case 'close':
        if (e.from !== this.other) return
        this.lose()
        return
    }
  }

  private lose() {
    const wasOpen = this.open
    this.open = false
    if (this.role === 'host') this.other = null
    if (wasOpen) this.h.drop('local')
    if (this.role === 'guest' && !this.stopped) this.retry()
  }

  private retry() {
    if (this.retryTimer) return
    this.other = null
    this.knock()
    this.retryTimer = setInterval(() => { if (!this.open && !this.stopped) this.knock() }, 2000)
  }

  private clearTimers() {
    if (this.knockTimer) clearTimeout(this.knockTimer)
    if (this.retryTimer) clearInterval(this.retryTimer)
    this.knockTimer = null
    this.retryTimer = null
  }

  private readonly onPageHide = () => { if (this.open && this.other) this.post({ t: 'close', from: this.me, to: this.other }) }

  send(data: string): boolean {
    if (!this.open || !this.other) return false
    this.post({ t: 'data', from: this.me, to: this.other, d: data })
    return true
  }

  isOpen() { return this.open }

  relink() {
    if (this.stopped) return
    if (this.open && this.other) this.post({ t: 'close', from: this.me, to: this.other })
    this.open = false
    if (this.role === 'host') { this.other = null; return }
    this.clearTimers()
    this.retry()
  }

  kick() {
    if (this.role !== 'host') return
    if (this.other) this.post({ t: 'close', from: this.me, to: this.other })
    this.open = false
    this.other = null
  }

  stop() {
    if (this.stopped) return
    this.onPageHide()
    this.stopped = true
    this.open = false
    this.clearTimers()
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.onPageHide)
    this.ch?.close()
    this.ch = null
  }
}
