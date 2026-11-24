// Builds the list of things to sign, per language: word list, quick-access items, tutorial phrases.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { CONTENT, HERE, LANGS, QA_FOR, SIGNMT, normalise, readJson, slugify } from './lib.mjs'

const DATA = join(HERE, 'data')
const WORD_LANG = { asl: 'en', isl: 'en', lsf: 'fr', lsm: 'es', lis: 'it', dgs: 'de' }

/** Accent-free spellings users often type. Skipped where the bare form is a different common word. */
const NO_STRIP = {
  lsf: new Set(['ou', 'a', 'la', 'du', 'sur', 'pres', 'mere', 'pere']),
  lsm: new Set(['si', 'mas', 'que', 'como', 'el', 'tu', 'mi', 'se', 'te', 'papa', 'mama', 'sed']),
  lis: new Set(['si', 'e', 'papa', 'da', 'la', 'li', 'ne', 'piu']),
  dgs: new Set(),
  asl: new Set(), isl: new Set(),
}
function variants(lang, w) {
  const out = [w]
  if (lang === 'dgs') {
    const t = w.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    if (t !== w) out.push(t)
  }
  const bare = w.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC')
  if (bare !== w && /[a-z]/.test(bare) && !NO_STRIP[lang].has(bare)) out.push(bare)
  if (w.includes("'")) out.push(w.replace(/'/g, '’'))
  if (/[ऀ-ॿ]/.test(w)) {
    const noNukta = w.normalize('NFC').replace(/़/g, '')
    if (noNukta !== w.normalize('NFC')) out.push(noNukta)
  }
  return out
}

const uniq = (a) => [...new Set(a.map(normalise).filter(Boolean))]

export function loadData() {
  const words = readJson(join(DATA, 'words.json'))
  const tutorials = existsSync(join(DATA, 'tutorials.json')) ? readJson(join(DATA, 'tutorials.json')) : { langs: {} }
  const hiMap = existsSync(join(DATA, 'isl-hi.json')) ? readJson(join(DATA, 'isl-hi.json')).map : {}
  const qa = {}
  for (const code of ['en', 'hi', 'fr', 'es', 'it', 'de']) {
    const p = join(CONTENT, 'phrases', `quick-access.${code}.json`)
    if (existsSync(p)) qa[code] = readJson(p)
  }
  return { words, tutorials, hiMap, qa }
}

/** English for a Hindi quick-access/tutorial line (ISL is generated from English). */
function hiToEn(hiMap, text) {
  const k = normalise(text)
  for (const [h, e] of Object.entries(hiMap)) if (normalise(h) === k) return e
  return null
}

/**
 * Returns { targets, links } where targets are things to fetch (word concepts and phrases) and
 * links record which quick-access/tutorial items resolved to an existing word concept.
 */
export function buildTargets(data = loadData()) {
  const { words, tutorials, hiMap, qa } = data
  const targets = []
  const byKey = new Map()
  const add = (t) => { const k = `${t.lang}|${t.key}`; if (!byKey.has(k)) { byKey.set(k, t); targets.push(t) } return byKey.get(k) }
  const testFor = words.tests ?? {}

  // 1. word concepts
  for (const lang of LANGS) {
    const { signed, spoken } = SIGNMT[lang]
    for (const c of words.concepts) {
      if (c.only && !c.only.includes(lang)) continue
      let forms = lang === 'isl' ? (c.isl ?? c.en) : c[WORD_LANG[lang]]
      if (!forms?.length) continue
      // 'hi:' = query with spoken=hi; 'q:' = query-only form (tried on sign.mt, never a lookup word)
      // 'eq:' = query-only closest equivalent (the entry's source says so)
      const candidates = forms.map((f) => f.startsWith('hi:') ? { text: f.slice(3), spoken: 'hi', signed }
        : f.startsWith('eq:') ? { text: f.slice(3), spoken, signed, equivalent: true } : { text: f.replace(/^q:/, ''), spoken, signed })
      if (lang === 'isl' && !forms.some((f) => f.startsWith('hi:')) && c.hi?.length) candidates.push({ text: c.hi[0], spoken: 'hi', signed })
      const seenQ = new Set()
      const deduped = candidates.filter((q) => { const id = `${q.spoken}|${q.text.toLowerCase()}`; if (seenQ.has(id)) return false; seenQ.add(id); return true })
      candidates.splice(0, candidates.length, ...deduped)
      const plain = forms.filter((f) => !/^(hi|q|eq):/.test(f))
      const lexWords = [...plain, ...(lang === 'isl' ? (c.hi ?? []) : []), ...(c.xw?.[lang] ?? [])]
      add({
        lang, key: `w:${c.id}`, kind: 'word', concept: c.id,
        en: (c.en ?? [c.id])[0].replace(/^(hi|q|eq):/, ''),
        display: plain[0],
        words: uniq(lexWords.flatMap((w) => variants(lang, w))),
        candidates, test: testFor[lang] === c.id,
        priority: testFor[lang] === c.id ? 0 : 1,
      })
    }
  }

  // index of word forms -> concept target, per language
  const wordIndex = new Map()
  for (const t of targets) for (const w of t.words) { const k = `${t.lang}|${w}`; if (!wordIndex.has(k)) wordIndex.set(k, t) }
  const findWord = (lang, text) => wordIndex.get(`${lang}|${normalise(text)}`) ?? null

  const links = []
  const phraseTarget = (lang, text, en, origin) => {
    const { signed, spoken } = SIGNMT[lang]
    const hit = findWord(lang, text) ?? (lang === 'isl' && en ? findWord(lang, en) : null)
    if (hit) {
      links.push({ lang, text, en, origin, key: hit.key })
      if (!hit.words.includes(normalise(text))) hit.words.push(...uniq(variants(lang, text)))
      if (lang === 'isl' && en && !hit.words.includes(normalise(en))) hit.words.push(normalise(en))
      return hit
    }
    const isHindi = /[ऀ-ॿ]/.test(text)
    const queryText = lang === 'isl' && isHindi ? en : text
    if (!queryText) throw new Error(`no English for ISL line "${text}" (add it to data/isl-hi.json)`)
    const candidates = [{ text: queryText, spoken, signed }]
    const bare = queryText.replace(/[?!.,;:¿¡]/g, '').replace(/\s+/g, ' ').trim()
    if (bare !== queryText) candidates.push({ text: bare, spoken, signed })
    if (lang === 'isl' && isHindi) candidates.push({ text, spoken: 'hi', signed })
    const key = `p:${normalise(queryText)}`
    const t = add({
      lang, key, kind: 'phrase', en: en ?? text, display: lang === 'isl' && isHindi ? en : text,
      slugSource: queryText, words: [], candidates, priority: origin.priority, origins: [],
    })
    t.origins.push(origin.name)
    t.priority = Math.min(t.priority, origin.priority)
    t.words.push(...uniq(variants(lang, text)))
    if (lang === 'isl') t.words.push(...uniq([queryText]))
    if (!t.alt && lang === 'isl' && isHindi) t.alt = text
    return t
  }

  // 2. quick-access items
  const CAT_PRIORITY = { words: 2, needs: 3, emergency: 3, intro: 4, questions: 4, phrases: 5, sentences: 6 }
  for (const lang of LANGS) {
    const set = qa[QA_FOR[lang]]
    if (!set) continue
    for (const cat of set.categories) {
      for (const item of cat.items) {
        const text = typeof item === 'string' ? item : item.text
        let en = typeof item === 'string' ? null : item.en ?? null
        if (QA_FOR[lang] === 'en') en = text
        if (QA_FOR[lang] === 'hi') en = hiToEn(hiMap, text)
        phraseTarget(lang, text, en, { name: `quick-access.${QA_FOR[lang]}:${cat.id}`, priority: CAT_PRIORITY[cat.id] ?? 5 })
      }
    }
  }

  // 3. tutorial phrases
  for (const lang of LANGS) {
    for (const p of tutorials.langs?.[lang] ?? []) {
      phraseTarget(lang, p.text, p.en, { name: 'tutorial', priority: 4 })
    }
  }

  for (const t of targets) t.words = uniq(t.words)
  for (const t of targets) if (t.kind === 'phrase') t.slug = slugify(t.slugSource) || slugify(t.en)
  return { targets, links }
}
