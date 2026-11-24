#!/usr/bin/env node
// Real signer videos (optional layer on top of the poses):
//   DGS: SignDict GraphQL API (https://signdict.org/graphql-api/graphql), per-video Creative Commons licences.
//   LSF: Wikimedia Commons, Lingua Libre recordings (Category:Lingua_Libre_pronunciation-fsl), CC0.
// Files are copied (never hotlinked), transcoded to WebM VP9 240p <= 120 KB without audio, plus a WebP poster.
// Usage: node tools-content/signs/fetch-videos.mjs [--search-only] [--offline]
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { CACHE, HERE, PUBLIC_SIGNS, normalise, readJson, sleep, slugify, writeJson } from './lib.mjs'
import { buildTargets } from './targets.mjs'

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }))
const UA = 'bridgify-content-build/1.0 (free accessibility web app; batch, one request per second)'
const MAX_VIDEO = 120 * 1024
const BUDGET = 15 * 1024 * 1024
const VCACHE = join(CACHE, 'video')
mkdirSync(VCACHE, { recursive: true })

let last = 0
async function politeFetch(url, init = {}) {
  const wait = last + 1000 - Date.now()
  if (wait > 0) await sleep(wait)
  try { return await fetch(url, { ...init, headers: { 'user-agent': UA, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(30000) }) }
  finally { last = Date.now() }
}
const cachedJson = async (name, fn) => {
  const p = join(VCACHE, name)
  if (existsSync(p)) return readJson(p)
  if (args.offline) return null
  const v = await fn()
  writeJson(p, v)
  return v
}
const fold = (s) => normalise(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/’/g, "'")

// ------------------------------------------------------------------ licences
const SD_LICENCES = {
  'by/4.0': { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/', nc: false },
  'by/3.0/de': { name: 'CC BY 3.0 DE', url: 'https://creativecommons.org/licenses/by/3.0/de/', nc: false },
  'by-sa/4.0': { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/', nc: false },
  'by-sa/3.0/de': { name: 'CC BY-SA 3.0 DE', url: 'https://creativecommons.org/licenses/by-sa/3.0/de/', nc: false },
  'by-nc-sa/4.0': { name: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/', nc: true },
  'by-nc-sa/3.0/de': { name: 'CC BY-NC-SA 3.0 DE', url: 'https://creativecommons.org/licenses/by-nc-sa/3.0/de/', nc: true },
  'by-nc/4.0': { name: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/', nc: true },
  'by-nc/3.0/de': { name: 'CC BY-NC 3.0 DE', url: 'https://creativecommons.org/licenses/by-nc/3.0/de/', nc: true },
}
const licenceRank = (l) => (SD_LICENCES[l] ? (SD_LICENCES[l].nc ? 1 : 0) : 9)

// ------------------------------------------------------------------ SignDict (DGS)
const SD_API = 'https://signdict.org/graphql-api/graphql'
const SD_QUERY = `query($w: String!) { search(word: $w) { id text type description url language { iso6393 }
  currentVideo { id license copyright originalHref videoUrl thumbnailUrl user { name } }
  videos { id license copyright originalHref videoUrl thumbnailUrl user { name } } } }`
async function signDictSearch(word) {
  return cachedJson(`signdict-${slugify(word)}.json`, async () => {
    const res = await politeFetch(SD_API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: SD_QUERY, variables: { w: word } }) })
    if (!res.ok) throw new Error(`SignDict ${res.status}`)
    return (await res.json()).data?.search ?? []
  })
}
/** Sense fixes after reviewing SignDict homonyms (descriptions say which sense a video shows). */
const SD_OVERRIDES = {
  'dgs|w:please': { exclude: /antwort/i }, // "Bitte (Antwort)" = "you're welcome"; we want "Bitte (Wunsch)"
  'dgs|w:help-me': { skip: true }, // only "helfen (ich - dir)" exists, the opposite direction
}
function pickSignDict(entries, form, key) {
  const o = SD_OVERRIDES[key] ?? {}
  if (o.skip) return null
  const exact = (entries ?? []).filter((e) => e.language?.iso6393 === 'gsg' && fold(e.text) === fold(form) && !(o.exclude && o.exclude.test(e.description ?? '')))
  const options = []
  for (const e of exact) {
    const vids = [e.currentVideo, ...(e.videos ?? [])].filter(Boolean)
    for (const v of vids) if (SD_LICENCES[v.license] && v.videoUrl) options.push({ e, v, rank: licenceRank(v.license) * 10 + (v.id === e.currentVideo?.id ? 0 : 1) + (e.description ? 5 : 0) })
  }
  options.sort((a, b) => a.rank - b.rank)
  return options[0] ?? null
}

// ------------------------------------------------------------------ Lingua Libre (LSF)
const LL_PREFIX = 'File:LL-Q33302 (fsl)-'
const LL_SIGNERS = ['Hugo en résidence', 'Taliba31', 'Yug', 'Roy Batty 82']
async function commonsApi(params) {
  const res = await politeFetch('https://commons.wikimedia.org/w/api.php', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, format: 'json' }).toString(),
  })
  if (!res.ok) throw new Error(`Commons ${res.status}`)
  return res.json()
}
async function linguaLibreFiles() {
  return cachedJson('lingualibre-fsl-titles.json', async () => {
    const titles = []
    let cont
    do {
      const d = await commonsApi({ action: 'query', list: 'categorymembers', cmtitle: 'Category:Lingua_Libre_pronunciation-fsl', cmtype: 'file', cmlimit: '500', ...(cont ? { cmcontinue: cont } : {}) })
      titles.push(...d.query.categorymembers.map((m) => m.title))
      cont = d.continue?.cmcontinue
    } while (cont)
    return titles
  })
}
const llSplit = (t) => { const rest = t.slice(LL_PREFIX.length).replace(/\.[a-z0-9]+$/i, ''); const i = rest.indexOf('-'); return { signer: rest.slice(0, i), word: rest.slice(i + 1) } }
async function linguaLibreInfo(titles) {
  return cachedJson(`lingualibre-vinfo-${slugify(titles.join(' ')).slice(0, 40)}-${titles.length}.json`, async () => {
    const out = {}
    for (let i = 0; i < titles.length; i += 40) {
      const d = await commonsApi({ action: 'query', prop: 'videoinfo', viprop: 'url|size|mime|extmetadata|derivatives', titles: titles.slice(i, i + 40).join('|') })
      for (const p of Object.values(d.query.pages)) {
        const ii = p.videoinfo?.[0]
        if (!ii) continue
        const em = ii.extmetadata ?? {}
        const g = (k) => em[k]?.value ?? null
        // Wikimedia asks bulk clients to use the published derivatives, not originals: take the 240p VP9 one.
        const der = (ii.derivatives ?? []).find((x) => x.transcodekey === '240p.vp9.webm') ?? (ii.derivatives ?? []).find((x) => /webm/.test(x.type ?? ''))
        out[p.title] = { url: der?.src ?? ii.url, original: ii.url, page: ii.descriptionurl, size: ii.size, licence: g('LicenseShortName'), licenceUrl: g('LicenseUrl'), artist: (g('Artist') ?? '').replace(/<[^>]+>/g, '').trim() }
      }
    }
    return out
  })
}

