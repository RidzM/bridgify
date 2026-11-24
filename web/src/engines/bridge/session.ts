/**
 * One Bridge conversation between two people (FR-BG-01..05). Framework-free so it can be
 * unit-tested with a fake transport. Owns the protocol on top of a transport:
 *   hello (profiles, and who may join) → text / gloss / lm / status → receipt
 *   ping/pong every 5 s for round-trip time and liveness → bye when someone leaves.
 * Rooms end when either person leaves, after 30 s without the other person, or after
 * 30 minutes with no messages. Nothing is stored anywhere but this tab.
 */
import type { Hand } from '@/engines/vision/types'
import { GuestLinks, HostLinks, type Via } from './links'
import { HandStreamGate, packHands, unpackHands, type RemoteHand } from './landmarks'
import { BridgeMetrics } from './metrics'
import { cleanText, decodePacket, encodePacket, newId, PROTOCOL_VERSION, utf8Bytes, type Packet, type Profile, type TextSource } from './packets'
import type { FailReason, LinkHandlers, LinkKind, LinkStatus, Role, Transport } from './transport'
import type { SignLang } from '@/stores/prefs'

export type SessionState = 'starting' | 'waiting' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'failed'
export type EndReason = 'left' | 'you-left' | 'lost' | 'expired'

export interface ChatMessage {
  id: string
  mine: boolean
  text: string
  src: TextSource | 'gloss'
  lang: string
  gloss?: string[]
  /** Local wall-clock time it was sent or received. */
  at: number
  /** Mine only: waiting for the link, sent, or confirmed by the other phone. */
  state?: 'queued' | 'sent' | 'delivered'
}

export interface PeerActivity { typing: boolean; listening: boolean; signing: boolean }

export interface SessionSnapshot {
  state: SessionState
  role: Role
  code: string
  link: LinkKind | null
  failure: FailReason | null
  ended: EndReason | null
  peerProfile: Profile | null
  activity: PeerActivity
  /** Host waiting screen: can phones reach us through the broker, and can other tabs? */
  broker: LinkStatus | null
  brokerFailure: FailReason | null
  local: LinkStatus | null
}

export interface SessionTimers { pingMs: number; staleMs: number; reconnectMs: number; idleMs: number; tickMs: number }
export const DEFAULT_TIMERS: SessionTimers = { pingMs: 5000, staleMs: 15000, reconnectMs: 30000, idleMs: 30 * 60_000, tickMs: 1000 }

export interface SessionOptions {
  code: string
  role: Role
  profile: Profile
  /** Stable per tab, so a reload rejoins instead of looking like a stranger. */
  sid?: string
  via?: Via
  transport?: (h: LinkHandlers) => Transport
  timers?: Partial<SessionTimers>
}

type Listener = () => void
const QUIET: PeerActivity = { typing: false, listening: false, signing: false }
const MAX_QUEUE = 20
const MAX_FULL_RETRIES = 3

export class BridgeSession {
  readonly metrics = new BridgeMetrics()
  readonly code: string
  readonly role: Role
  readonly sid: string
  private profile: Profile
  private t: Transport
  private snap: SessionSnapshot
  private timers: SessionTimers
  private changeListeners = new Set<Listener>()
  private messageListeners = new Set<(m: ChatMessage) => void>()
  private updateListeners = new Set<(id: string, state: ChatMessage['state']) => void>()
  private handListeners = new Set<(h: RemoteHand[] | null) => void>()
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private lastHeardAt = 0
  private lastActivityAt = Date.now()
  private dropAt: number | null = null
  private verified = false
  private lockedSid: string | null = null
  private queue: Extract<Packet, { k: 'text' }>[] = []
  private sentAt = new Map<string, number>()
  private fullCount = 0
  private readonly startedAt = performance.now()
  private gate = new HandStreamGate()
  private lastStatus = ''
  private bucket = { tokens: 100, at: performance.now() }
  private stopped = false

