// Shared helpers for the sign content build (poses from sign.mt, lexicons, credits).
// Node >= 22.18 (imports the app's own TypeScript pose reader directly).
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { readPose } from '../../web/src/engines/sign/poseFile.ts'

export const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(HERE, '../..')
export const WEB = join(ROOT, 'web')
export const PUBLIC_SIGNS = join(WEB, 'public/signs')
export const CONTENT = join(ROOT, 'content')
export const CACHE = join(HERE, '.cache')
export const CONVERTER = join(WEB, 'scripts/pose-to-compact.ts')

export const LANGS = ['asl', 'isl', 'lsf', 'lsm', 'lis', 'dgs']
/** sign.mt codes per app language. ISL is queried with English (sign.mt has no usable Hindi lexicon). */
export const SIGNMT = {
  asl: { signed: 'ase', spoken: 'en' },
  isl: { signed: 'ins', spoken: 'en' },
  lsf: { signed: 'fsl', spoken: 'fr' },
  lsm: { signed: 'mfs', spoken: 'es' },
  lis: { signed: 'ise', spoken: 'it' },
  dgs: { signed: 'gsg', spoken: 'de' },
}
/** Spoken language of each sign language's word list (ISL words also carry Hindi forms). */
export const SPOKEN = { asl: 'en', isl: 'en', lsf: 'fr', lsm: 'es', lis: 'it', dgs: 'de' }
/** Which quick-access file the Text to Sign page shows for each sign language. */
export const QA_FOR = { asl: 'en', isl: 'hi', lsf: 'fr', lsm: 'es', lis: 'it', dgs: 'de' }
/** Spoken language used for tutorial phrase text. */
export const TUTORIAL_SPOKEN = { asl: 'en', isl: 'hi', lsf: 'fr', lsm: 'es', lis: 'it', dgs: 'de' }

export const API = 'https://us-central1-sign-mt.cloudfunctions.net/spoken_text_to_signed_pose'
export const WARN_BYTES = 120 * 1024
export const DROP_BYTES = 300 * 1024
export const GAP_MS = 1000
export const TIMEOUT_MS = 30000
export const RETRIES = 2

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
export function writeJson(p, data, pretty = true) {
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, (pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)) + '\n')
}

/** File slug: lowercase ASCII, words joined by '-'. ä→ae ö→oe ü→ue ß→ss, other accents dropped (é→e, ñ→n). */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae').replace(/œ/g, 'oe')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Same normalisation the app's tokenizer applies (web/src/engines/sign/tokenize.ts). */
export const normalise = (s) =>
  s.toLowerCase().normalize('NFC').replace(/[“”"«»¿¡!?.,;:()]/g, ' ').replace(/\s+/g, ' ').trim()

// ---------------------------------------------------------------- sign.mt fetch (polite, cached)

let lastEnd = 0
let requestCount = 0
export const stats = () => ({ requests: requestCount })

function cachePaths({ text, spoken, signed }) {
  const key = createHash('sha1').update(`${signed}|${spoken}|${text}`).digest('hex').slice(0, 10)
  const dir = join(CACHE, 'raw', `${signed}-${spoken}`)
  const base = join(dir, `${(slugify(text) || 'u').slice(0, 60)}-${key}`)
  return { dir, meta: `${base}.json`, pose: `${base}.pose` }
}

function parseGlosses(h) {
  if (!h) return null
  let s = h
  try { s = decodeURIComponent(h) } catch { /* keep raw */ }
  return s.split(' ').filter(Boolean).map((pair) => {
    const i = pair.lastIndexOf('/')
    return i > 0 ? { word: pair.slice(0, i), gloss: pair.slice(i + 1) } : { word: pair, gloss: pair }
  })
}

/**
 * GET one text from sign.mt. One request at a time, >= 1 s between requests, 30 s timeout, 2 retries.
 * Raw answers are cached in .cache/raw/ (a definite "no sign" answer is cached too).
 * Returns { status, posePath?, glosses?, message?, cached }.
 */
export async function fetchSignMt(q, { refresh = false, offline = false, log = () => {} } = {}) {
  const p = cachePaths(q)
  if (!refresh && existsSync(p.meta)) {
    const meta = readJson(p.meta)
    if (meta.status === 200 && existsSync(p.pose)) return { ...meta, posePath: p.pose, cached: true }
    if (meta.definitive) return { ...meta, cached: true }
  }
  if (offline) return { ...q, status: -1, message: 'not cached', cached: false }
  mkdirSync(p.dir, { recursive: true })
  const url = `${API}?text=${encodeURIComponent(q.text)}&spoken=${q.spoken}&signed=${q.signed}`
  let last = null
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const gap = lastEnd + GAP_MS + (attempt ? 3000 * attempt : 0) - Date.now()
    if (gap > 0) await sleep(gap)
    const t0 = Date.now()
    requestCount++
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      const buf = Buffer.from(await res.arrayBuffer())
      lastEnd = Date.now()
      const base = { text: q.text, spoken: q.spoken, signed: q.signed, ms: lastEnd - t0, fetchedAt: new Date().toISOString() }
      if (res.status === 200 && (res.headers.get('content-type') ?? '').includes('pose') && buf.length > 64) {
        writeFileSync(p.pose, buf)
        const meta = { ...base, status: 200, bytes: buf.length, glosses: parseGlosses(res.headers.get('x-glosses')) }
        writeJson(p.meta, meta)
        return { ...meta, posePath: p.pose, cached: false }
      }
      let message = buf.toString('utf8').slice(0, 300)
      try { message = JSON.parse(message).message ?? message } catch { /* not JSON */ }
      const noSign = res.status === 500 && /No poses found/i.test(message)
      const definitive = noSign || res.status === 400 || res.status === 404 || (res.status === 500 && attempt === RETRIES && message.length < 300)
      last = { ...base, status: res.status, message, definitive, noSign }
      log(`  ${q.signed} "${q.text}" -> ${res.status} ${message.slice(0, 80)}`)
      if (definitive) { writeJson(p.meta, last); return { ...last, cached: false } }
    } catch (e) {
      lastEnd = Date.now()
      last = { text: q.text, spoken: q.spoken, signed: q.signed, status: 0, message: String(e?.message ?? e), ms: lastEnd - t0, definitive: false }
      log(`  ${q.signed} "${q.text}" -> network error ${last.message}`)
    }
  }
  return { ...last, cached: false }
}

