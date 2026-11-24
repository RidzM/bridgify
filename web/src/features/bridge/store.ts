/**
 * Bridge choices remembered on this device (name, how you receive and send). Conversation
 * text is not stored here: it lives in memory, plus sessionStorage for the current tab so a
 * reload doesn't lose it, and is cleared when the conversation ends.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { BrailleGrade, ReceiveMode, SendMode } from '@/engines/bridge/packets'
import type { ChatMessage } from '@/engines/bridge/session'

interface BridgePrefs {
  name: string
  receive: ReceiveMode
  send: SendMode
  grade: BrailleGrade
  showHands: boolean
  update: (p: Partial<Omit<BridgePrefs, 'update'>>) => void
}

export const useBridgePrefs = create<BridgePrefs>()(
  persist(
    (set) => ({ name: '', receive: 'captions', send: 'type', grade: 'g1', showHands: false, update: (p) => set(p) }),
    { name: 'bridgify.bridge.v1', version: 1, storage: createJSONStorage(() => localStorage), partialize: ({ update: _u, ...rest }) => rest },
  ),
)

const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn() } catch { return fallback } }

/** Per-tab id, so reloading the page rejoins the same conversation. */
export function tabSid(code: string, make: () => string): string {
  const key = `bridgify.bridge.sid.${code}`
  return safe(() => {
    const have = sessionStorage.getItem(key)
    if (have) return have
    const sid = make()
    sessionStorage.setItem(key, sid)
    return sid
  }, make())
}

const logKey = (code: string) => `bridgify.bridge.log.${code}`
export const loadLog = (code: string): ChatMessage[] => safe(() => JSON.parse(sessionStorage.getItem(logKey(code)) ?? '[]') as ChatMessage[], [])
export const saveLog = (code: string, log: ChatMessage[]) => safe(() => sessionStorage.setItem(logKey(code), JSON.stringify(log.slice(-200))), undefined)
export const clearLog = (code: string) => safe(() => { sessionStorage.removeItem(logKey(code)); sessionStorage.removeItem(`bridgify.bridge.sid.${code}`) }, undefined)
