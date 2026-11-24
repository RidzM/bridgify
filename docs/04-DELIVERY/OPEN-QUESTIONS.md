---
doc: open-questions
status: filled
last_updated: 2026-11-24
confidence: high
---

# Open questions

Ranked by how much each one blocks the build.

| ID | Question | Blocks | Default if no answer |
|---|---|---|---|
| Q-02 | ✅ Answered 24 Nov: RidzM (Riddhi Mehta), public repo `RidzM/bridgify` | — | — |
| Q-03 | ✅ Answered 24 Nov: no always-on server (D-24); Vercel only | — | — |
| Q-01 | Patent: repo and link are public for now (D-25). File the provisional early. Who are the named inventors? (Everyone who contributed an inventive idea must be listed; leaving one out can invalidate a patent.) | P8.7 | Passcode gate ON |
| Q-06 | Date of the next mentor review or demo? | Scope trimming | Build the full plan ASAP |
| Q-08 | ✅ Answered 24 Nov: no recordings; use public multi-signer datasets (held-out signer from public data) | — | — |
| Q-07 | Is the GPL-2 licence on the Kaggle ASL alphabet images acceptable for training? | P1.4 | Use it for pre-training only; our own recordings dominate |
| Q-05 | Will the team update the report text with the v2 changes (PRD §9)? | P8.6 | Provide `REPORT-UPDATES.md` |
| Q-04 | Confirm the visual direction after the first screenshots (P0.4) | P0 sign-off | Proceed with D-20 |
| Q-09 | Can a native Hindi speaker check the Hindi lines on the SOS cards and the Hindi quick phrases? | Trust in SOS | Keep them; the English line is always shown too |
| Q-10 | Can the team run the Bridge on two real phones (college Wi-Fi and mobile data) and note connect time? Only laptop numbers exist (EVAL §9) | Evidence for Bridge | Show the laptop numbers and say so |
| Q-11 | Can someone do a manual screen-reader pass (TalkBack on Android, NVDA on Windows or VoiceOver on iPhone) on Home, Text to speech, Braille, Sign to text and Bridge? Automated axe checks pass, but a person has not listened through yet | NFR-01 sign-off | Report the automated results only |
| Q-12 | Can a Deaf ISL user review the ISL signs (the animations come from sign.mt's model, not a recorded signer)? | Sign-content quality | Keep the disclaimer on every sign page |
| Q-13 | Q-07 is no longer relevant: the Kaggle ASL images were not used (D-27, ASL-HG only) | — | — |
| Q-14 | sign.mt now blocks other websites (D-39). If the team ever wants live sign lookups or commercial use of the stored animations, ask the sign.mt authors for permission first | Live Text to sign for unstored words | Stored words + fingerspelling |

## Contradictions

| Date | A | B | Resolution |
|---|---|---|---|
| 24 Nov | Report figures show a light indigo UI with a blue logo | The Lovable brief asks for deep violet/magenta, Syne + Atkinson | D-20: brand violet as the default Light mode, the report's 12 named modes kept |
| 24 Nov | Report: "custom TensorFlow.js classifier", "Flask Whisper", "face-api.js" | Light-site requirement | D-03, D-04, D-05; wording changes in PRD §9 |
