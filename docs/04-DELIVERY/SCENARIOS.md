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
| S3 | The API host sleeps during the demo | A 30–60 s wait | Warm it up 2 min before (open `/api/health`); offline engines keep working |
| S4 | sign.mt API goes down | LIS/LSM words lose animation | Fingerspelling fallback; pre-cache the report's test words and quick-access poses at build time |
| S5 | The demo laptop's browser is Brave | STT fails | Auto-detected; Whisper opt-in; recommend Chrome for the demo |
| S6 | Camera permission denied on the projector machine | Camera tools blocked | Recovery steps; a phone as backup |
| S7 | The patent gets disclosed early (public link or repo) | Novelty is lost | Private repo, passcode gate; never post the link publicly before filing |
| S8 | A licence complaint about sign media | Takedown | Only licence-clean sources (D-10); credits on every card; remove a file in one commit |
| S9 | Vercel Hobby limits are hit | Site down | Static assets are small; move to Cloudflare Pages (also free) |
| S10 | Large text or a screen reader breaks a layout | Accessibility fails | CI axe + 200% reflow tests on every route |
