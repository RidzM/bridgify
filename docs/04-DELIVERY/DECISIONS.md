---
doc: decisions
status: filled
last_updated: 2026-11-24
confidence: high
---

# Decisions

All decisions were made on 24 Nov 2026. Reverse one only by adding a new entry that says why.

| ID | Decision | Why | Alternatives rejected |
|---|---|---|---|
| D-01 | No database, no accounts, no analytics | The report promises "no account". Every tool works client-side; rooms are ephemeral | Supabase/Postgres (nothing to store), auth (adds friction for disabled users) |
| D-02 | Two deployables (React SPA + Flask API) and an `ml/` workspace. No Rust, no microservices | Hot paths are already native (MediaPipe WASM, liblouis C). The glue language doesn't decide speed | Rust/WASM glue, Go API, per-tool services |
| D-03 | Letter classifiers run as a hand-written JS MLP (~60 lines), not TF.js or ONNX Runtime | Keeps the site light: about 100 KB of weights vs 2–10 MB of runtime. TF.js has had no stable release since Oct 2024 | TF.js (report wording), onnxruntime-web |
| D-04 | Whisper fallback runs in the browser and downloads only on opt-in (~40 MB). No server Whisper | Free hosts have 512 MB RAM; it is private; Brave needs a fallback | Always-on server faster-whisper; paid API |
| D-05 | Emotion from MediaPipe FaceLandmarker blendshapes, scored with tuned weighted rules | Reuses the vision runtime (3.7 MB model, no extra library); transparent | face-api.js (dead), @vladmandic/human (extra library + models) |
| D-06 | ISL fingerspelling recognition ships in v2, not just ASL | Indian audience; the data exists (CC BY-SA landmarks); the report lists it as next | ASL only |
| D-07 | Recognition and lookup are labelled "fingerspelling/sign recognition" and "word-by-word sign lookup", with an interpreter disclaimer | The Deaf community (WFD/WASLI) objects to "translation" claims | Calling it "sign language translation" |
| D-08 | No word-level sign recognition in v2 | Needs ~25 MB of extra models (Holistic + word model); the report does not claim it | GestureSign ONNX + Holistic |
| D-09 | Text→Sign output order: real signer video, then sign.mt pose animation, then fingerspelling. No custom 3D avatar | Real video is preferred by Deaf users; the pose API covers the rest for free; an avatar takes weeks | three.js/VRM avatar, CWASA/SiGML |
| D-10 | Sign media is licence-clean, self-hosted, tiny WebM (240p, ≤ 120 KB), about 60–80 words per language, fetched on demand | Light, offline-capable, legal | Hot-linking Lifeprint/Handspeak/Spread The Sign (terms forbid it); YouTube embeds (heavy, tracking) |
| D-11 | Add Hindi Bharati braille (liblouis `hi-in-g1.utb`) | Indian users; free in liblouis | English only |
| D-12 | Tutorials get a practice mode that reuses the recogniser | Turns static content into learning; no extra cost | Static cards only |
| D-13 | One gunicorn worker with threads; Bridge rooms kept in memory | Two-person rooms at student scale; no Redis | Redis message queue, multiple workers |
| D-14 | Personalize applies changes live, with Undo, instead of an "Apply Filters" button | Immediate feedback, fewer steps | Apply button (Lovable brief) |
| D-15 | No cross-origin isolation (COOP/COEP) | No threaded WASM is needed after D-03; keeps media and downloads simple | COEP for ORT threads |
| D-16 | Gestures come from rules on hand landmarks, not GestureRecognizer | Saves an 8.4 MB model; the rules are tunable and explainable | MediaPipe GestureRecognizer |
| D-17 | Replace the home auto-carousel with a live "one message, every way" demo | Carousels hide content and need pause controls (WCAG 2.2.2); the demo shows the product working | 3-slide carousel (report Fig 3.5.1) |
| D-18 | Free services only: Vercel Hobby, a free backend host, the free sign.mt API, gTTS, open-licence models and fonts | Hard constraint for this project | Any paid plan or key |
| D-19 | Offline braille = built-in Grade 1 table in JS; Grade 2 and Bharati need the server | Building liblouis to WASM costs time and adds size | Emscripten liblouis build |
| D-20 | Visual direction "Every way": soft violet paper, solid violet ink, magenta only for live states, Syne display + Atkinson Hyperlegible, braille-cell motif, no gradients | Avoids the generated-SaaS look of v1 and serves legibility | Gradient hero and card grid (v1) |
| D-21 | Lint with **oxlint** (react, typescript, jsx-a11y plugins), not ESLint | It ships with the Vite 8 template, is about 50× faster and covers jsx-a11y | ESLint + typescript-eslint |
| D-22 | gTTS is installed with `--no-deps` in the API image | gTTS 2.5.4 pins `click<8.2` for its CLI only, which conflicts with spaCy 3.8 (`click>=8.2.1`). The library path doesn't use click | Dropping spaCy; older spaCy |
| D-23 | Contrast is checked by `web/scripts/contrast-check.mjs` over 12 token pairs × 12 modes (AAA for High Contrast and Low Vision) and runs in CI | Puts a number on the accessibility claim; it caught the Solarized border (2.83 → fixed) | Manual checks only |
