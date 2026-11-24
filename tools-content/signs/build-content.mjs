#!/usr/bin/env node
// Assembles the sign content from the fetch results:
//   content/lexicons/<lang>.json, content/tutorials/phrases/<lang>.json, content/credits/signs.json,
//   tools-content/signs/report.json. Removes files in web/public/signs/<lang>/{words,phrases,video}
//   that no entry references. Run after fetch-poses.mjs (and fetch-videos.mjs).
// Usage: node tools-content/signs/build-content.mjs [--no-clean]
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CACHE, CONTENT, HERE, LANGS, PUBLIC_SIGNS, SPOKEN, TUTORIAL_SPOKEN, WARN_BYTES, diskPath, normalise, readJson, writeJson } from './lib.mjs'
import { buildTargets, loadData } from './targets.mjs'
import { islGloss } from '../../web/src/engines/sign/gloss.ts'

const BUDGET = 40 * 1024 * 1024
const NO_CLEAN = process.argv.includes('--no-clean')
const data = loadData()
const { targets } = buildTargets(data)
const results = existsSync(join(CACHE, 'results.json')) ? readJson(join(CACHE, 'results.json')) : {}
const videos = existsSync(join(CACHE, 'videos.json')) ? readJson(join(CACHE, 'videos.json')) : {}
const fold = (s) => normalise(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/’/g, "'")
const glossOf = (s) => s.toUpperCase().replace(/[?!.,;:¿¡()]/g, '').trim().replace(/\s+/g, '-')
const size = (url) => (url && existsSync(diskPath(url)) ? statSync(diskPath(url)).size : 0)

/** Function words: may be dropped or fingerspelled inside a phrase without losing its meaning. */
const FUNCTION_WORDS = {
  en: 'a an the is am are was were be been being to of in on at for with from my your his her our their me i you he she it we they this that these those do does did can could will would should have has had some any and or so there here up out',
  fr: "le la les l' un une des de d' du au aux à en et ou je j' tu il elle on nous vous ils elles me m' te t' se s' moi toi mon ma mes ton ta tes son sa ses notre votre ce c' ça cet cette est suis es sommes êtes sont ai as a avons avez ont avoir être y que qu' -moi -vous -il -t -je -toi",
  es: 'el la los las un una unos unas de del al a en y o yo tú tu me te se mi mis su sus lo le les es soy eres estoy está estás están son ser estar que por para con',
  it: "il lo la i gli le l' un uno una un' di del della dei delle dell' a al alla all' da in nel nella con su per e o io tu mi ti si ci me te mio mia miei mie è sono ho ha essere avere che",
  de: 'der die das den dem des ein eine einen einem einer zu zum zur im in an am auf mit von für und oder ich du sie er es wir ihr mich mir dich dir mein meine meinen meiner ist bin sind habe hat haben sein etwas beim sich',
}
const FW = Object.fromEntries(Object.entries(FUNCTION_WORDS).map(([k, v]) => [k, new Set(v.split(' '))]))
const PHRASE_POLICY = 'A phrase animation is kept unless a content word was dropped (ISL has no fingerspelling, so unknown words vanish) or, for LSF, a content word was fingerspelled with sign.mt\'s ASL letters. Function words may be dropped or spelled.'
function phraseVerdict(lang, r) {
  if (!r?.tokens) return { keep: true, fingerspelled: [] }
  const fw = FW[SPOKEN[lang]] ?? new Set()
  const isFn = (t) => fw.has(t.word.toLowerCase().replace(/’/g, "'")) || fw.has(t.word.toLowerCase().replace(/^-/, '')) || fw.has(t.gloss.toLowerCase().replace(/-ix$/, ''))
  // sign.mt keeps punctuation as tokens ("?", ",", "'"); alone they have no sign, which says nothing about the phrase.
  const content = r.tokens.filter((t) => /[\p{L}\p{N}]/u.test(t.word) && !isFn(t))
  const missing = content.filter((t) => t.cls === 'missing').map((t) => t.word)
  const spelled = content.filter((t) => t.cls === 'fingerspelled').map((t) => t.word)
  if (missing.length) return { keep: false, reason: `no sign for: ${missing.join(', ')}`, fingerspelled: spelled }
  if (lang === 'lsf' && spelled.length) return { keep: false, reason: `fingerspelled with ASL letters: ${spelled.join(', ')}`, fingerspelled: spelled }
  return { keep: true, fingerspelled: spelled }
}

/** English words that are a different common word in the target language (French "pain" = bread...). */
const EN_STOP = { lsf: new Set(['pain']), lsm: new Set(['come']), lis: new Set(['come']), dgs: new Set(['bad', 'see']), asl: new Set(), isl: new Set() }
const conceptEn = new Map(data.words.concepts.map((c) => [c.id, (c.en ?? []).filter((f) => !/^(q|hi|eq):/.test(f)).map(normalise)]))

