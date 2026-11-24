#!/usr/bin/env node
// Fetches sign poses from sign.mt for every target, trims idle frames, converts with the app's own
// converter and writes web/public/signs/<lang>/{words,phrases}/<slug>.json.
// Usage: node tools-content/signs/fetch-poses.mjs [--lang=asl,lsf] [--max-priority=6] [--offline] [--dry]
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CACHE, DROP_BYTES, WARN_BYTES, analysePose, convert, diskPath, fetchSignMt, publicPath, readJson,
  slicePose, slugify, stats, writeJson,
} from './lib.mjs'
import { buildTargets } from './targets.mjs'

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }))
const langs = args.lang ? String(args.lang).split(',') : null
const maxPriority = args['max-priority'] !== undefined ? Number(args['max-priority']) : 99
const offline = Boolean(args.offline)

let minConf = 0
try { minConf = (await import('../../web/src/engines/sign/poseCompact.ts')).MIN_CONFIDENCE ?? 0 } catch { /* older converter */ }

const RESULTS = join(CACHE, 'results.json')
const results = existsSync(RESULTS) ? readJson(RESULTS) : {}
const save = () => writeJson(RESULTS, results)
const log = (...a) => console.log(...a)

const { targets } = buildTargets()
const todo = targets
  .filter((t) => (!langs || langs.includes(t.lang)) && t.priority <= maxPriority)
  .sort((a, b) => a.priority - b.priority)
log(`${todo.length} targets (of ${targets.length}); converter min confidence ${minConf}`)
if (args.dry) { for (const t of todo) log(t.priority, t.lang, t.key, '->', t.candidates.map((c) => `${c.text}[${c.spoken}]`).join(' | ')); process.exit(0) }

/** --offline rebuilds from cached answers only (no network). */
const get = (q) => fetchSignMt(q, { log, offline })

const analyseFile = (p) => analysePose(readFileSync(p), minConf)

/**
 * What sign.mt does with each token of a multi-token text, found by asking for the token alone:
 * 'sign' (real dictionary sign), 'fingerspelled' (synthetic letters) or 'missing' (dropped: no sign).
 */
async function classifyTokens(glosses, cand) {
  const out = []
  for (const g of glosses ?? []) {
    const rr = await get({ text: g.word, spoken: cand.spoken, signed: cand.signed })
    let cls = 'missing'
    if (rr.status === 200) { try { const x = analyseFile(rr.posePath); cls = x.fingerspelled ? 'fingerspelled' : x.first < 0 ? 'missing' : 'sign' } catch { cls = 'missing' } }
    else if (rr.status !== 500 && rr.status !== 400 && rr.status !== 404) cls = 'unknown'
    out.push({ word: g.word, gloss: g.gloss, cls })
  }
  return out
}

let i = 0
const t0 = Date.now()
for (const t of todo) {
  i++
  const attempts = []
  let ok = null
  const dir = t.kind === 'word' ? 'words' : 'phrases'
  for (const cand of t.candidates) {
    const r = await get(cand)
    const att = { text: cand.text, spoken: cand.spoken, status: r.status, glosses: r.glosses?.map((g) => `${g.word}/${g.gloss}`).join(' ') ?? null }
    attempts.push(att)
    if (r.status !== 200) { att.result = r.noSign ? 'no-sign' : 'error'; att.message = r.message; continue }
    const buf = readFileSync(r.posePath)
    let a
    try { a = analysePose(buf, minConf) } catch (e) { att.result = 'unreadable'; att.message = e.message; continue }
    Object.assign(att, { frames: a.frames, fps: a.fps })
    let tokens = null
    if (a.fingerspelled) {
      // A phrase of one-handed real signs could look the same as spelling: ask for each token to be sure.
      if ((r.glosses?.length ?? 0) > 1) tokens = await classifyTokens(r.glosses, cand)
      if (!tokens?.some((x) => x.cls === 'sign')) { att.result = 'fingerspelled'; continue }
    }
    if (a.first < 0) { att.result = 'no-hands'; continue }
    // sign.mt's tokenizer splits Devanagari at vowel signs ("रुकिए" -> र क ए); single-letter matches are not the word.
    if (/[ऀ-ॿ]/.test(cand.text)) {
      const inputWords = new Set(cand.text.replace(/[?!.,।]/g, ' ').split(/\s+/).filter(Boolean))
      if (!r.glosses?.length || r.glosses.some((g) => !inputWords.has(g.word))) { att.result = 'mis-tokenized'; continue }
    }
    // Word-list items made of several tokens: every token needs its own real sign. Otherwise a token
    // was fingerspelled (most languages) or silently dropped (ISL has no fingerspelling), e.g. "good bye" -> GOOD.
    if ((r.glosses?.length ?? 0) > 1) {
      tokens ??= await classifyTokens(r.glosses, cand)
      if (t.kind === 'word') {
        const spelled = tokens.filter((x) => x.cls === 'fingerspelled').map((x) => x.word)
        const missing = tokens.filter((x) => x.cls === 'missing' || x.cls === 'unknown').map((x) => x.word)
        if (spelled.length || missing.length) { att.result = spelled.length ? 'partly-fingerspelled' : 'partly-missing'; att.spelled = spelled; att.missing = missing; continue }
      }
    }
    const margin = Math.max(2, Math.round(a.fps * 0.12))
    const start = Math.max(0, a.first - margin)
    const end = Math.min(a.frames, a.last + 1 + margin)
    const trimmed = slicePose(buf, start, end)
    const slug = t.kind === 'word' ? (slugify(cand.text) || slugify(t.display) || t.concept) : t.slug
    const tp = join(CACHE, 'trimmed', cand.signed, dir, `${slug}.pose`)
    mkdirSync(join(CACHE, 'trimmed', cand.signed, dir), { recursive: true })
    writeFileSync(tp, trimmed)
    const url = publicPath(t.lang, dir, slug)
    let conv
    try { conv = convert(tp, diskPath(url)) } catch (e) { att.result = 'convert-failed'; att.message = e.message; continue }
    const bytes = statSync(diskPath(url)).size
    if (bytes > DROP_BYTES) { rmSync(diskPath(url)); att.result = 'too-large'; att.bytes = bytes; continue }
    att.result = 'ok'
    ok = {
      status: 'ok', file: url, bytes, frames: conv.frames, fps: Math.round((a.fps / 2) * 100) / 100,
      sourceFrames: a.frames, trimmedFrames: end - start, handCoverage: Math.round(a.handCoverage * 100) / 100,
      query: { text: cand.text, spoken: cand.spoken, signed: cand.signed, ...(cand.equivalent ? { equivalent: true } : {}) }, glosses: att.glosses, large: bytes > WARN_BYTES,
      ...(tokens ? { tokens } : {}),
    }
    break
  }
  results[`${t.lang}|${t.key}`] = { ...(ok ?? { status: 'none' }), kind: t.kind, attempts, updatedAt: new Date().toISOString() }
  const tail = ok ? `ok ${ok.file} ${(ok.bytes / 1024).toFixed(0)}KB${ok.large ? ' LARGE' : ''} via "${ok.query.text}"` : `none (${attempts.map((x) => `${x.text}:${x.result}`).join(', ')})`
  log(`[${i}/${todo.length}] ${t.lang} ${t.key} -> ${tail}`)
  if (i % 5 === 0) save()
}
save()
log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min, ${stats().requests} network requests`)
