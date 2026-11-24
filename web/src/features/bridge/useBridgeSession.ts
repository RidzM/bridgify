import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { BridgeSession, type ChatMessage, type SessionSnapshot } from '@/engines/bridge/session'
import { newId, type Profile } from '@/engines/bridge/packets'
import type { Via } from '@/engines/bridge/links'
import type { Role } from '@/engines/bridge/transport'
import type { Hand } from '@/engines/vision/types'
import { clearLog, loadLog, saveLog, tabSid } from './store'

declare global {
  interface Window { __bridgeMetrics?: unknown; __bridgeTest?: { sendHands: (hands: Hand[]) => void } }
}

/** Metrics are exposed for tests and local development only (navigator.webdriver is set by Playwright). */
const exposeMetrics = () => import.meta.env.DEV || (typeof navigator !== 'undefined' && navigator.webdriver === true)

const IDLE: SessionSnapshot = {
  state: 'starting', role: 'guest', code: '', link: null, failure: null, ended: null,
  peerProfile: null, activity: { typing: false, listening: false, signing: false }, broker: null, brokerFailure: null, local: null,
}

/**
 * Runs one Bridge session for the life of the component. Only the Leave button ends the room:
 * moving to another page (say, SOS) just drops the link, so the other phone shows
 * "Reconnecting" and coming back within 30 s picks the conversation up again.
 */
export function useBridgeSession(code: string, role: Role, via: Via, profile: Profile) {
  const [session, setSession] = useState<BridgeSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadLog(code))
  const profileRef = useRef(profile)
  useLayoutEffect(() => { profileRef.current = profile }, [profile])

  useEffect(() => {
    const s = new BridgeSession({ code, role, via, profile: profileRef.current, sid: tabSid(code, () => newId(12)) })
    const offs = [
      s.onChatMessage((m) => setMessages((list) => [...list.slice(-199), m])),
      s.onMessageUpdate((id, state) => setMessages((list) => list.map((m) => (m.id === id ? { ...m, state } : m)))),
      s.onChange(() => { if (s.snapshot.state === 'ended') clearLog(code) }),
    ]
    if (exposeMetrics()) {
      Object.defineProperty(window, '__bridgeMetrics', { configurable: true, get: () => ({ ...s.metrics.snapshot(), state: s.snapshot.state }) })
      // Test seam: feed hand landmarks without a camera (headless browsers run vision at ~2 fps).
      window.__bridgeTest = { sendHands: (hands) => s.sendHands(hands) }
    }
    s.start()
    setSession(s)
    return () => {
      offs.forEach((off) => off())
      s.destroy()
      if (exposeMetrics()) { delete window.__bridgeMetrics; delete window.__bridgeTest }
    }
  }, [code, role, via])

  useEffect(() => { session?.setProfile(profile) }, [session, profile])
  useEffect(() => { if (session && session.snapshot.state !== 'ended') saveLog(code, messages) }, [code, messages, session])

  const snapshot = useSyncExternalStore(
    (fn) => session?.onChange(fn) ?? (() => {}),
    () => session?.snapshot ?? IDLE,
  )

  const add = (m: ChatMessage | null) => { if (m) setMessages((list) => [...list.slice(-199), m]) }
  return { session, snapshot, messages, add }
}