  constructor(opts: SessionOptions) {
    this.code = opts.code
    this.role = opts.role
    this.profile = opts.profile
    this.sid = opts.sid ?? newId(12)
    this.timers = { ...DEFAULT_TIMERS, ...opts.timers }
    const h: LinkHandlers = {
      status: (kind, status, reason) => this.onStatus(kind, status, reason),
      open: (kind) => this.onOpen(kind),
      message: (data) => this.onMessage(data),
      drop: () => this.onDrop(),
      fail: (reason) => this.onFail(reason),
    }
    this.t = opts.transport ? opts.transport(h) : this.role === 'host' ? new HostLinks(this.code, h) : new GuestLinks(this.code, h, opts.via ?? 'auto')
    this.snap = {
      state: 'starting', role: this.role, code: this.code, link: null, failure: null, ended: null,
      peerProfile: null, activity: QUIET, broker: null, brokerFailure: null, local: null,
    }
  }

  // ── subscriptions ────────────────────────────────────────────────────────────
  get snapshot(): SessionSnapshot { return this.snap }
  onChange(fn: Listener) { this.changeListeners.add(fn); return () => { this.changeListeners.delete(fn) } }
  onChatMessage(fn: (m: ChatMessage) => void) { this.messageListeners.add(fn); return () => { this.messageListeners.delete(fn) } }
  onMessageUpdate(fn: (id: string, state: ChatMessage['state']) => void) { this.updateListeners.add(fn); return () => { this.updateListeners.delete(fn) } }
  onHands(fn: (h: RemoteHand[] | null) => void) { this.handListeners.add(fn); return () => { this.handListeners.delete(fn) } }

  private patch(p: Partial<SessionSnapshot>) {
    this.snap = { ...this.snap, ...p }
    for (const fn of this.changeListeners) fn()
  }

  // ── lifecycle ────────────────────────────────────────────────────────────────
  start() {
    this.patch({ state: this.role === 'host' ? 'waiting' : 'connecting' })
    this.t.start()
    this.pingTimer = setInterval(() => { if (this.t.isOpen()) this.send({ k: 'ping', ts: Date.now(), t0: Math.round(performance.now() * 10) / 10 }) }, this.timers.pingMs)
    this.tickTimer = setInterval(() => this.tick(), this.timers.tickMs)
  }

  private tick() {
    const now = performance.now()
    const s = this.snap.state
    if (s === 'connected' && now - this.lastHeardAt > this.timers.staleMs) {
      // Nothing heard for a while (closed lid, lost signal): look for the other person again.
      this.t.relink()
      this.onDrop()
      return
    }
    if (s === 'reconnecting' && this.dropAt !== null && now - this.dropAt > this.timers.reconnectMs) { this.end('lost'); return }
    if (s === 'connected' && Date.now() - this.lastActivityAt > this.timers.idleMs) this.leave('expired')
  }

  /** Leave the room for both people. */
  leave(reason: EndReason = 'you-left') {
    if (this.stopped) return
    if (this.t.isOpen()) this.send({ k: 'bye', ts: Date.now(), from: this.sid })
    this.end(reason)
  }

  private end(reason: EndReason) {
    if (this.snap.state === 'ended' || this.snap.state === 'failed') return
    this.patch({ state: 'ended', ended: reason, activity: QUIET })
    this.emitHands(null)
    this.shutdown(150)
  }

  private fail(reason: FailReason) {
    if (this.snap.state === 'ended' || this.snap.state === 'failed') return
    this.patch({ state: 'failed', failure: reason, activity: QUIET })
    this.shutdown(0)
  }

  /** Stops everything without telling the other side (they will see "reconnecting"). */
  destroy() { this.shutdown(0) }

  private shutdown(delayMs: number) {
    if (this.stopped) return
    this.stopped = true
    if (this.pingTimer) clearInterval(this.pingTimer)
    if (this.tickTimer) clearInterval(this.tickTimer)
    this.pingTimer = this.tickTimer = null
    // A short delay lets a final "bye" leave before the channel closes.
    if (delayMs > 0) setTimeout(() => this.t.stop(), delayMs)
    else this.t.stop()
  }