// ------------------------------------------------------------------ transcoding
function ffprobeDuration(p) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], { encoding: 'utf8' })
  return Number(r.stdout.trim()) || 3
}
function transcode(src, outWebm, outWebp) {
  const dur = ffprobeDuration(src)
  const vf = 'scale=-2:240:flags=lanczos,fps=25,format=yuv420p'
  const base = ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-an', '-sn', '-dn', '-map_metadata', '-1', '-vf', vf, '-c:v', 'libvpx-vp9', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2']
  let size = Infinity
  for (const crf of [36, 40, 44, 48]) {
    const r = spawnSync('ffmpeg', [...base, '-crf', String(crf), '-b:v', '0', outWebm], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr.slice(0, 200)}`)
    size = statSync(outWebm).size
    if (size <= MAX_VIDEO) break
  }
  if (size > MAX_VIDEO) {
    const kbps = Math.max(60, Math.floor((MAX_VIDEO * 8 * 0.9) / dur / 1000))
    spawnSync('ffmpeg', [...base, '-b:v', `${kbps}k`, '-maxrate', `${kbps}k`, '-bufsize', `${kbps * 2}k`, outWebm], { encoding: 'utf8' })
    size = statSync(outWebm).size
  }
  const at = (dur * 0.45).toFixed(2)
  const r2 = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', at, '-i', src, '-frames:v', '1', '-vf', 'scale=-2:240:flags=lanczos', '-c:v', 'libwebp', '-quality', '70', outWebp], { encoding: 'utf8' })
  if (r2.status !== 0) throw new Error(`poster: ${r2.stderr.slice(0, 200)}`)
  return { bytes: size, posterBytes: statSync(outWebp).size, duration: Math.round(dur * 100) / 100 }
}
const blockedUntil = new Map()
async function download(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 1000) return
  if (args.offline) throw new Error('not cached')
  const host = new URL(url).host
  if ((blockedUntil.get(host) ?? 0) > Date.now()) throw new Error(`${host} asked us to wait (429); re-run later`)
  if (host === 'upload.wikimedia.org') {
    // The media server throttles bulk clients hard; plain curl, one file every ~20 s, stop at the first 429.
    await sleep(19000)
    const r = spawnSync('curl', ['-sS', '-L', '-A', UA, '-o', dest, '-w', '%{http_code}', url], { encoding: 'utf8' })
    last = Date.now()
    const code = Number(r.stdout.trim())
    if (code === 429) { rmSync(dest, { force: true }); blockedUntil.set(host, Date.now() + 600000); throw new Error('download 429 (Wikimedia rate limit)') }
    if (code !== 200) { rmSync(dest, { force: true }); throw new Error(`download ${code || r.stderr.trim()}`) }
    return
  }
  const res = await politeFetch(url)
  if (res.status === 429) {
    blockedUntil.set(host, Date.now() + 1000 * Number(res.headers.get('retry-after') ?? 600))
    throw new Error(`download 429 (retry after ${res.headers.get('retry-after') ?? '?'} s)`)
  }
  if (!res.ok) throw new Error(`download ${res.status}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

// ------------------------------------------------------------------ main
const { targets } = buildTargets()
const manifest = {}
const plan = []

// DGS via SignDict: word concepts (candidate forms in order) and quick-access/tutorial lines.
for (const t of targets.filter((x) => x.lang === 'dgs')) {
  const forms = t.kind === 'word' ? t.candidates.map((c) => c.text) : [t.display.replace(/[?!.,]/g, '').trim()]
  for (const form of forms) {
    let entries
    try { entries = await signDictSearch(form) } catch (e) { console.log(`signdict "${form}": ${e.message}`); continue }
    if (!entries) continue
    const pick = pickSignDict(entries, form, `dgs|${t.key}`)
    if (!pick) continue
    const lic = SD_LICENCES[pick.v.license]
    plan.push({
      key: `dgs|${t.key}`, lang: 'dgs', word: pick.e.text, slug: slugify(pick.e.text), url: pick.v.videoUrl, ext: 'mp4',
      credit: {
        id: `signdict-${pick.v.id}`, name: `SignDict: ${pick.e.text} (DGS sign video)`,
        author: [pick.v.copyright, pick.v.user?.name ? `uploaded by ${pick.v.user.name}` : null].filter(Boolean).join(', '),
        license: lic.name, licenseUrl: lic.url, nonCommercial: lic.nc,
        url: pick.e.url, source: pick.v.originalHref || null, usedFor: `DGS sign video: ${pick.e.text}`,
      },
      note: pick.e.description || null,
    })
    break
  }
}

// LSF via Lingua Libre: explicit word -> entry mapping (data/lsf-lingualibre.json).
const llMap = existsSync(join(HERE, 'data/lsf-lingualibre.json')) ? readJson(join(HERE, 'data/lsf-lingualibre.json')).map : {}
const llTitles = Object.keys(llMap).length ? await linguaLibreFiles() : []
const byWord = new Map()
for (const t of llTitles ?? []) {
  if (!t.startsWith(LL_PREFIX)) continue
  const { signer, word } = llSplit(t)
  const k = fold(word)
  const list = byWord.get(k) ?? []
  list.push({ title: t, signer, word })
  byWord.set(k, list)
}
const llWanted = []
for (const [key, word] of Object.entries(llMap)) {
  const options = (byWord.get(fold(word)) ?? []).sort((a, b) => (LL_SIGNERS.indexOf(a.signer) + 99) % 99 - (LL_SIGNERS.indexOf(b.signer) + 99) % 99)
  if (options[0]) llWanted.push({ key, ...options[0] })
  else console.log(`lingua libre: no file for "${word}"`)
}
const llInfo = llWanted.length ? await linguaLibreInfo(llWanted.map((w) => w.title)) : {}
for (const w of llWanted) {
  const info = llInfo?.[w.title]
  if (!info) continue
  if (!/^(CC0|CC BY(-SA)? [0-9.]+|Public domain)/i.test(info.licence ?? '')) { console.log(`skip ${w.title}: licence ${info.licence}`); continue }
  const clean = w.word.replace(/\s*\(.*\)\s*$/, '')
  plan.push({
    key: `lsf|${w.key}`, lang: 'lsf', word: clean, slug: slugify(clean), url: info.url, ext: 'webm',
    credit: {
      id: `lingualibre-${slugify(clean)}`, name: `Lingua Libre: ${clean} (LSF sign video)`,
      author: w.signer, license: info.licence === 'CC0' ? 'CC0 1.0' : info.licence, licenseUrl: info.licenceUrl, nonCommercial: false,
      url: info.page, source: info.original ?? info.url, usedFor: `LSF sign video: ${clean}`,
    },
  })
}

console.log(`${plan.length} videos planned (${plan.filter((p) => p.lang === 'dgs').length} DGS, ${plan.filter((p) => p.lang === 'lsf').length} LSF)`)
if (args['search-only']) { for (const p of plan) console.log(p.key, '->', p.word, p.credit.license, p.note ? `[${p.note}]` : ''); process.exit(0) }

let total = 0
const done = new Map()
// Which source produced each output file, so a changed choice (e.g. another SignDict video) is re-encoded.
const OUTPUTS = join(VCACHE, 'outputs.json')
const outputs = existsSync(OUTPUTS) ? readJson(OUTPUTS) : {}
for (const p of plan) {
  const outDir = join(PUBLIC_SIGNS, p.lang, 'video')
  mkdirSync(outDir, { recursive: true })
  const webm = join(outDir, `${p.slug}.webm`)
  const webp = join(outDir, `${p.slug}.webp`)
  const src = join(VCACHE, 'src', p.lang, `${p.slug}-${p.credit.id}.${p.ext}`)
  mkdirSync(join(VCACHE, 'src', p.lang), { recursive: true })
  const fileKey = `${p.lang}/${p.slug}`
  try {
    if (!done.has(fileKey)) {
      await download(p.url, src)
      if (args.force || !existsSync(webm) || !existsSync(webp) || outputs[fileKey] !== p.credit.id) transcode(src, webm, webp)
      outputs[fileKey] = p.credit.id
      const bytes = statSync(webm).size + statSync(webp).size
      if (total + bytes > BUDGET) { rmSync(webm); rmSync(webp); console.log(`budget: skip ${p.key}`); continue }
      total += bytes
      done.set(fileKey, { bytes: statSync(webm).size, posterBytes: statSync(webp).size, duration: Math.round(ffprobeDuration(webm) * 100) / 100 })
    }
    const r = done.get(fileKey)
    manifest[p.key] = { src: `/signs/${p.lang}/video/${p.slug}.webm`, poster: `/signs/${p.lang}/video/${p.slug}.webp`, credit: p.credit.id, creditItem: p.credit, word: p.word, ...r }
    console.log(`${p.key} -> ${p.slug}.webm ${(r.bytes / 1024).toFixed(0)}KB + poster ${(r.posterBytes / 1024).toFixed(0)}KB ${r.duration}s (${p.credit.license})`)
  } catch (e) { console.log(`${p.key}: ${e.message}`) }
}
writeJson(join(CACHE, 'videos.json'), manifest)
writeJson(OUTPUTS, outputs)
console.log(`video total ${(total / 1024 / 1024).toFixed(2)} MB of ${BUDGET / 1024 / 1024} MB`)
