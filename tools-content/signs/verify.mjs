#!/usr/bin/env node
// Checks the built sign content with the app's own code (tokenize.ts, gloss.ts, poseCompact.ts):
// schema, files on disk, pose integrity, quick-access/tutorial/test-word lookups, credits, budget.
// Usage: node tools-content/signs/verify.mjs   (exit code 1 on any error)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CONTENT, HERE, LANGS, PUBLIC_SIGNS, QA_FOR, WEB, normalise, readJson } from './lib.mjs'
import { tokenize } from '../../web/src/engines/sign/tokenize.ts'
import { islGloss } from '../../web/src/engines/sign/gloss.ts'
import { decodePose } from '../../web/src/engines/sign/poseCompact.ts'

const errors = []
const warn = []
const err = (m) => errors.push(m)
const file = (url) => join(WEB, 'public', url)
const credits = readJson(join(CONTENT, 'credits/signs.json')).items
const creditIds = new Set(credits.map((c) => c.id))
const words = readJson(join(HERE, 'data/words.json'))

/** What the Text to Sign page does before lookup (engines/sign/sequence.ts). */
const plan = (lex, lang, text) => {
  const gloss = lang === 'isl' && /[a-z]/i.test(text) ? islGloss(text) : null
  return tokenize(gloss ? gloss.join(' ') : text, lex.entries)
}

let total = 0
const decoded = new Set()
for (const lang of LANGS) {
  const lex = readJson(join(CONTENT, 'lexicons', `${lang}.json`))
  if (lex.lang !== lang || lex.version !== 1 || typeof lex.spoken !== 'string' || !Array.isArray(lex.entries)) err(`${lang}: bad lexicon header`)
  const glosses = new Set()
  for (const e of lex.entries) {
    if (typeof e.gloss !== 'string' || !Array.isArray(e.words) || !e.words.length) err(`${lang}: bad entry ${JSON.stringify(e).slice(0, 80)}`)
    if (glosses.has(e.gloss)) warn.push(`${lang}: duplicate gloss ${e.gloss}`)
    glosses.add(e.gloss)
    for (const w of e.words) if (w !== normalise(w)) err(`${lang}: word not normalised "${w}"`)
    if (e.pose) {
      if (!existsSync(file(e.pose))) err(`${lang}: missing ${e.pose}`)
      else if (!decoded.has(e.pose)) {
        try { const d = decodePose(JSON.parse(readFileSync(file(e.pose), 'utf8'))); if (!d.pose.frames) err(`${lang}: empty ${e.pose}`) } catch (x) { err(`${lang}: ${e.pose} ${x.message}`) }
        decoded.add(e.pose)
      }
    }
    if (e.video) {
      for (const p of [e.video.src, e.video.poster]) if (!existsSync(file(p))) err(`${lang}: missing ${p}`)
      if (!creditIds.has(e.video.credit)) err(`${lang}: no credit ${e.video.credit}`)
      if (statSync(file(e.video.src)).size > 120 * 1024) err(`${lang}: video over 120 KB ${e.video.src}`)
    }
    if (e.pose && !String(e.source ?? '').startsWith('sign.mt')) err(`${lang}: pose without source ${e.gloss}`)
  }

  // every word concept is in the lexicon
  for (const c of words.concepts) {
    if (c.only && !c.only.includes(lang)) continue
    const first = (lang === 'isl' ? (c.isl ?? c.en) : c[{ asl: 'en', lsf: 'fr', lsm: 'es', lis: 'it', dgs: 'de' }[lang]])?.find((f) => !/^(q|hi):/.test(f))
    if (!first) continue
    if (!lex.entries.some((e) => e.words.includes(normalise(first)))) err(`${lang}: word "${first}" not in lexicon`)
  }
  // every quick-access item resolves to one entry covering the whole line
  const qa = readJson(join(CONTENT, 'phrases', `quick-access.${QA_FOR[lang]}.json`))
  for (const cat of qa.categories) for (const item of cat.items) {
    const text = typeof item === 'string' ? item : item.text
    const toks = tokenize(text, lex.entries)
    if (toks.length !== 1 || !toks[0].entry) err(`${lang}: quick-access "${text}" -> ${toks.map((t) => t.entry?.gloss ?? `?${t.text}`).join(' ')}`)
  }
  // tutorials
  const tut = readJson(join(CONTENT, 'tutorials/phrases', `${lang}.json`))
  if (tut.phrases.length !== 30) err(`${lang}: ${tut.phrases.length} tutorial phrases`)
  for (const p of tut.phrases) {
    const toks = tokenize(p.text, lex.entries)
    if (toks.length !== 1 || !toks[0].entry) err(`${lang}: tutorial "${p.text}" does not resolve`)
    if (p.media && (p.media.type !== 'pose' || !p.media.src.endsWith('.json') || !existsSync(file(p.media.src)))) err(`${lang}: tutorial media bad or missing ${JSON.stringify(p.media)}`)
    if (!p.media && !(toks[0]?.entry?.video)) warn.push(`${lang}: tutorial "${p.text}" has no stored sign (live sign.mt or word by word)`)
  }
  // English input reaches the same entries (ISL through its gloss order)
  if (lang === 'isl') for (const s of ['I need water', 'Good morning', 'Help me', 'thank you']) {
    const toks = plan(lex, lang, s)
    if (toks.some((t) => !t.entry)) warn.push(`isl: English "${s}" -> ${toks.map((t) => t.entry?.gloss ?? `?${t.text}`).join(' ')}`)
  }
}

// report test words, through the page's own lookup
const tests = { asl: 'hello', isl: 'namaste', lsf: 'au revoir', lsm: 'amigo', lis: 'scusa', dgs: 'wasser' }
const testOut = {}
for (const [lang, text] of Object.entries(tests)) {
  const lex = readJson(join(CONTENT, 'lexicons', `${lang}.json`))
  const toks = plan(lex, lang, text)
  const e = toks.length === 1 ? toks[0].entry : null
  testOut[lang] = e ? `${text} -> ${e.gloss} (${[e.video && 'video', e.pose && 'pose'].filter(Boolean).join(' + ') || 'no media'})` : `${text} -> NOT FOUND`
  if (!e || (!e.pose && !e.video)) err(`test word ${lang} "${text}" has no media`)
  if (e) testOut[lang] += e.source && e.source !== 'sign.mt' ? ` [${e.source}]` : ''
}

// files and budget
for (const lang of LANGS) for (const dir of ['words', 'phrases', 'video']) {
  const d = join(PUBLIC_SIGNS, lang, dir)
  if (existsSync(d)) for (const f of readdirSync(d)) total += statSync(join(d, f)).size
}
if (total > 40 * 1024 * 1024) err(`web/public/signs is ${(total / 1048576).toFixed(1)} MB (> 40 MB)`)

console.log('test words:'); for (const v of Object.values(testOut)) console.log('  ' + v)
console.log(`decoded ${decoded.size} pose files; web/public/signs ${(total / 1048576).toFixed(2)} MB`)
for (const w of warn) console.log('warn:', w)
for (const e of errors) console.log('ERROR:', e)
console.log(errors.length ? `${errors.length} errors` : 'ok')
process.exitCode = errors.length ? 1 : 0
