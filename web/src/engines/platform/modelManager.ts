/**
 * Downloads model files once, verifies them, and keeps them in the Cache API so the
 * camera tools work offline afterwards. Only called from pages that need a model.
 */
export interface ModelFile { url: string; bytes: number; sha256?: string }
export interface ModelEntry { id: string; url: string; bytes: number; sha256?: string; licence?: string; source?: string; version?: string; files: Record<string, ModelFile> }
export interface Manifest { models: ModelEntry[] }
export type Progress = (loaded: number, total: number) => void

const CACHE = 'bridgify-models-v1'
let manifestPromise: Promise<Manifest> | null = null

export function loadManifest(): Promise<Manifest> {
  manifestPromise ??= fetch('/models/manifest.json', { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error('Could not load the model list')
    return r.json() as Promise<Manifest>
  })
  return manifestPromise
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function readWithProgress(res: Response, total: number, onProgress?: Progress): Promise<ArrayBuffer> {
  if (!res.body || !onProgress) return res.arrayBuffer()
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    onProgress(loaded, total)
  }
  const out = new Uint8Array(loaded)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.byteLength }
  return out.buffer
}

/** Returns one file of a model (e.g. ensureModel('asl-letters', 'bin')), from cache when possible. */
export async function ensureModel(id: string, file = 'task', onProgress?: Progress): Promise<ArrayBuffer> {
  const { models } = await loadManifest()
  const m = models.find((x) => x.id === id)
  const f = m?.files[file]
  if (!m || !f) throw new Error(`Unknown model file: ${id}/${file}`)
  const key = `${f.url}?v=${f.sha256 ?? m.version ?? '1'}`
  const cache = 'caches' in self ? await caches.open(CACHE).catch(() => null) : null
  const hit = await cache?.match(key)
  if (hit) { onProgress?.(f.bytes, f.bytes); return hit.arrayBuffer() }
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(f.url)
    if (!res.ok) throw new Error(`Download failed (${res.status})`)
    const buf = await readWithProgress(res, f.bytes, onProgress)
    if (f.sha256 && (await sha256Hex(buf)) !== f.sha256) { if (attempt === 0) continue; throw new Error('The downloaded model was damaged. Try again.') }
    await cache?.put(key, new Response(buf.slice(0)))
    return buf
  }
  throw new Error('Model download failed')
}