// ---------------------------------------------------------------- pose analysis and trimming

/** Byte layout of a .pose v0.1/v0.2 file (mirrors web/src/engines/sign/poseFile.ts). */
export function poseLayout(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let o = 0
  const u16 = () => { const v = dv.getUint16(o, true); o += 2; return v }
  const f32 = () => { const v = dv.getFloat32(o, true); o += 4; return v }
  const str = () => { const n = u16(); o += n }
  const version = Math.round(f32() * 1000) / 1000
  u16(); u16(); u16()
  const nComp = u16()
  let P = 0; let dims = 0
  for (let c = 0; c < nComp; c++) {
    str()
    const fmtLen = dv.getUint16(o, true); str()
    const nPoints = u16(); const nLimbs = u16(); const nColors = u16()
    for (let i = 0; i < nPoints; i++) str()
    o += nLimbs * 4 + nColors * 6
    P += nPoints; dims = Math.max(dims, fmtLen - 1)
  }
  const framesAt = version === 0.1 ? o + 2 : o + 4
  let frames
  if (version === 0.1) { o += 2; frames = u16() } else if (version === 0.2) { f32(); frames = dv.getUint32(o, true); o += 4 } else throw new Error(`pose version ${version}`)
  const people = u16()
  return { version, P, dims, people, frames, framesAt, headerEnd: o }
}

/** Copy of a pose with only frames [start, end). */
export function slicePose(buf, start, end) {
  const L = poseLayout(buf)
  const per = L.people * L.P
  const dataStart = L.headerEnd
  const confStart = dataStart + L.frames * per * L.dims * 4
  const header = Buffer.from(buf.subarray(0, L.headerEnd))
  if (L.version === 0.1) header.writeUInt16LE(end - start, L.framesAt)
  else header.writeUInt32LE(end - start, L.framesAt)
  const data = buf.subarray(dataStart + start * per * L.dims * 4, dataStart + end * per * L.dims * 4)
  const conf = buf.subarray(confStart + start * per * 4, confStart + end * per * 4)
  return Buffer.concat([header, data, conf])
}

/**
 * Hand coverage per frame. sign.mt fingerspells words missing from its lexicon with synthetic letter
 * poses: one hand is tracked in every frame and the other in none. Real dictionary clips start and
 * end at rest (no hands in frame), so that pattern only appears for fingerspelling.
 */
export function analysePose(buf, minConf = 0) {
  const p = readPose(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const P = p.totalPoints
  const ranges = {}
  let off = 0
  for (const c of p.components) { ranges[c.name] = [off, off + c.points.length]; off += c.points.length }
  const has = (name, f, thr) => {
    const r = ranges[name]
    if (!r) return false
    for (let i = r[0]; i < r[1]; i++) if (p.confidence[f * p.people * P + i] > thr) return true
    return false
  }
  let lh = 0; let rh = 0; let first = -1; let last = -1
  for (let f = 0; f < p.frames; f++) {
    const l = has('LEFT_HAND_LANDMARKS', f, 0); const r = has('RIGHT_HAND_LANDMARKS', f, 0)
    if (l) lh++
    if (r) rh++
    const strong = has('LEFT_HAND_LANDMARKS', f, minConf) || has('RIGHT_HAND_LANDMARKS', f, minConf)
    if (strong) { if (first < 0) first = f; last = f }
  }
  const F = p.frames
  const fingerspelled = F > 0 && ((rh === F && lh === 0) || (lh === F && rh === 0))
  let active = 0
  if (first >= 0) for (let f = first; f <= last; f++) if (has('LEFT_HAND_LANDMARKS', f, minConf) || has('RIGHT_HAND_LANDMARKS', f, minConf)) active++
  return {
    frames: F, fps: Math.round(p.fps * 100) / 100,
    lh: F ? lh / F : 0, rh: F ? rh / F : 0,
    first, last, fingerspelled,
    handCoverage: first >= 0 ? active / (last - first + 1) : 0,
  }
}

/** Run the app's own converter (web/scripts/pose-to-compact.ts). */
export function convert(inPose, outJson) {
  mkdirSync(dirname(outJson), { recursive: true })
  const r = spawnSync(process.execPath, [CONVERTER, inPose, outJson], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`converter failed: ${(r.stderr || r.stdout).split('\n').slice(0, 3).join(' ')}`)
  const m = /(\d+) frames, (\d+) bytes/.exec(r.stdout)
  return { frames: m ? Number(m[1]) : null, bytes: m ? Number(m[2]) : null }
}

/** Public URL path for a sign file. */
export const publicPath = (lang, dir, slug, ext = 'json') => `/signs/${lang}/${dir}/${slug}.${ext}`
export const diskPath = (url) => join(WEB, 'public', url)
