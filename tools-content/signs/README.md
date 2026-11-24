# Sign content build (words, phrases, signer videos)

Builds the sign-language word and phrase content for Text to Sign and the Learn pages, for
ASL, ISL, FSL (LSF), LSM, LIS and DGS. Everything here runs on a laptop with Node ≥ 22.18 and
ffmpeg (with libvpx-vp9 and libwebp). No keys, no logins.

## What it produces

| Output | What it is |
|---|---|
| `web/public/signs/<lang>/words/<slug>.json` | Sign animation for one word (compact pose, `bridgify-pose` v1) |
| `web/public/signs/<lang>/phrases/<slug>.json` | Sign animation for a quick-access or tutorial phrase |
| `web/public/signs/<lang>/video/<slug>.webm` + `.webp` | Real signer clip (DGS, LSF only), VP9 240p ≤ 120 KB, no audio, plus a poster frame |
| `content/lexicons/<lang>.json` | Word and phrase lookup: spoken forms → animation and/or video |
| `content/tutorials/phrases/<lang>.json` | 30 everyday phrases per language for the Learn page |
| `content/phrases/quick-access.{fr,es,it,de}.json` | Quick phrases for Text to Sign, `{text, en}` items |
| `content/credits/signs.json` | Credits: sign.mt plus one entry per video (author, licence, source) |
| `tools-content/signs/report.json` | Per language: words and phrases with/without a sign, sizes, what failed and why |

Slugs: lowercase ASCII, words joined by `-`; `ä→ae ö→oe ü→ue ß→ss`, other accents dropped
(`é→e`, `ñ→n`), apostrophes removed (`d'accord` → `daccord`).

## Regenerate

```bash
cd ~/bridgify
node tools-content/signs/fetch-poses.mjs      # sign.mt → trimmed .pose → app converter → JSON (slow, polite)
node tools-content/signs/fetch-videos.mjs     # SignDict (DGS) + Lingua Libre (LSF) clips → WebM + WebP
node tools-content/signs/build-content.mjs    # lexicons, tutorials, credits, report; deletes unreferenced files
node tools-content/signs/verify.mjs           # checks everything with the app's own tokenizer and pose decoder
```

Useful flags for `fetch-poses.mjs`:

- `--dry` lists every target and the forms it will try, without any request.
- `--offline` rebuilds from the cache only (no network).
- `--lang=lsf,dgs` limits to some languages; `--max-priority=1` limits to the word list
  (0 = report test words, 1 = word list, 2–6 = quick-access categories and tutorials).

`fetch-videos.mjs --search-only` prints which SignDict entry each DGS word would use.

Raw answers are cached in `tools-content/signs/.cache/` (git-ignored), so a re-run only asks
for what is missing. Delete a file in `.cache/raw/` to ask again.

## Inputs you edit