  /** Host: the broker could not be reached; try again. */
  retryBroker() { if (this.t instanceof HostLinks) { this.patch({ brokerFailure: null }); this.t.retryPeer() } }

  // ── sending ──────────────────────────────────────────────────────────────────
  private send(p: Packet): boolean {
    const data = encodePacket(p)
    if (!this.t.send(data)) return false
    this.metrics.record('out', utf8Bytes(data), p.k)
    return true
  }

  private get live() { return this.snap.state === 'connected' && this.verified }

  sendText(raw: string, src: TextSource, lang: string): ChatMessage | null {
    const text = cleanText(raw)
    if (!text || this.stopped) return null
    const p: Extract<Packet, { k: 'text' }> = { k: 'text', id: newId(), ts: Date.now(), from: this.sid, text, lang, src }
    this.lastActivityAt = Date.now()
    let state: ChatMessage['state'] = 'queued'
    if (this.live && this.send(p)) { state = 'sent'; this.sentAt.set(p.id, performance.now()) }
    else { this.queue.push(p); if (this.queue.length > MAX_QUEUE) this.queue.shift() }
    return { id: p.id, mine: true, text, src, lang, at: Date.now(), state }
  }

  private flush() {
    const q = this.queue
    this.queue = []
    for (const p of q) {
      if (this.send({ ...p, ts: Date.now() })) { this.sentAt.set(p.id, performance.now()); this.emitUpdate(p.id, 'sent') }
      else this.queue.push(p)
    }
  }

  setActivity(a: Partial<PeerActivity>) {
    if (!this.live) return
    const p: Extract<Packet, { k: 'status' }> = { k: 'status', ts: Date.now(), from: this.sid, ...a }
    const key = JSON.stringify(a)
    if (key === this.lastStatus) return
    this.lastStatus = key
    this.send(p)
  }

  /** "Show my hands": call with every vision result; the gate decides what actually goes out. */
  sendHands(hands: readonly Hand[]) {
    if (!this.live) return
    const packed = hands.length ? packHands(hands) : { hands: '', mask: 0 }
    const p: Packet = { k: 'lm', ts: Date.now(), from: this.sid, hands: packed.hands, mask: packed.mask }
    const verdict = this.gate.offer(performance.now(), hands, utf8Bytes(encodePacket(p)))
    if (verdict) this.send(p)
  }

  stopHands() {
    if (this.live) this.send({ k: 'lm', ts: Date.now(), from: this.sid, hands: '', mask: 0 })
    this.gate.reset()
  }

  setProfile(profile: Profile) {
    this.profile = profile
    if (this.t.isOpen()) this.sendHello()
  }

  private sendHello() { this.send({ k: 'hello', v: PROTOCOL_VERSION, ts: Date.now(), from: this.sid, sid: this.sid, profile: this.profile }) }

  // ── transport events ─────────────────────────────────────────────────────────
  private onStatus(kind: LinkKind, status: LinkStatus, reason?: FailReason) {
    if (kind === 'peer') this.patch({ broker: status, brokerFailure: status === 'down' ? reason ?? 'network' : null })
    else this.patch({ local: status })
  }

  private onOpen(kind: LinkKind) {
    if (this.stopped) return
    this.verified = false
    this.lastHeardAt = performance.now()
    this.metrics.link = kind
    this.patch({ link: kind })
    this.sendHello()
  }

  private onDrop() {
    this.verified = false
    this.lastStatus = ''
    this.gate.reset()
    this.emitHands(null)
    if (this.snap.state === 'connected') {
      this.dropAt = performance.now()
      this.patch({ state: 'reconnecting', activity: QUIET })
    }
  }

  private onFail(reason: FailReason) {
    if (this.snap.state === 'connected' || this.snap.state === 'reconnecting') return // keep trying until the window ends
    this.fail(reason)
  }

