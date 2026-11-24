/**
 * liblouis 3.39.0 compiled to WebAssembly (decision D-24). Runs fully in the
 * browser: the module and its tables live in public/wasm/liblouis/ and are
 * fetched on first use, never bundled.
 *
 * Widechar: the wasm is built with --enable-ucs4, so liblouis's `widechar` is
 * 32-bit and every Unicode code point (BMP or not) is one unit. This matches the
 * native Debian build the server uses, so output is byte-identical. Strings are
 * marshalled code point by code point into a Uint32Array.
 */

export type LouisTable = 'en-ueb-g1' | 'en-ueb-g2' | 'hi-in-g1'

export const LOUIS_TABLES: Record<LouisTable, string> = {
  'en-ueb-g1': 'unicode.dis,en-ueb-g1.ctb',
  'en-ueb-g2': 'unicode.dis,en-ueb-g2.ctb',
  'hi-in-g1': 'unicode.dis,hi-in-g1.utb',
}

export interface Louis {
  /** Print text -> Unicode braille (U+2800..U+28FF; spaces come out as U+2800). */
  translate(text: string, table: LouisTable): string
  /** Unicode braille -> print text. */
  backTranslate(unicode: string, table: LouisTable): string
  /** liblouis version string, e.g. "3.39.0". */
  version(): string
}

/** The subset of the Emscripten module we use. */
interface LouisModule {
  HEAPU8: Uint8Array
  _malloc(size: number): number
  _free(ptr: number): void
  _lou_translateString(
    table: number, inbuf: number, inlen: number, outbuf: number, outlen: number,
    typeform: number, spacing: number, mode: number,
  ): number
  _lou_backTranslateString(
    table: number, inbuf: number, inlen: number, outbuf: number, outlen: number,
    typeform: number, spacing: number, mode: number,
  ): number
  _lou_version(): number
  _lou_charSize(): number
  _lou_checkTable(table: number): number
  UTF8ToString(ptr: number): string
  stringToUTF8(str: string, ptr: number, maxBytes: number): void
  lengthBytesUTF8(str: string): number
}

type Factory = (opts?: { wasmBinary?: ArrayBuffer | Uint8Array }) => Promise<LouisModule>

export interface LoadOptions {
  /** URL of liblouis.mjs. Defaults to `${BASE_URL}wasm/liblouis/liblouis.mjs`. */
  moduleUrl?: string
  /** Pre-fetched wasm bytes (tests in Node pass these). */
  wasmBinary?: ArrayBuffer | Uint8Array
}

const MAX_ATTEMPTS = 6 // initial capacity x 32 at most

/** Output buffer sizing, in widechars. Exposed so tests can force the retry path. */
export const tuning = {
  initialCapacity: (inlen: number): number => Math.max(4 * inlen + 64, 256),
}

function toCodePoints(s: string): Uint32Array {
  const out = new Uint32Array(s.length) // code points <= UTF-16 units
  let n = 0
  for (const ch of s) out[n++] = ch.codePointAt(0) ?? 0
  return out.subarray(0, n)
}

function fromCodePoints(units: Uint32Array): string {
  let s = ''
  const CHUNK = 8192
  for (let i = 0; i < units.length; i += CHUNK) {
    s += String.fromCodePoint(...units.subarray(i, i + CHUNK))
  }
  return s
}

function wrap(mod: LouisModule): Louis {
  const charSize = mod._lou_charSize()
  if (charSize !== 4) throw new Error(`liblouis wasm built with ${charSize}-byte widechar; expected 4`)

  const tablePtrs = new Map<LouisTable, number>()
  function tablePtr(table: LouisTable): number {
    let p = tablePtrs.get(table)
    if (p !== undefined) return p
    const list = LOUIS_TABLES[table]
    if (!list) throw new Error(`unknown braille table: ${String(table)}`)
    const bytes = mod.lengthBytesUTF8(list) + 1
    p = mod._malloc(bytes)
    mod.stringToUTF8(list, p, bytes)
    if (!mod._lou_checkTable(p)) {
      mod._free(p)
      throw new Error(`liblouis could not compile table ${list}`)
    }
    tablePtrs.set(table, p)
    return p
  }

  function run(fn: 'translate' | 'back', text: string, table: LouisTable): string {
    const tp = tablePtr(table)
    const input = toCodePoints(text)
    const inlen = input.length
    if (inlen === 0) return ''
    // Generous output buffer (grade 2 back-translation expands, indicators add
    // cells); grow and retry if liblouis reports it filled the buffer.
    // When the buffer fills, liblouis still returns success but consumes less
    // than the whole input (observed: inlen 37 -> 5 with outlen 5).
    let cap = tuning.initialCapacity(inlen)
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++, cap *= 2) {
      const inPtr = mod._malloc(inlen * 4)
      const outPtr = mod._malloc(cap * 4)
      const lens = mod._malloc(8) // [inlen, outlen] as int32
      try {
        new Uint32Array(mod.HEAPU8.buffer, inPtr, inlen).set(input)
        const lv = new Int32Array(mod.HEAPU8.buffer, lens, 2)
        lv[0] = inlen
        lv[1] = cap
        const call = fn === 'translate' ? mod._lou_translateString : mod._lou_backTranslateString
        const ok = call(tp, inPtr, lens, outPtr, lens + 4, 0, 0, 0)
        // Re-read views: memory may have grown during the call.
        const after = new Int32Array(mod.HEAPU8.buffer, lens, 2)
        const consumed = after[0] ?? 0
        const produced = after[1] ?? 0
        if (!ok) throw new Error(`liblouis ${fn === 'translate' ? 'translation' : 'back-translation'} failed`)
        if (consumed < inlen || produced >= cap) continue
        return fromCodePoints(new Uint32Array(mod.HEAPU8.buffer, outPtr, produced).slice())
      } finally {
        mod._free(lens)
        mod._free(outPtr)
        mod._free(inPtr)
      }
    }
    throw new Error('liblouis output did not fit after retries')
  }

  const ver = mod.UTF8ToString(mod._lou_version())
  return {
    translate: (text, table) => run('translate', text, table),
    backTranslate: (unicode, table) => run('back', unicode, table),
    version: () => ver,
  }
}

function defaultModuleUrl(): string {
  const base = import.meta.env?.BASE_URL ?? '/'
  const path = `${base.endsWith('/') ? base : `${base}/`}wasm/liblouis/liblouis.mjs`
  // Absolute URL on purpose: Vite's dev server appends `?import` to relative
  // dynamic-import specifiers and then refuses to serve files from public/.
  const here = (globalThis as { location?: { href: string } }).location?.href
  return here ? new URL(path, here).href : path
}

let pending: Promise<Louis> | null = null

/** Lazily load the wasm engine once; later calls share the same instance. */
export function loadLouis(opts: LoadOptions = {}): Promise<Louis> {
  if (!pending) {
    const url = opts.moduleUrl ?? defaultModuleUrl()
    pending = (async () => {
      const ns = (await import(/* @vite-ignore */ url)) as { default: Factory }
      const mod = await ns.default(opts.wasmBinary ? { wasmBinary: opts.wasmBinary } : {})
      return wrap(mod)
    })()
    pending.catch(() => {
      pending = null // allow a retry after a failed load (e.g. offline first visit)
    })
  }
  return pending
}
