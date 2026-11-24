/**
 * Braille translation for the UI. Uses liblouis (WebAssembly, in a worker) for Grade 1,
 * Grade 2 and Hindi Bharati; falls back to the built-in Grade 1 table if the engine can't load.
 */
import { translateGrade1, backTranslateGrade1 } from './grade1'

export type Table = 'en-ueb-g1' | 'en-ueb-g2' | 'hi-in-g1'
export const TABLES: { id: Table; label: string; note: string }[] = [
  { id: 'en-ueb-g1', label: 'Grade 1', note: 'Letter by letter (Unified English Braille)' },
  { id: 'en-ueb-g2', label: 'Grade 2', note: 'With contractions, as fluent readers use' },
  { id: 'hi-in-g1', label: 'Hindi (Bharati)', note: 'Devanagari to Bharati braille' },
]

let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (s: string) => void; reject: (e: Error) => void }>()
let engineState: 'unknown' | 'ok' | 'failed' = 'unknown'

function getWorker(): Worker | null {
  if (engineState === 'failed') return null
  if (!worker) {
    try {
      worker = new Worker(new URL('../../workers/braille.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (e: MessageEvent<{ id: number; result?: string; error?: string }>) => {
        const p = pending.get(e.data.id)
        if (!p) return
        pending.delete(e.data.id)
        if (e.data.error) p.reject(new Error(e.data.error))
        else { engineState = 'ok'; p.resolve(e.data.result ?? '') }
      }
      worker.onerror = () => { engineState = 'failed'; for (const p of pending.values()) p.reject(new Error('engine failed')); pending.clear() }
    } catch { engineState = 'failed'; return null }
  }
  return worker
}

function call(type: 'translate' | 'back', payload: { text?: string; unicode?: string; table: Table }): Promise<string> {
  const w = getWorker()
  if (!w) return Promise.reject(new Error('engine unavailable'))
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage({ type, id, ...payload })
    setTimeout(() => { if (pending.delete(id)) reject(new Error('timeout')) }, 8000)
  })
}

export interface BrailleResult { unicode: string; engine: 'liblouis' | 'offline-grade1' }

export async function toBraille(text: string, table: Table): Promise<BrailleResult> {
  try { return { unicode: await call('translate', { text, table }), engine: 'liblouis' } }
  catch {
    if (table === 'en-ueb-g1' || table === 'en-ueb-g2') return { unicode: translateGrade1(text).unicode, engine: 'offline-grade1' }
    throw new Error('Hindi braille needs the braille engine, which could not load. Reload the page to try again.')
  }
}

export async function fromBraille(unicode: string, table: Table): Promise<BrailleResult> {
  try { return { unicode: await call('back', { unicode, table }), engine: 'liblouis' } }
  catch { return { unicode: backTranslateGrade1(unicode), engine: 'offline-grade1' } }
}
