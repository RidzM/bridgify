---
doc: scenarios
status: filled
last_updated: 2026-11-24
confidence: medium
---

# What-if scenarios

| # | What if… | Impact | Plan |
|---|---|---|---|
| S1 | The letter models don't reach 0.90 held-out | The report's claim is weak | More signers and targeted letters; angle features; publish the honest number and the "not sure" UX; ship logistic regression if it's better |
| S2 | The team can't record data in time | No held-out test | Use public data with a public held-out signer (ISL), and recruit 2 friends for 15 min |
| S3 | The voice function is cold or the internet drops during the demo | A short wait, or no server voice | Browser voices are the default; braille, SOS and (after one use) camera tools work offline; open each page once before the demo |
| S4 | sign.mt goes down or blocks us (it has blocked other websites since 24 Nov 2026) | No effect on the live site | The app never calls it at runtime (D-39); stored words and phrases play, other words are fingerspelled |
| S5 | The demo laptop's browser is Brave | STT fails | Auto-detected; Whisper opt-in; recommend Chrome for the demo |
| S6 | Camera permission denied on the projector machine | Camera tools blocked | Recovery steps; a phone as backup |
| S7 | The patent gets disclosed early (public link or repo) | Novelty is lost | The team chose a public repo and link (D-25); file the provisional as early as possible |
| S8 | A licence complaint about sign media | Takedown | Only licence-clean sources (D-10); credits on every card; remove a file in one commit |
| S9 | Vercel Hobby limits are hit | Deploy or site fails | Uploads are kept under the 100 MB CLI limit (MediaPipe runtime is rebuilt on Vercel, caches are excluded); move to Cloudflare Pages (also free) if needed |
| S10 | Large text or a screen reader breaks a layout | Accessibility fails | CI axe + 200% reflow tests on every route |
| S11 | College Wi-Fi blocks phone-to-phone links | Bridge can't connect | Switch one phone to mobile data; or demo with two tabs on one laptop |
| S12 | A browser has no offline voice | SOS Speak is silent offline | The card is shown full screen instead; the page says so |
