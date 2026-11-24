import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { NO_MOTION_MODES, type Mode } from '@/lib/modes'
import type { ToolId } from '@/lib/tools'

export type SignLang = 'asl' | 'isl' | 'lsf' | 'lsm' | 'lis' | 'dgs'
export type MotionPref = 'system' | 'on' | 'off'

export interface Prefs {
  mode: Mode
  textScale: number
  hiddenTools: ToolId[]
  underlineLinks: boolean
  largeCursor: boolean
  motion: MotionPref
  tts: { voiceURI?: string; rate: number; lang: string }
  stt: { lang: 'en-IN' | 'en-US' | 'hi-IN'; smartPunctuation: boolean; engine: 'auto' | 'browser' | 'whisper' }
  sign: { lang: SignLang }
  sos: { name: string; contact: string; notes: string }
}

interface PrefsActions {
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
  toggleTool: (id: ToolId) => void
  reset: () => void
}

export const PREFS_KEY = 'bridgify.prefs.v1'

export const defaultPrefs: Prefs = {
  mode: 'light',
  textScale: 1,
  hiddenTools: [],
  underlineLinks: false,
  largeCursor: false,
  motion: 'system',
  tts: { rate: 5, lang: 'en-IN' },
  stt: { lang: 'en-IN', smartPunctuation: true, engine: 'auto' },
  sign: { lang: 'isl' },
  sos: { name: '', contact: '', notes: '' },
}

export const usePrefs = create<Prefs & PrefsActions>()(
  persist(
    (set) => ({
      ...defaultPrefs,
      set: (key, value) => set({ [key]: value } as Partial<Prefs>),
      toggleTool: (id) =>
        set((s) => ({
          hiddenTools: s.hiddenTools.includes(id) ? s.hiddenTools.filter((t) => t !== id) : [...s.hiddenTools, id],
        })),
      reset: () => set({ ...defaultPrefs }),
    }),
    {
      name: PREFS_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ set: _s, toggleTool: _t, reset: _r, ...rest }) => rest,
    },
  ),
)

export function motionOff(mode: Mode, motion: MotionPref, systemReduced: boolean): boolean {
  if (motion === 'off') return true
  if (motion === 'on') return false
  return NO_MOTION_MODES.includes(mode) || systemReduced
}

/** Reflect prefs onto <html> so CSS tokens apply everywhere. */
export function applyPrefsToDocument(p: Pick<Prefs, 'mode' | 'textScale' | 'underlineLinks' | 'largeCursor' | 'motion'>) {
  const html = document.documentElement
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  html.dataset.mode = p.mode
  html.dataset.motion = motionOff(p.mode, p.motion, reduced) ? 'off' : 'on'
  html.dataset.underline = p.underlineLinks ? 'on' : 'off'
  html.dataset.cursor = p.largeCursor ? 'large' : 'normal'
  html.style.setProperty('--text-scale', String(p.textScale))
}
