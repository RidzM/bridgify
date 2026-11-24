/**
 * Phone-to-phone link: a WebRTC data channel found through the free PeerJS cloud broker
 * (0.peerjs.com). The broker only passes the connection setup; messages go directly between
 * the phones (or through PeerJS's public TURN relay when a network blocks direct links),
 * encrypted by WebRTC (DTLS). The host registers `bridgify-<CODE>`; the guest dials it.
 * PeerJS (~30 KB gz) is loaded only when a Bridge starts.
 */
import type { DataConnection } from 'peerjs'
import { peerIdFor } from './code'
import { encodePacket, newId } from './packets'
import { STALE_MS, type FailReason, type LinkHandlers, type Role, type Transport } from './transport'

type PeerInstance = InstanceType<typeof import('peerjs').default>

export interface PeerTransportOptions {
  /** Guest only: wait for dial() instead of dialling at start (lets a local check run first). */
  deferDial?: boolean
  connectTimeoutMs?: number
  retryMs?: number
}

export const BROKER = { host: '0.peerjs.com', port: 443, path: '/', secure: true } as const

/** One loader for the PeerJS chunk (only the Peer class, so the bundler can drop the rest). */
const loadPeer = () => import('peerjs').then((m) => m.default)

/** Fetch the PeerJS chunk ahead of time (the Bridge start screen calls this). */
export const preloadPeer = () => { void loadPeer().catch(() => {}) }

/** localStorage "bridgify.debug" = "peer" turns on PeerJS logs, for diagnosing a network. */
const debugOn = () => { try { return Boolean(localStorage.getItem('bridgify.debug')?.includes('peer')) } catch { return false } }
const log = (...a: unknown[]) => { if (debugOn()) console.info('[bridge/peer]', ...a) }

export class PeerTransport implements Transport {
  readonly kind = 'peer' as const
  private peer: PeerInstance | null = null
  private conn: DataConnection | null = null
  private pending: DataConnection | null = null
  private open = false
  private everOpen = false
  private stopped = false
  private failed = false
  private wantDial = false
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private brokerTimer: ReturnType<typeof setTimeout> | null = null
  private openTimer: ReturnType<typeof setTimeout> | null = null
  private brokerTries = 0
  private lastHeardAt = 0
  private readonly code: string
  private readonly role: Role
  private readonly h: LinkHandlers
  private readonly opts: PeerTransportOptions

  constructor(code: string, role: Role, handlers: LinkHandlers, opts: PeerTransportOptions = {}) {
    this.code = code
    this.role = role
    this.h = handlers
    this.opts = opts
  }

  async start() {
    this.h.status?.('peer', 'connecting')
    let Peer: typeof import('peerjs').default
    try { Peer = await loadPeer() } catch { this.fail('network'); return }
    if (this.stopped) return
    try {
      const opts = { ...BROKER, debug: debugOn() ? 3 : 0 }
      // The guest picks its own random id, which skips PeerJS's extra round trip to fetch one.
      this.peer = new Peer(this.role === 'host' ? peerIdFor(this.code) : `bridgify-g-${newId(16)}`, opts)
    } catch { this.fail('unsupported'); return }
    const peer = this.peer
    // The broker must answer first: PeerJS 1.5.5 drops (rather than queues) anything sent
    // before its socket is open, so the guest dials only after 'open'.
    this.openTimer = setTimeout(() => { this.openTimer = null; if (!peer.open && !this.everOpen) { log('broker timeout'); this.fail('network') } }, this.opts.connectTimeoutMs ?? 15000)
    peer.on('open', () => {
      log('broker open', peer.id)
      if (this.openTimer) clearTimeout(this.openTimer)
      this.openTimer = null
      this.brokerTries = 0
      if (this.role === 'host') this.h.status?.('peer', 'listening')
      else if (this.wantDial && !this.open && !this.pending) this.dial()
    })
    peer.on('connection', (c) => this.accept(c))
    peer.on('disconnected', () => this.reconnectBroker())
    peer.on('error', (e) => this.onPeerError(e.type))
    if (this.role === 'guest' && !this.opts.deferDial) this.wantDial = true
  }