  private allow(): boolean {
    // Token bucket: 50 packets/s sustained, bursts of 100. Floods are dropped, not processed.
    const now = performance.now()
    this.bucket.tokens = Math.min(100, this.bucket.tokens + ((now - this.bucket.at) / 1000) * 50)
    this.bucket.at = now
    if (this.bucket.tokens < 1) return false
    this.bucket.tokens -= 1
    return true
  }

  private onMessage(data: string) {
    if (this.stopped || !this.allow()) return
    const p = decodePacket(data)
    if (!p) return
    this.metrics.record('in', utf8Bytes(data), p.k)
    this.lastHeardAt = performance.now()
    switch (p.k) {
      case 'hello': return this.onHello(p)
      case 'ping': this.send({ k: 'pong', ts: Date.now(), t0: p.t0 }); return
      case 'pong': {
        const rtt = performance.now() - p.t0
        if (rtt >= 0 && rtt < 60_000) this.metrics.addRtt(Math.round(rtt * 10) / 10)
        return
      }
      case 'full':
        if (this.role !== 'guest' || this.snap.state === 'connected') return
        // The host may still be holding a link from before a reload; it frees it after a few seconds.
        if (++this.fullCount >= MAX_FULL_RETRIES) this.fail('full')
        return
      case 'bye':
        if (this.verified) this.end('left')
        return
    }
    if (!this.verified) return // nothing else counts until we know who this is
    switch (p.k) {
      case 'text':
        this.lastActivityAt = Date.now()
        this.send({ k: 'receipt', id: p.id, ts: Date.now() })
        this.emitMessage({ id: p.id, mine: false, text: p.text, src: p.src, lang: p.lang, at: Date.now() })
        return
      case 'gloss':
        this.lastActivityAt = Date.now()
        this.send({ k: 'receipt', id: p.id, ts: Date.now() })
        this.emitMessage({ id: p.id, mine: false, text: p.gloss.join(' '), gloss: p.gloss, src: 'gloss', lang: p.lang, at: Date.now() })
        return
      case 'receipt': {
        const t0 = this.sentAt.get(p.id)
        if (t0 === undefined) return
        this.sentAt.delete(p.id)
        this.metrics.addDelivery(Math.round(performance.now() - t0))
        this.emitUpdate(p.id, 'delivered')
        return
      }
      case 'status': {
        const a = this.snap.activity
        this.patch({ activity: { typing: p.typing ?? a.typing, listening: p.listening ?? a.listening, signing: p.signing ?? a.signing } })
        return
      }
      case 'lm':
        this.emitHands(p.mask === 0 ? null : unpackHands(p.hands, p.mask))
        return
    }
  }

  private onHello(p: Extract<Packet, { k: 'hello' }>) {
    if (this.role === 'host') {
      if (this.lockedSid && p.sid !== this.lockedSid) {
        // A third person with the code: the room belongs to the first guest.
        this.send({ k: 'full', ts: Date.now() })
        setTimeout(() => this.t.kick(), 300)
        return
      }
      this.lockedSid = p.sid
    }
    const first = !this.verified
    this.verified = true
    this.fullCount = 0
    if (first && this.metrics.connectMs === null) this.metrics.connectMs = Math.round(performance.now() - this.startedAt)
    this.dropAt = null
    this.patch({ state: 'connected', peerProfile: p.profile })
    if (first) {
      this.lastStatus = ''
      this.flush()
    }
  }

  private emitMessage(m: ChatMessage) { for (const fn of this.messageListeners) fn(m) }
  private emitUpdate(id: string, s: ChatMessage['state']) { for (const fn of this.updateListeners) fn(id, s) }
  private emitHands(h: RemoteHand[] | null) { for (const fn of this.handListeners) fn(h) }
}

/** Default profile for this device. */
export function defaultProfile(signLang: SignLang = 'isl'): Profile {
  return { name: '', receive: 'captions', send: 'type', lang: 'en-IN', signLang, grade: 'g1' }
}
