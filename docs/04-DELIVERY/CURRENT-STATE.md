---
doc: current-state
status: filled
last_updated: 2026-11-24
confidence: high
---

# Current state

**As of 24 Nov 2026: Phases 0–4 done and live at https://bridgify-vcet.vercel.app.** `[OBSERVED]`

| Area | State | Real or fake |
|---|---|---|
| Shell, 12 modes, Display settings, home composer | Done (Phase 0, design revision 2) | **Real** |
| Text to speech | Browser voices with word captions (real boundaries or estimated), speed 1–10, English/Hindi quick phrases; gTTS Flask function as fallback | **Real.** gTTS tested locally; check on the live domain after each deploy |
| Speech to text | Browser recogniser + smart punctuation (21 tests), captions view, Brave detection; opt-in on-device Whisper tiny.en (English) | **Real.** Whisper verified end to end with a spoken clip |
| Text ⇄ braille | liblouis 3.39 in WebAssembly (G1, G2, Hindi Bharati), dot grid, .txt/.brf; Perkins keys + tap dots | **Real.** 59 golden cases identical to native liblouis |
| Sign to text | MediaPipe hands + trained ASL (MLP) / ISL (logistic) letter models, smoothing + hold-to-commit, "not sure" chips | **Real.** Held-out macro-F1 ASL 0.962, ISL 0.989; fake-webcam e2e spells "LOV" from an unseen signer. **Not yet measured:** live accuracy with real people (do a 3-person check with the team) |
| Gesture and emotion | Rule gestures (97.3% on unseen users) + wave; expression model 0.744 macro-F1; session log + CSV | **Real.** I-love-you has no public test data (rule only); emotion is labelled approximate |
| Text to sign, tutorials, Bridge, SOS, PWA | Routes show "being built" | **Placeholder** (Phases 5–7) |
| Tests | 213 unit/parity; 44 e2e on desktop + Pixel 7 (axe across 8 routes × 12 modes); slow suites: Whisper, camera | **Real** |
| Speed (headless software GPU, worst case) | Camera pipeline 4 fps / ~250–370 ms per frame in CI-style headless Chromium (no real GPU). On a real device it uses the GPU and should be much faster | **Needs a real-device measurement** |

## Known limits
- J and Z (motion letters) are typed, not recognised.
- The ISL model was trained on one public dataset (6 signers, Chennai/Assam-style ISL). Mumbai variants may differ.
- The expression model is trained on KDEF (non-commercial licence).