  /** Guest: dial the host (again). Before the broker answers, this waits for 'open'. */
  dial() {
    this.wantDial = true
    if (this.stopped || this.failed || this.open || !this.peer) return
    if (this.peer.destroyed) { this.fail('network'); return }
    if (!this.peer.open) { if (this.peer.disconnected) this.reconnectBroker(); return }
    this.dropPending()
    const c = this.peer.connect(peerIdFor(this.code), { reliable: true, serialization: 'raw', metadata: { app: 'bridgify', v: 1 } })
    if (!c) { this.retrySoon(); return }
    this.pending = c
    this.wire(c)
    if (this.connectTimer) clearTimeout(this.connectTimer)
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null
      if (this.open || this.stopped || this.pending !== c) return
      this.dropPending()
      // Found the other phone but couldn't open a channel: a network blocking WebRTC.
      log('connect timeout')
      if (!this.everOpen) this.fail('network')
      else this.retrySoon()
    }, this.opts.connectTimeoutMs ?? 15000)
  }

  private wire(c: DataConnection) {
    c.on('open', () => {
      if (this.stopped) { c.close(); return }
      const old = this.open ? this.conn : null
      if (this.role === 'host' && old && old !== c) {
        // A live link means the room is full. A silent one is probably the same person
        // reconnecting (reload, network change), so the new link replaces it.
        if (Date.now() - this.lastHeardAt < STALE_MS) { this.reject(c); return }
        this.conn = null
        try { old.close() } catch { /* closed */ }
      }
      if (this.pending === c) this.pending = null
      if (this.connectTimer) clearTimeout(this.connectTimer)
      if (this.retryTimer) clearTimeout(this.retryTimer)
      this.connectTimer = this.retryTimer = null
      this.conn = c
      this.open = true
      this.everOpen = true
      this.lastHeardAt = Date.now()
      this.h.open('peer')
    })
    c.on('data', (d) => {
      if (c !== this.conn || !this.open || typeof d !== 'string') return
      this.lastHeardAt = Date.now()
      this.h.message(d, 'peer')
    })
    const lost = () => {
      if (c === this.pending) { this.pending = null; if (this.role === 'guest' && this.everOpen) this.retrySoon(); return }
      if (c !== this.conn) return
      this.conn = null
      if (this.open) { this.open = false; this.h.drop('peer') }
      if (this.role === 'guest') this.retrySoon()
    }
    c.on('close', lost)
    c.on('error', lost)
    c.on('iceStateChanged', (s) => { if (s === 'failed' || s === 'closed') { try { c.close() } catch { /* already closed */ } lost() } })
  }

  private accept(c: DataConnection) {
    if (this.stopped) { c.close(); return }
    this.wire(c)
  }

  /** A third person: tell them the room is full, then hang up. */
  private reject(c: DataConnection) {
    const refuse = () => {
      try { void c.send(encodePacket({ k: 'full', ts: Date.now() })) } catch { /* closed */ }
      setTimeout(() => { try { c.close() } catch { /* closed */ } }, 400)
    }
    if (c.open) refuse()
    else c.on('open', refuse)
  }

  private onPeerError(type: string) {
    log('peer error', type, { open: this.open, everOpen: this.everOpen })
    if (this.stopped) return
    switch (type) {
      case 'peer-unavailable':
        // The broker has no host with this code (yet). First try: wrong code. Later: keep trying.
        this.dropPending()
        if (this.role === 'guest' && !this.everOpen) this.fail('not-found')
        else this.retrySoon()
        return
      case 'unavailable-id':
        if (!this.everOpen) this.fail('taken')
        return
      case 'browser-incompatible':
        this.fail('unsupported')
        return
      case 'disconnected':
        this.reconnectBroker()
        return
      default:
        // network, server-error, socket-error, socket-closed, ssl-unavailable, webrtc
        if (!this.everOpen) this.fail('network')
        else this.reconnectBroker()
    }
  }

  /** Lost the broker (not necessarily the other phone). Re-register with back-off. */
  private reconnectBroker() {
    if (this.stopped || this.failed || this.brokerTimer || !this.peer || this.peer.destroyed) return
    const wait = Math.min(15000, 1000 * 2 ** this.brokerTries++)
    this.brokerTimer = setTimeout(() => {
      this.brokerTimer = null
      if (!this.peer || this.stopped || this.peer.destroyed) return
      if (this.peer.disconnected) { try { this.peer.reconnect() } catch { /* still connecting */ } }
    }, wait)
  }

  private retrySoon() {
    if (this.role !== 'guest' || this.stopped || this.failed || this.open || this.retryTimer) return
    this.retryTimer = setTimeout(() => { this.retryTimer = null; this.dial() }, this.opts.retryMs ?? 2000)
  }

  private dropPending() {
    const p = this.pending
    this.pending = null
    if (p) { try { p.close() } catch { /* closed */ } }
  }

  private fail(reason: FailReason) {
    if (this.failed || this.stopped) return
    this.failed = true
    this.h.status?.('peer', 'down', reason)
    this.h.fail(reason, 'peer')
    this.teardown()
  }

  send(data: string): boolean {
    if (!this.open || !this.conn) return false
    try { void this.conn.send(data); return true } catch { return false }
  }

  isOpen() { return this.open }

  relink() {
    if (this.stopped) return
    const c = this.conn
    this.conn = null
    this.open = false
    if (c) { try { c.close() } catch { /* closed */ } }
    if (this.role === 'guest') this.retrySoon()
    else if (this.peer?.disconnected) this.reconnectBroker()
  }

  kick() {
    if (this.role !== 'host') return
    const c = this.conn
    this.conn = null
    this.open = false
    if (c) { try { c.close() } catch { /* closed */ } }
  }

  private teardown() {
    for (const t of [this.retryTimer, this.connectTimer, this.brokerTimer, this.openTimer]) if (t) clearTimeout(t)
    this.retryTimer = this.connectTimer = this.brokerTimer = this.openTimer = null
    this.dropPending()
    const c = this.conn
    this.conn = null
    this.open = false
    if (c) { try { c.close() } catch { /* closed */ } }
    try { this.peer?.destroy() } catch { /* already gone */ }
    this.peer = null
  }

  stop() {
    if (this.stopped) return
    this.stopped = true
    this.teardown()
  }
}
