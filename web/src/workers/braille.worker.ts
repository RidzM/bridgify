/**
 * Braille module worker: runs liblouis (wasm) off the main thread.
 *
 * in:  { type: 'translate', id, text, table } | { type: 'back', id, unicode, table }
 * out: { id, result } | { id, error }
 */
import { loadLouis, LOUIS_TABLES, type LouisTable } from '../engines/braille/louis'

export type BrailleRequest =
  | { type: 'translate'; id: number | string; text: string; table: LouisTable }
  | { type: 'back'; id: number | string; unicode: string; table: LouisTable }

export type BrailleResponse =
  | { id: number | string; result: string }
  | { id: number | string; error: string }

// Typed via the DOM lib (the app tsconfig has no webworker lib); same API in a worker.
const scope = self as unknown as {
  postMessage(msg: BrailleResponse): void
  addEventListener(type: 'message', fn: (ev: MessageEvent<BrailleRequest>) => void): void
}

function reply(msg: BrailleResponse): void {
  scope.postMessage(msg)
}

scope.addEventListener('message', (ev: MessageEvent<BrailleRequest>) => {
  const req = ev.data
  const id = req?.id
  void (async () => {
    try {
      if (!req || !(req.table in LOUIS_TABLES)) throw new Error(`unknown braille table: ${String(req?.table)}`)
      const louis = await loadLouis()
      if (req.type === 'translate') reply({ id, result: louis.translate(String(req.text ?? ''), req.table) })
      else if (req.type === 'back') reply({ id, result: louis.backTranslate(String(req.unicode ?? ''), req.table) })
      else throw new Error(`unknown request type: ${String((req as { type?: unknown }).type)}`)
    } catch (err) {
      reply({ id, error: err instanceof Error ? err.message : String(err) })
    }
  })()
})