| File | Meaning |
|---|---|
| `data/words.json` | The word list. Per language, candidate spoken forms in order; the first one sign.mt answers with a real sign wins, and every form maps to that sign. Prefixes: `q:` = ask sign.mt but never use as a lookup word (e.g. unaccented `si`); `eq:` = same, and the result is a closest equivalent (recorded in the entry's `source`); `hi:` = ask with `spoken=hi`. `hi` = Hindi forms for ISL lookup. `xw` = extra lookup words. `only` = language-specific entries (ISL NAMASTE, LSF PARDON and ENCORE). |
| `data/isl-hi.json` | English for each line of `quick-access.hi.json` (ISL is signed from English). |
| `data/tutorials.json` | The 30 tutorial phrases per language (`text` in the spoken language, `en`). |
| `data/lsf-lingualibre.json` | Which Lingua Libre LSF recording goes with which lexicon entry. |
| `content/phrases/quick-access.*.json` | Quick-access lines; each one gets an entry and, where possible, an animation. |

## Sources and licences

- **sign.mt** public API, `GET https://us-central1-sign-mt.cloudfunctions.net/spoken_text_to_signed_pose?text=…&spoken=…&signed=…`
  (codes: ase/en, ins/en, fsl/fr, mfs/es, ise/it, gsg/de). Free, no key, CORS `*`. App code CC BY-NC-SA 4.0;
  we only call the API and credit it (`signmt` in `content/credits/signs.json`). One request at a time,
  ≥ 1 s apart, 30 s timeout, 2 retries.
- **SignDict** GraphQL API, `POST https://signdict.org/graphql-api/graphql` (the `/graphql` path from older
  notes returns 404). Each video has its own Creative Commons licence; we prefer BY / BY-SA and fall back to
  BY-NC-SA (flagged `nonCommercial: true` in the credits). Files are copied, never hotlinked.
- **Lingua Libre** recordings on Wikimedia Commons, `Category:Lingua_Libre_pronunciation-fsl` (all CC0).
  Only ~95 LSF words exist (a library-themed set), so LSF videos cover greetings, question words and a few more.
  `upload.wikimedia.org` throttles bulk clients hard (HTTP 429, `Retry-After` up to 10 min): the script takes the
  published 240p derivative (not the original), downloads with plain curl one file every ~20 s and stops at the
  first 429. If that happens, re-run later; everything already fetched is cached.
- Never used: Lifeprint, Handspeak, Spread The Sign, Sématos, DGS-Korpus, YouTube.

## How sign.mt answers are checked

sign.mt translates word by word from its own dictionary. Things this build guards against:

1. **Synthetic fingerspelling.** For words missing from its dictionary sign.mt returns `200` with a
   letter-by-letter animation (ISL excepted: it answers `500 No poses found`). Those animations have one hand
   tracked in every frame and the other in none, which real dictionary clips never do (they start and end at
   rest). They are rejected, so the app's own fingerspelling (right alphabet, labelled as fingerspelling) is used.
   The LSF and ASL fallbacks are byte-identical, i.e. LSF words would be spelled with ASL letters.
2. **Hidden partial matches** in multi-word word-list items (`good bye` in ISL came back as just GOOD, because ISL
   drops unknown tokens). Each token of a multi-word candidate must have its own real sign.
3. **Hindi.** sign.mt splits Devanagari at vowel signs (`नमस्ते` → `नमस`, `त`), so Hindi queries never find the
   word; single-letter matches are rejected. ISL is generated from English and the Hindi text is added as a
   lookup word.
4. **Idle frames.** Dictionary clips start and end with the hands down. Frames before the first and after the
   last visible hand are cut (keeping ~0.12 s), which roughly halves file size and makes word sequences flow.
   Trimming is done on the `.pose` before the app's converter (`web/scripts/pose-to-compact.ts`) runs.
5. **Size.** Converted files over 120 KB are kept and listed in `report.json` (`large`); over 300 KB are dropped.

The `x-glosses` response header (sign.mt's gloss sequence for the text) is stored with each answer in the
cache and in `report.json`, which shows what sign.mt actually signed.

## Lexicon fields

`{gloss, en, words, pose, video, source}`. `gloss` is the entry's own word (or the video's word when a video
is attached); `en` is the English meaning; `words` are normalised exactly like the app's tokenizer does
(lowercase, NFC, punctuation removed) and include accent-free spellings, English (non-English languages, minus
false friends such as French *pain*), Hindi (ISL) and the ISL gloss order produced by
`web/src/engines/sign/gloss.ts` (e.g. `i water need`). `source` is `sign.mt`, or
`sign.mt (signed as: …)` / `sign.mt (closest equivalent: …)` when sign.mt was asked for another word
(ISL NAMASTE uses HELLO: sign.mt has no NAMASTE). `pose: null, video: null` means nothing licence-clean was
found; the app should split such a phrase into its words (or fingerspell a single word).

## Phrases

sign.mt signs a phrase word by word. Each word of a phrase is also asked for on its own to see whether it is a
real sign, fingerspelled or dropped. A phrase animation is kept unless a content word was dropped (ISL has no
fingerspelling, so unknown words simply vanish: "Call an ambulance" would show only CALL) or, for LSF, a content
word was fingerspelled with sign.mt's ASL letters. Function words (articles, auxiliaries, pronouns) may be
dropped or spelled. `report.json` lists every dropped phrase with the reason.

## Budget

`web/public/signs/` must stay ≤ 40 MB (videos ≤ 15 MB of that). `build-content.mjs` prints the total and exits
non-zero when over budget.
