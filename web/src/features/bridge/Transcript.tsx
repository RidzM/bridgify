import { useEffect, useRef, useState } from 'react'
import type { BridgeSession, ChatMessage } from '@/engines/bridge/session'
import { SOURCE_LABEL, timeOf } from './labels'

const STATE: Record<NonNullable<ChatMessage['state']>, string> = { queued: 'waiting to send', sent: 'sent', delivered: 'delivered' }

/** Two lanes: the other person on the left, you on the right. Newest at the bottom. */
export function Transcript({ messages, peerName }: { messages: ChatMessage[]; peerName: string }) {
  const box = useRef<HTMLElement>(null)
  const pinned = useRef(true)

  useEffect(() => {
    const el = box.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [messages])

  if (!messages.length) return <p className="text-ink-muted">Nothing said yet. Messages from both of you collect here.</p>
  return (
    <section
      ref={box}
      tabIndex={0}
      aria-label="Conversation so far"
      onScroll={(e) => { const el = e.currentTarget; pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}
      className="-mx-1 max-h-[30rem] overflow-y-auto px-1"
    >
      <ol className="flex flex-col gap-3.5">
        {messages.map((m) => (
          <li key={m.id} className={`flex max-w-[88%] flex-col ${m.mine ? 'items-end self-end' : 'items-start'}`}>
            <p lang={m.lang} className={`max-w-none break-words rounded-[12px] px-3.5 py-2 text-[1.0625rem] leading-snug text-ink ${m.mine ? 'border border-transparent bg-surface-2 in-[[data-mode=high-contrast]]:border-line' : 'border border-line bg-bg'}`}>
              {m.text}
            </p>
            <p className="mt-1 text-[0.8125rem] text-ink-muted tabular">
              {m.mine ? 'You' : peerName} · {timeOf(m.at)} · {SOURCE_LABEL[m.src]}{m.mine && m.state ? ` · ${STATE[m.state]}` : ''}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}

const fmtBytes = (b: number) => (b < 1000 ? `${b} B` : `${(b / 1000).toFixed(1)} KB`)
const fmtMs = (v: number | null) => (v === null ? '–' : `${Math.round(v)}`)

/** Small live meter: what actually crosses the network, and how long a round trip takes. */
export function Meter({ session }: { session: BridgeSession }) {
  const [m, setM] = useState(() => session.metrics.snapshot())
  useEffect(() => {
    const t = setInterval(() => setM(session.metrics.snapshot()), 1000)
    return () => clearInterval(t)
  }, [session])
  const hands = m.lmSentBps + m.lmRecvBps
  return (
    <p className="text-[0.8125rem] text-ink-muted tabular">
      {m.link === 'local' ? 'Linked to another tab in this browser' : 'Linked phone to phone'}
      {' · '}sent {fmtBytes(m.sentBps)}/s · received {fmtBytes(m.recvBps)}/s
      {hands > 0 && ` · hands ${((hands * 8) / 1000).toFixed(1)} kbps`}
      {' · '}{m.rttMedianMs === null ? 'measuring round trip' : `round trip ${fmtMs(m.rttLastMs)} ms (median ${fmtMs(m.rttMedianMs)}, p95 ${fmtMs(m.rttP95Ms)})`}
    </p>
  )
}