// ---------------------------------------------------------------- 1. entries
const lexicons = {}
const verdicts = new Map()
for (const lang of LANGS) {
  const mine = targets.filter((t) => t.lang === lang)
  const native = new Set(mine.flatMap((t) => t.words))
  const entries = mine.map((t) => {
    const r = results[`${lang}|${t.key}`]
    const vRaw = videos[`${lang}|${t.key}`] ?? null
    const v = vRaw && existsSync(diskPath(vRaw.src)) && existsSync(diskPath(vRaw.poster)) ? vRaw : null
    const verdict = t.kind === 'phrase' && r?.status === 'ok' ? phraseVerdict(lang, r) : { keep: true, fingerspelled: [] }
    verdicts.set(`${lang}|${t.key}`, verdict)
    const pose = r?.status === 'ok' && verdict.keep && existsSync(diskPath(r.file)) ? r.file : null
    const words = [...t.words]
    // English input works for every sign language (the page says "Type in English or ...").
    if (lang !== 'asl' && lang !== 'isl') {
      const en = t.kind === 'word' ? (conceptEn.get(t.concept) ?? []) : [normalise(t.en)]
      for (const w of en) if (w && !native.has(w) && !EN_STOP[lang].has(w)) words.push(w)
    }
    // ISL: the page reorders English into ISL gloss order before lookup, so add that order too.
    if (lang === 'isl') {
      for (const w of [...words]) if (/[a-z]/.test(w)) { const g = normalise(islGloss(w).join(' ')); if (g && !words.includes(g)) words.push(g) }
    }
    return {
      // The gloss names what the user sees first: the video's word, else the entry's own word.
      gloss: glossOf(v && fold(v.word) !== fold(t.display) ? v.word : t.display),
      en: t.en,
      words: [...new Set(words.map(normalise).filter(Boolean))],
      pose,
      video: v ? { src: v.src, poster: v.poster, credit: v.credit } : null,
      source: null,
      _t: t, _r: r,
    }
  })
  // One entry per sign: concepts that resolved to the same media merge (DGS ESSEN = food and eat). Test words keep their own entry.
  const merged = []
  const byMedia = new Map()
  for (const e of entries) {
    const k = e.pose || e.video ? `${e.pose}|${e.video?.src ?? ''}` : null
    const prev = k ? byMedia.get(k) : null
    if (prev && prev._t.kind === e._t.kind && !prev._t.test && !e._t.test) {
      prev.words = [...new Set([...prev.words, ...e.words])]
      if (!prev.en.split(' / ').includes(e.en)) prev.en = `${prev.en} / ${e.en}`
      prev._also = [...(prev._also ?? []), e._t.key]
      continue
    }
    if (k) byMedia.set(k, e)
    merged.push(e)
  }
  // A word belongs to the first entry that lists it (the app's tokenizer does the same).
  const seen = new Set()
  for (const e of merged) e.words = e.words.filter((w) => { if (seen.has(w)) return false; seen.add(w); return true })
  lexicons[lang] = merged
}

// ---------------------------------------------------------------- 2. budget: drop the least important phrase animations first
const refsOf = () => {
  const refs = new Map()
  for (const lang of LANGS) for (const e of lexicons[lang]) for (const u of [e.pose, e.video?.src, e.video?.poster]) if (u) refs.set(u, (refs.get(u) ?? 0) + 1)
  return refs
}
let refs = refsOf()
let planned = [...refs.keys()].reduce((n, u) => n + size(u), 0)
const budgetDropped = []
if (planned > BUDGET) {
  const candidates = LANGS.flatMap((lang) => lexicons[lang].filter((e) => e.pose && e._t.kind === 'phrase' && !e._t.test).map((e) => ({ lang, e })))
    .sort((a, b) => b.e._t.priority - a.e._t.priority || size(b.e.pose) - size(a.e.pose))
  for (const { lang, e } of candidates) {
    if (planned <= BUDGET) break
    const u = e.pose
    e.pose = null
    verdicts.set(`${lang}|${e._t.key}`, { keep: false, reason: 'dropped to stay within the 40 MB budget', fingerspelled: [] })
    budgetDropped.push({ lang, text: e._t.alt ?? e._t.display, kb: Math.round(size(u) / 1024) })
    refs = refsOf()
    if (!refs.has(u)) planned -= size(u)
  }
}
// source: where the animation comes from and, when sign.mt was asked for another word, which one.
for (const lang of LANGS) for (const e of lexicons[lang]) {
  if (!e.pose) { e.source = null; continue }
  const q = e._r.query
  if (q.equivalent) e.source = `sign.mt (closest equivalent: ${q.text}; sign.mt has no sign for "${e._t.display}")`
  else if (e._t.kind === 'word' && fold(q.text) !== fold(e._t.display)) e.source = `sign.mt (signed as: ${q.text}${q.spoken === 'hi' ? ' [hi]' : ''})`
  else e.source = 'sign.mt'
}

