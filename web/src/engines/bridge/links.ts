/**
 * Picks the transport. The host listens on both at once (phones through the broker, and other
 * tabs of this browser); the first person in wins. A guest checks this browser first for a
 * few hundred ms while PeerJS warms up, then dials through the broker.
 */
import { encodePacket } from './packets'
import { PeerTransport } from './peerTransport'
import { LocalTransport, type FailReason, type LinkHandlers, type LinkKind, type LinkStatus, type Transport } from './transport'

export type Via = 'auto' | 'local' | 'peer'

export class HostLinks implements Transport {
  kind: LinkKind = 'peer'
  private active: Transport | null = null
  private peer: PeerTransport | null = null
  private local: LocalTransport | null = null
  private failures = new Map<LinkKind, FailReason>()
  private readonly code: string
  private readonly h: LinkHandlers
  private readonly use: { peer: boolean; local: boolean }

  constructor(code: string, handlers: LinkHandlers, use: { peer: boolean; local: boolean } = { peer: true, local: true }) {
    this.code = code
    this.h = handlers
    this.use = use
  }

  private child(kind: LinkKind): LinkHandlers {
    const t = () => (kind === 'peer' ? this.peer : this.local)
    return {
      status: (k: LinkKind, s: LinkStatus, r?: FailReason) => this.h.status?.(k, s, r),
      open: () => {
        const me = t()
        if (!me) return
        if (this.active && this.active !== me) {
          // Someone arrived on the other transport while a conversation is on: room full.
          me.send(encodePacket({ k: 'full', ts: Date.now() }))
          setTimeout(() => me.kick(), 300)
          return
        }
        this.active = me
        this.kind = kind
        this.h.open(kind)
      },
      message: (d) => { if (this.active === t()) this.h.message(d, kind) },
      drop: () => { if (this.active === t()) { this.active = null; this.h.drop(kind) } },
      fail: (reason) => {
        this.failures.set(kind, reason)
        const wanted = (this.use.peer ? 1 : 0) + (this.use.local ? 1 : 0)
        if (this.failures.size >= wanted) this.h.fail(this.failures.get('peer') ?? reason, kind)
      },
    }
  }

  start() {
    if (this.use.local) { this.local = new LocalTransport(this.code, 'host', this.child('local')); this.local.start() }
    if (this.use.peer) this.startPeer()
  }

  private startPeer() {
    this.failures.delete('peer')
    this.peer = new PeerTransport(this.code, 'host', this.child('peer'))
    void this.peer.start()
  }

  /** Try the broker again (after "couldn't reach the internet"). */
  retryPeer() {
    if (!this.use.peer || this.active === this.peer) return
    this.peer?.stop()
    this.startPeer()
  }

  send(d: string) { return this.active?.send(d) ?? false }
  isOpen() { return this.active?.isOpen() ?? false }
  relink() { this.active?.relink(); this.active = null }
  kick() { this.active?.kick(); this.active = null }
  stop() { this.peer?.stop(); this.local?.stop(); this.active = null }
}

export class GuestLinks implements Transport {
  kind: LinkKind = 'peer'
  private active: Transport | null = null
  private peer: PeerTransport | null = null
  private local: LocalTransport | null = null
  private localDone = false
  private peerFailure: FailReason | null = null
  private readonly code: string
  private readonly h: LinkHandlers
  private readonly via: Via

  constructor(code: string, handlers: LinkHandlers, via: Via = 'auto') {
    this.code = code
    this.h = handlers
    this.via = via
  }

  private child(kind: LinkKind): LinkHandlers {
    const t = () => (kind === 'peer' ? this.peer : this.local)
    return {
      status: (k: LinkKind, s: LinkStatus, r?: FailReason) => this.h.status?.(k, s, r),
      open: () => {
        const me = t()
        if (!me) return
        this.active = me
        this.kind = kind
        // Auto mode: the first link wins, the other attempt stops.
        if (this.via === 'auto') { if (kind === 'local') { this.peer?.stop(); this.peer = null } else { this.local?.stop(); this.local = null } }
        this.h.open(kind)
      },
      message: (d) => { if (this.active === t()) this.h.message(d, kind) },
      drop: () => { if (this.active === t()) this.h.drop(kind) },
      fail: (reason) => {
        if (this.via !== 'auto') { this.h.fail(reason, kind); return }
        if (kind === 'local') {
          this.localDone = true
          this.local?.stop()
          this.local = null
          if (reason === 'full') { this.peer?.stop(); this.h.fail('full', 'local'); return }
          // Nobody in this browser has that code: use the internet path.
          if (this.peerFailure) this.h.fail(this.peerFailure, 'peer')
          else this.peer?.dial()
          return
        }
        if (!this.localDone) { this.peerFailure = reason; return }
        this.h.fail(reason, 'peer')
      },
    }
  }

  start() {
    if (this.via === 'local' || this.via === 'auto') {
      this.local = new LocalTransport(this.code, 'guest', this.child('local'), this.via === 'auto' ? 350 : 2000)
    }
    if (this.via === 'peer' || this.via === 'auto') {
      this.peer = new PeerTransport(this.code, 'guest', this.child('peer'), { deferDial: this.via === 'auto' })
      void this.peer.start()
    }
    this.local?.start()
  }

  send(d: string) { return this.active?.send(d) ?? false }
  isOpen() { return this.active?.isOpen() ?? false }
  relink() { this.active?.relink() }
  kick() { /* hosts only */ }
  stop() { this.peer?.stop(); this.local?.stop(); this.active = null }
}
