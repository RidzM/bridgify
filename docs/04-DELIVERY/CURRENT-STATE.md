---
doc: current-state
status: filled
last_updated: 2026-11-24
confidence: high
---

# Current state

**As of 24 Nov 2026 (night): all phases 0–8 are built and live at https://bridgify-vcet.vercel.app.** `[OBSERVED]`

| Area | State | Real or fake |
|---|---|---|
| Shell, 12 modes, Display settings, home composer | Done (design revision 2). Fonts are preloaded, so there is no layout shift | **Real** |
| Text to speech | Browser voices with word captions, speed, English/Hindi quick phrases; gTTS function fallback (rate-limited 20/min per IP per instance) | **Real** |
| Speech to text | Browser recogniser + smart punctuation, captions view; opt-in on-device Whisper tiny.en | **Real.** Browser recognition in Chrome/Edge/Safari uses the browser's service (the privacy page says so) |
| Text ⇄ braille | liblouis 3.39 WebAssembly (G1, G2, Hindi Bharati), .txt/.brf; Perkins keys + tap dots | **Real.** 59/59 golden cases match native liblouis |
| Sign to text | ASL (MLP) and ISL (logistic) letter models, hold-to-commit, top-3 guesses, alphabet reference | **Real.** Held-out macro-F1 ASL 0.962, ISL 0.989. ISL has no H, J or Y; ASL J and Z are typed. **Not measured:** live accuracy with real people (do a 3-person check) |
| Gesture and emotion | 8 gestures (rules, 97.3% on unseen people for the 6 HaGRID types), expression model 0.744 macro-F1, log + CSV | **Real.** I-love-you and wave have no public test set; expression is labelled approximate |
| Text to sign | Six languages. Stored animations for everyday words and phrases (prepared from sign.mt), 73 DGS and 14 LSF signer videos, then fingerspelling (the page names the spelled words); ISL word order. No live sign.mt requests (D-39) | **Real.** Animations come from sign.mt's model, not a recorded signer (Q-12); the page says it is a word-by-word lookup |
| Learn | Braille alphabet, numbers, Grade 2 and a quiz. Sign alphabets for ISL/ASL/FSL/DGS, numbers for ISL/ASL, 30 phrases × 6 languages, 22 Indian scripts for ISL letters, camera practice for ISL/ASL | **Real.** LSM and LIS alphabets have no licence-clean pictures, and the page says so |
| Bridge | Two phones over WebRTC (PeerJS broker) or two tabs (BroadcastChannel); four send and four receive modes; hands stream | **Real.** Measured on one laptop only (EVAL §9); **not measured on two real phones** (Q-10). Gloss packets are received but no send mode emits them yet. No braille display support |
| SOS | Preset cards with a Hindi line, Speak, full screen, signs, contact call, location share; offline | **Real.** Hindi lines need a native check (Q-09) |
| Offline / install | PWA with an update prompt; SOS, TTS, braille and (after one use) camera tools work offline | **Real** (e2e: TTS and SOS offline) |
| About pages | About, Privacy, Evidence (numbers + confusion charts), Credits (grouped, 90+ entries) | **Real** |
| Security | Strict CSP; pnpm/pip audits clean; gitleaks clean (1 false positive); Trail of Bits insecure-defaults (0 findings) and supply-chain (0 advisories) audits | **Real** |
| Tests | Unit 267 + parity; e2e on desktop and Pixel 7 (axe across 16 routes × 12 modes); slow camera and Whisper suites | **Real** |

## Known limits
- J and Z (ASL) and H, J and Y (ISL) are typed, not recognised from the camera.
- The ISL model was trained on one public dataset (Chennai/Assam-style ISL). Mumbai variants may differ.
- The expression model is trained on KDEF (non-commercial licence).
- Sign animations are machine-generated (sign.mt). A Deaf signer should review the ISL content before any public launch (Q-12).
- DGS videos from gebaerdenlernen.de are CC BY-NC-SA (non-commercial), which is fine for this student project and is credited per video.
- Headless test machines run the camera pipeline at 2–4 fps (software GPU). On real devices it uses the GPU.