// ---------------------------------------------------------------- 3. tutorials
const tutorials = {}
for (const lang of LANGS) {
  tutorials[lang] = (data.tutorials.langs?.[lang] ?? []).map((p) => {
    const e = lexicons[lang].find((x) => x.words.includes(normalise(p.text))) ?? lexicons[lang].find((x) => x.words.includes(normalise(p.en)))
    // The lesson page plays media.src as an animation. Lines with a real signer video keep media null, so the
    // page looks the text up in the lexicon and shows the video instead.
    const media = e?.pose && !e.video ? { type: 'pose', src: e.pose } : null
    return { text: p.text, en: p.en, media }
  })
  writeJson(join(CONTENT, 'tutorials/phrases', `${lang}.json`), { lang, spoken: TUTORIAL_SPOKEN[lang], phrases: tutorials[lang] })
}

// ---------------------------------------------------------------- 4. files: keep only what is referenced
refs = refsOf()
let removed = 0
const sizes = {}
for (const lang of LANGS) {
  sizes[lang] = { words: 0, phrases: 0, video: 0 }
  for (const dir of ['words', 'phrases', 'video']) {
    const d = join(PUBLIC_SIGNS, lang, dir)
    if (!existsSync(d)) continue
    for (const f of readdirSync(d)) {
      const url = `/signs/${lang}/${dir}/${f}`
      if (!refs.has(url)) { if (!NO_CLEAN) rmSync(join(d, f)); removed++; continue }
      sizes[lang][dir] += statSync(join(d, f)).size
    }
  }
}
const total = Object.values(sizes).reduce((n, s) => n + s.words + s.phrases + s.video, 0)

// ---------------------------------------------------------------- 5. lexicons and credits
for (const lang of LANGS) {
  writeJson(join(CONTENT, 'lexicons', `${lang}.json`), {
    lang, version: 1, spoken: SPOKEN[lang],
    ...(lang === 'isl' ? { alsoSpoken: ['hi'] } : {}),
    entries: lexicons[lang].map(({ gloss, en, words, pose, video, source }) => ({ gloss, en, words, pose, video, source })),
  })
}
const creditItems = [{
  id: 'signmt', name: 'sign.mt / spoken-to-signed translation', license: 'CC BY-NC-SA 4.0 (app) — poses generated via the public API',
  url: 'https://sign.mt', usedFor: 'sign animations',
}]
const usedCredits = new Map()
for (const v of Object.values(videos)) if (refs.has(v.src) && !usedCredits.has(v.credit)) usedCredits.set(v.credit, v.creditItem)
for (const c of [...usedCredits.values()].sort((a, b) => a.id.localeCompare(b.id))) {
  creditItems.push({ id: c.id, name: c.name, author: c.author, license: c.license, licenseUrl: c.licenseUrl, url: c.url, ...(c.source ? { source: c.source } : {}), usedFor: c.usedFor, ...(c.nonCommercial ? { nonCommercial: true } : {}) })
}
writeJson(join(CONTENT, 'credits', 'signs.json'), { items: creditItems })

