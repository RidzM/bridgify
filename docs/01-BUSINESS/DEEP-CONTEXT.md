---
doc: deep-context
status: filled
last_updated: 2026-11-24
confidence: medium
---

# Domain context: the "why" behind design choices

1. **Fingerspelling is not sign language.** Real signing uses handshape, movement, location, face and body grammar. Deaf community statements (WFD/WASLI 2018) and surveys (arXiv 2512.08839, ASSETS'23) object to apps that claim to "translate" sign language, because hearing people then stop providing interpreters. Hence the careful labels and disclaimers (D-07).
2. **Deaf users prefer real signers to avatars.** Motion-capture avatars are rated above synthetic ones, and missing facial grammar is the top complaint. Hence video first (D-09).
3. **ISL is regional and mostly two-handed for the alphabet.** It differs from ASL. Data from one region (e.g. INCLUDE, filmed in Chennai) may not match Mumbai signing. Hence the team review of the lexicon (H4) and practice mode.
4. **Braille users read contracted Grade 2.** Grade 1 is for learners. India uses Bharati braille for Indian scripts (Grade 1 only). liblouis has all of these.
5. **Autistic and dyslexic users need predictability and typography, not decoration.** Motion off, calm palettes, spacing and line length (DESIGN-SYSTEM §4.2). Personalisation that persists across sessions removes repeated setup effort.
6. **Speech recognition differs by browser.** Brave blocks Google's speech service, Firefox gained on-device recognition in Nov 2026, and Safari uses a prefixed API. An accessibility tool cannot silently fail, hence the fallback chains.
7. **Patents in India:** software as such is excluded (S.3(k)). Only a technical effect is patentable. Novelty is absolute: public disclosure before filing destroys it. Prior art already covers "one profile drives all modalities" (US9111545B2). The candidate claim is the Bridge's landmark/gloss relay with receiver-side rendering, backed by measured bandwidth and latency (RESEARCH §1).