// ---------------------------------------------------------------- 6. report
const report = { generatedAt: new Date().toISOString(), source: 'sign.mt public API (spoken_text_to_signed_pose)', languages: {} }
for (const lang of LANGS) {
  const mine = targets.filter((t) => t.lang === lang)
  const entryOf = (t) => lexicons[lang].find((e) => e._t === t || e._also?.includes(t.key))
  const words = mine.filter((t) => t.kind === 'word')
  const phrases = mine.filter((t) => t.kind === 'phrase')
  const res = (t) => results[`${lang}|${t.key}`]
  const withPose = (t) => Boolean(entryOf(t)?.pose)
  const okP = phrases.filter(withPose)
  const s = sizes[lang]
  report.languages[lang] = {
    signMt: { signed: mine[0]?.candidates[0]?.signed, spoken: SPOKEN[lang] },
    words: {
      total: words.length, withPose: words.filter(withPose).length, withVideo: words.filter((t) => entryOf(t)?.video).length,
      withNoMedia: words.filter((t) => !entryOf(t)?.pose && !entryOf(t)?.video).map((t) => t.display),
      failed: words.filter((t) => !withPose(t)).map((t) => ({ word: t.display, en: t.en, video: Boolean(entryOf(t)?.video), tried: (res(t)?.attempts ?? []).map((a) => `${a.text} [${a.spoken}]: ${a.result}`) })),
      viaOtherWord: words.filter((t) => withPose(t) && fold(res(t).query.text) !== fold(t.display)).map((t) => ({ word: t.display, en: t.en, signedAs: res(t).query.text, closestEquivalent: Boolean(res(t).query.equivalent) })),
    },
    phrases: {
      total: phrases.length, withPose: okP.length, withVideo: phrases.filter((t) => entryOf(t)?.video).length,
      failed: phrases.filter((t) => res(t)?.status !== 'ok').map((t) => ({ text: t.alt ?? t.display, en: t.en, origins: t.origins, tried: (res(t)?.attempts ?? []).map((a) => `${a.text} [${a.spoken}]: ${a.result}${a.message ? ` (${a.message.slice(0, 60)})` : ''}`) })),
      dropped: phrases.filter((t) => res(t)?.status === 'ok' && !withPose(t)).map((t) => ({ text: t.alt ?? t.display, en: t.en, reason: verdicts.get(`${lang}|${t.key}`)?.reason, glosses: res(t).glosses })),
      withFingerspelledWords: okP.filter((t) => verdicts.get(`${lang}|${t.key}`)?.fingerspelled.length).map((t) => ({ text: t.alt ?? t.display, fingerspelled: verdicts.get(`${lang}|${t.key}`).fingerspelled })),
    },
    tutorials: {
      total: tutorials[lang].length, withPose: tutorials[lang].filter((p) => p.media).length,
      withVideoViaLexicon: (data.tutorials.langs?.[lang] ?? []).filter((p) => lexicons[lang].find((x) => x.words.includes(normalise(p.text)))?.video).length,
    },
    lowHandTracking: mine.filter((t) => withPose(t) && res(t).handCoverage < 0.3).map((t) => ({ file: res(t).file, handCoverage: res(t).handCoverage })),
    large: mine.filter((t) => withPose(t) && res(t).bytes > WARN_BYTES).map((t) => ({ file: res(t).file, kb: Math.round(res(t).bytes / 1024) })),
    entries: lexicons[lang].length,
    bytes: { words: s.words, phrases: s.phrases, video: s.video, total: s.words + s.phrases + s.video },
  }
  if (lang === 'isl') {
    report.languages.isl.queries = mine.filter((t) => res(t)).map((t) => ({
      item: t.alt ?? t.display, result: res(t).status === 'ok' ? `${res(t).query.text} [spoken=${res(t).query.spoken}]` : 'none',
      tried: res(t).attempts.map((a) => `${a.text} [${a.spoken}]: ${a.result}`),
    }))
  }
}
report.testWords = Object.fromEntries(Object.entries(data.words.tests).map(([lang, id]) => {
  const e = lexicons[lang].find((x) => x._t.key === `w:${id}` || x._also?.includes(`w:${id}`))
  const r = results[`${lang}|w:${id}`]
  return [lang, { word: e?._t.display ?? id, entry: e?.gloss ?? null, pose: e?.pose ?? null, video: e?.video?.src ?? null, signedAs: r?.query?.text ?? null, source: e?.source ?? null, works: Boolean(e?.pose || e?.video) }]
}))
report.budgetDropped = budgetDropped
report.totals = {
  bytes: total, mb: Math.round((total / 1048576) * 100) / 100, budgetMb: BUDGET / 1048576,
  videoBytes: Object.values(sizes).reduce((n, s) => n + s.video, 0), files: refs.size, removedStale: removed,
}
report.notes = [
  'sign.mt translates word by word. A 200 answer can be synthetic fingerspelling (one hand tracked in every frame, the other in none); those are rejected and left to the app\'s own fingerspelling. ISL answers 500 instead of spelling.',
  'sign.mt only matches base forms through its gloss index, so inflected words ("comprends", "buenos días") are often spelled even when the base word has a sign.',
  'Multi-token word-list items are kept only if every token has its own real sign (ISL silently drops unknown tokens).',
  'Idle frames (no hand in view) at the start and end are trimmed before conversion, keeping ~0.12 s margin.',
  'ISL is queried in English: sign.mt splits Devanagari at vowel signs, so Hindi queries only return single-letter matches or "No poses found".',
  PHRASE_POLICY,
]
writeJson(join(HERE, 'report.json'), report)

const fmt = (b) => `${(b / 1048576).toFixed(2)} MB`
for (const lang of LANGS) {
  const L = report.languages[lang]
  console.log(`${lang}: words ${L.words.withPose}/${L.words.total} pose (${L.words.withVideo} video), phrases ${L.phrases.withPose}/${L.phrases.total} pose (${L.phrases.withVideo} video), tutorials ${L.tutorials.withPose}/${L.tutorials.total} pose + ${L.tutorials.withVideoViaLexicon} video, ${fmt(L.bytes.total)}`)
}
console.log(`total ${fmt(total)} of ${fmt(BUDGET)}; ${budgetDropped.length} phrase animations dropped for budget; removed ${removed} unreferenced files`)
if (total > BUDGET) { console.error('OVER BUDGET'); process.exitCode = 1 }
