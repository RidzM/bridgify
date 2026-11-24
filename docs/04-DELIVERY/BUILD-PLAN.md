---
doc: build-plan
status: filled
last_updated: 2026-11-24
confidence: medium
---

# Build plan

> **How to use this file:** this is the live checklist for the whole build.
> - Work top to bottom.
> - Every sub-phase ends with its **acceptance check actually run**, a **visual check** (screenshots in `docs/screens/<phase>/`), and a status update here.
> - Requirement IDs (FR-…) point to `../02-PRODUCT/PRD.md`.
> - Design rules are in `../03-SYSTEM/DESIGN-SYSTEM.md`, and component and API detail in `../03-SYSTEM/SYSTEM-ARCHITECTURE.md`.
>
> **Status key:** ⬜ not started · 🟡 in progress · ✅ done · ❌ blocked (with a note)
>
> **Hard rules:**
> - **Free services only.** No paid API, plan or key.
> - **Light site:** shell ≤ 180 KB JS, ML lazy-loaded only on the page that uses it.
> - **Nothing is "done" if it is mocked.**
> - Commits carry the team's identity only.

## Difficulty ranking

| Phase | What | Difficulty (1–5) | Why it is hard |
|---|---|---|---|
| P1 | Vision core, data, training, Sign→Text | **5** | Real ML: data quality, Python↔JS feature parity, held-out accuracy gate, live UX tuning |
| P5 | Text→Sign + content | **4** | Licence-clean media curation for 6 languages, sign.mt pose integration, gloss rules |
| P7 | Bridge + SOS + PWA | **4** | Realtime across two devices, receive-side rendering per profile, offline caching |
| P3 | Speech (TTS/STT + Whisper opt-in) | 3 | Browser quirks (Chrome boundary bug, Brave, Safari), worker audio pipeline |
| P4 | Braille ⇄ Text | 3 | liblouis packaging (Debian binding), Perkins chording, golden tests |
| P2 | Gesture & Emotion | 3 | Rule tuning on real people, two vision tasks on one stream |
| P8 | Hardening and ship | 3 | 12 modes × all routes accessibility, CSP, deploy, evidence |
| P0 | Foundation | 2 | Lots of setup, little risk |
| P6 | Home demo, Tutorials | 2 | Mostly content and UI |

**Order of work:** P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8.
- **P1 comes first after setup** because it is the riskiest, and because the team's recording session (a human task) needs the collector early.
- **P2 reuses P1's vision worker.**
- **P3 and P4 are independent** and can run while the team records data.
- **P7 needs P3 (speech), P4 (braille) and P5 (sign output)** for receive modes.

## Human tasks (need a person; everything else is done end to end)

| # | Task | When | Who |
|---|---|---|---|
| H1 | ✅ GitHub token given; repo RidzM/bridgify | Done | — |
| H2 | ✅ No backend host (D-24) | Done | — |
| H3 | ~~Recording session~~ dropped 24 Nov: train and evaluate on public multi-signer datasets instead (Q-08) | — | — |
| H4 | Review the sign lexicon word list for ISL (regional variants) | P5 | Team |
| H5 | Patent: file the provisional before removing the passcode gate | After P8 | Team / college IPR cell |
| H6 | Two-phone Bridge demo rehearsal | P7 end | Team |

---

## Phase 0: foundation (difficulty 2) ✅ 24 Nov

**Goal:** an empty but real, deployed, accessible shell in all 12 modes, plus a running API.

### 0.1 Repo and tooling ✅ 24 Nov (CI workflow: web lint/contrast/test/build/e2e/impeccable + server Docker pytest; hooks active; README, LICENSE, .env.example, docker-compose)

**Steps:**
1. Root folders: `web/`, `server/`, `ml/`, `content/`, `docs/`, `.github/workflows/`. Root `README.md` (what, run, links). `LICENSE`: MIT for code; content licences listed separately in `content/CREDITS.json`.
2. `.editorconfig` and `.gitattributes` (LF; `*.bin` binary).
3. Git hooks are already in `.git/hooks`:
   - commit-msg and pre-commit enforce the commit identity rules and keep local-only files out
   - pre-push checks authors
4. CI `ci.yml` with these jobs:

   | Job | Steps |
   |---|---|
   | `web` | pnpm install --frozen-lockfile, then lint, typecheck, test, build, bundle-size check |
   | `server` | ruff, then pytest, inside the Docker image |
   | `e2e` | Playwright Chromium + axe, against `vite preview` + the server container |
   | `design` | `npx impeccable detect web/src --github` |

**Acceptance:** CI runs green on an empty app. `git log --format='%an %ae'` shows only the team identity.

### 0.2 Web scaffold ✅ 24 Nov (Vite 8.3, React 18.3.1, TS 7 strict, Tailwind 4.3, oxlint, Vitest 5, Playwright 1.65; entry 105.7 KB gz of 180)

**Steps:**
1. `pnpm create vite web --template react-ts`, then pin `react@18.3.1`, `react-dom@18.3.1`.
2. Add:
   - `react-router-dom@6.30.x`, `zustand@5.1.x`, `motion@14.x`
   - `@base-ui/react@1.9.x`, `lucide-react`
   - `tailwindcss@4.3.x` + `@tailwindcss/vite`
   - `idb-keyval`, `socket.io-client@4.8.x`, `vite-plugin-pwa@2`
   - `@fontsource/syne`, `@fontsource/atkinson-hyperlegible-next`, `@fontsource/opendyslexic`
3. Dev dependencies:
   - `vitest@5`, `@testing-library/react`, `@playwright/test@1.65`, `@axe-core/playwright@4.14`
   - `eslint` + `typescript-eslint` + `eslint-plugin-jsx-a11y` + `eslint-plugin-react-hooks`
   - `prettier`, `rollup-plugin-visualizer`
4. `tsconfig`: `strict`, `noUncheckedIndexedAccess`. Path aliases `@/` → `src`, `@content/` → `../content`.
5. `vite.config.ts`:
   - `worker.format = 'es'`
   - `build.target = 'es2022'`
   - `manualChunks` off (let routes split)
   - `vite-plugin-pwa` with `registerType:'prompt'` (configured fully in P7)
6. Bundle budget script `scripts/size-check.mjs`: fails if the entry chunk is > 180 KB gzip.

**Acceptance:** `pnpm dev` serves, `pnpm build` passes the size check, `pnpm test` runs.

### 0.3 Design tokens, 12 modes, fonts ✅ 24 Nov (contrast script: 12 modes × 12 pairs, 0 failures; no-flash boot script; OpenDyslexic lazy) (FR-PZ-01, 02, 03, 04, 07)

**Steps:**
1. `src/design/tokens.css`: semantic variables (DESIGN-SYSTEM §4.1), the type scale in rem, and `html{font-size:calc(100% * var(--text-scale,1))}`.
2. `src/design/modes.css`: 12 `[data-mode="…"]` blocks (DESIGN-SYSTEM §4.2), plus `[data-motion="off"]` rules and the dyslexia typography rules.
3. Tailwind 4 `@theme` maps colours, radii and fonts to the variables. Raw hex in components is not allowed (ESLint rule: no hex outside `design/`).
4. Inline boot script in `index.html` reads `localStorage["bridgify.prefs.v1"]` and sets `data-mode`, `data-motion` and `--text-scale` before paint. It falls back to OS `prefers-*` on first visit.
5. `scripts/contrast-check.ts` computes WCAG ratios for every mode's token pairs (ink/bg, ink-muted/bg, brand/bg, live/surface, line-strong/surface, focus/bg). It fails below AA, or below AAA for high-contrast and low-vision. Wired into CI.
6. `stores/prefs.ts`: the Zustand `persist` store (SYSTEM-ARCHITECTURE §6.3), with a version and migrate.

**Acceptance:**
- The contrast script passes for all 12 modes.
- Switching modes in a test page changes colours with no reload.
- Reload keeps the mode with no flash (Playwright: screenshot at `domcontentloaded` shows the right bg).

**Visual check:** a token sheet page `/__tokens` (dev only) in all 12 modes, screenshotted.

### 0.4 App shell ✅ 24 Nov (axe: 0 serious/critical on 4 routes × 12 modes; keyboard panel test; 200% at 320 px passes; home 'Every way' demo with speech + braille G1 + large print already live) (FR-SH-01..05, FR-PZ-04..06, 08)

**Steps:**
1. `app/router.tsx`: all routes from SYSTEM-ARCHITECTURE §6.1, lazy, with placeholder pages that say "Not built yet".
2. `AppShell`: skip link, sticky `TopBar`, `<main id="content">`, `Footer` (privacy, credits, evidence).
3. `PersonalizePanel` (left `Sheet`):
   - ModeSwatch radiogroup
   - text-size slider (80–200%, step 10)
   - show/hide switches per tool
   - underline links, large cursor
   - reset, with an Undo toast
4. `TutorialsPanel` (right `Sheet`): tabs Braille | Sign language and a language select. Content arrives in P6; the stub links to `/learn`.
5. `SOS` button in the top bar (routes to `/sos`; built in P7).
6. `ToolFrame`, `PrivacyStrip`, `LiveRegion`, `ErrorBoundary`, a 404 page.
7. `engines/platform/capabilities.ts` + `brave.ts` + `permissions.ts` with unit tests (mock `navigator`).
8. `engines/platform/modelManager.ts`: manifest read, fetch with progress, sha256 (SubtleCrypto), Cache API store. Unit-tested with a fake fetch.
9. UI kit v1: Button, Chip, Switch, Slider, Tabs, Sheet, Dialog, Toast, SegmentedControl.

**Acceptance:**
- Keyboard-only: you can open and close both sheets, change mode, change text size and hide a tool, and focus returns to the trigger.
- axe: 0 serious/critical on `/` in all 12 modes.
- At 200% text size and 320 px width there is no horizontal scroll.

**Visual check:** home shell plus both sheets open, in Light, Dark, High Contrast and Dyslexia, on desktop and mobile.

### 0.5 Server scaffold ✅ 24 Nov (Docker debian:trixie, liblouis 3.39.0 via backports, tables en-ueb-g1/g2 + hi-in-g1 compile, 4 pytest pass)

**Steps:**
1. `server/` layout (SYSTEM-ARCHITECTURE §5).
2. `create_app()` + config from env, Flask-CORS allowlist, Flask-Limiter (memory).
3. Flask-SocketIO (`async_mode='threading'`) + simple-websocket. `/api/health`.
4. Dockerfile on `debian:trixie-slim` with `python3-louis` + `liblouis-data`:
   - Check `louis.version()`.
   - If trixie only has 3.33, add `trixie-backports` and pin `liblouis20/python3-louis` to 3.39.
5. `gunicorn.conf.py`: `worker_class='gthread'`, `workers=1`, `threads=50`, `timeout=60`.
6. pytest: health and CORS. Ruff config.

**Acceptance:** `docker build` + `docker run -p 8000:8000`, then `curl /api/health` shows `louis` ≥ 3.33 and lists tables `en-ueb-g1.ctb`, `en-ueb-g2.ctb`, `hi-in-g1.utb`.

### 0.6 First deploy (de-risk hosting early) ✅ 24 Nov: https://bridgify-vcet.vercel.app (Vercel), repo github.com/RidzM/bridgify (public). No always-on API (D-24); braille moves to WASM in P4

**Steps:**
1. `web/vercel.json`:
   - SPA rewrite
   - headers: CSP, Permissions-Policy, `Cache-Control: public, max-age=31536000, immutable` for `/assets`, `/models`, `/signs`
2. Deploy a Vercel **preview**, with project name `bridgify` so the URL carries no personal name.
3. Backend on the host chosen in H2 (Render free: Docker web service from the repo, health path `/api/health`).
4. Passcode gate (Q-01): a small screen that compares a SHA-256 of the entered code with `VITE_SITE_PASSCODE_HASH`.
   - It is not security, only a casual gate against public disclosure.
   - Enabled when the env var is set.

**Acceptance:** the preview URL loads the shell on a phone; `/api/health` is reachable from it (CORS ok).

---

## Phase 1: vision core, ML, Sign→Text (difficulty 5) ✅ 24 Nov

**Goal:** real on-device ASL and ISL fingerspelling at ≥ 0.90 macro-F1 on held-out signers, with a smooth live UX (FR-SG-01..09).

### 1.1 Camera and vision worker ✅ 24 Nov (module worker, MediaPipe tasks-vision 1.2.3 ESM runtime served from /wasm/mediapipe (4.1 MB gz, camera pages only); back-pressure frame loop via requestVideoFrameCallback; fixed MediaPipe "ModuleFactory not set" for the 2nd task/CPU retry by restoring the factory from the loader's default export)

**Steps:**
1. `engines/vision/camera.ts`: `getUserMedia({video:{width:640,height:480,facingMode:'user'}})`, start/stop, device switch, `NotAllowedError` / `NotFoundError` mapping to friendly messages.
2. `workers/vision.worker.ts`:
   - Imports `@mediapipe/tasks-vision@1.2.3` `FilesetResolver.forVisionTasks('/wasm')`.
   - Creates `HandLandmarker` from the ModelManager-provided buffer (`modelAssetBuffer`), `runningMode:'VIDEO'`, `numHands` per message, `delegate:'GPU'`, retrying with `'CPU'` if that throws.
   - Message protocol as in SYSTEM-ARCHITECTURE §6.6.
   - Copy `node_modules/@mediapipe/tasks-vision/wasm/*` to `public/wasm/` with a `postinstall` script.
3. `engines/vision/visionClient.ts`:
   - `requestVideoFrameCallback` loop
   - `createImageBitmap(video)` sent as a transfer
   - back-pressure: one frame in flight
   - fps/inferMs stats
4. `CameraStage` component:
   - mirrored `<video>` (CSS `scaleX(-1)`)
   - `<canvas>` overlay drawing 21 points and bones, in `--live` colour
   - "Can't see your hand" hint after 3 s with no hands
   - Start/Stop buttons

**Acceptance:** laptop at ≥ 24 fps, landmarks track both hands. The page loads the model only on first camera start (network panel). Denying the camera shows recovery steps.

**Visual check:** screenshot with the overlay, plus a GIF of tracking.

### 1.2 Feature spec, Python ↔ TypeScript ✅ 24 Nov (features.ts 1:1 with ml/bridgify_ml/features.py incl. aspect fix; parity: 20 frames < 1e-5)

**Steps:**
1. `ml/` env: `uv init --python 3.12`, then add `torch`, `mediapipe`, `numpy`, `pandas`, `scikit-learn`, `pyyaml` and `pytest`.
2. `bridgify_ml/features.py`: ML-PIPELINE §4, exactly as specified (translate, scale, mirror, z-weight, 15 angles, 10 distances, palm normal; ISL two-slot + mask).
3. `web/src/engines/vision/features.ts`: the same, line by line.
4. `ml/tests/make_fixtures.py` writes `web/src/engines/vision/__fixtures__/features.json` (20 frames, ASL + ISL, including one with a missing hand).
5. `features.parity.test.ts` asserts max abs diff < 1e-5.

**Acceptance:** the parity test is green in CI.

### 1.3 Collector (`/lab/collector`) ⏭ descoped 24 Nov (D-27: public multi-signer data instead of recordings)

**Steps:**
1. The flow from ML-PIPELINE §3.2: signer form, letter queue with reference image, countdown, 4 s capture, live count of good frames, redo button.
2. Saves raw landmarks to IndexedDB `samples`, with export to `.jsonl.gz` (CompressionStream).
3. A gesture set (8) and an emotion set (7 acted, 5 s each, face blendshapes) in the same tool, for P2.

**Acceptance:** one person records A–E; the export file opens in Python with ≥ 100 good frames per letter.

**Human:** **H3 starts now.** Send the team the link and a 1-page guide covering light, background, distance and both hands for ASL.

### 1.4 Data assembly ✅ 24 Nov (ASL-HG 10 signers, 99.78% hand detection; Dwibon ISL 6+1 signers; HaGRID 626 test users; KDEF 70 people; see docs/EVAL.md)

**Steps:**
1. Download the Kaggle ISL landmark CSVs. Verify the column order and whether the coordinates are raw image-normalised. If they are already normalised differently, reconstruct or re-extract from the image set.
2. Download ASL alphabet images and extract landmarks with `extract.py` (MediaPipe Python, same `hand_landmarker.task`), sampling ≤ 300 per class.
3. Load collector exports.
4. `datasets.py` builds `(X, y, signer_id, source)`.
5. Split by signer: hold out ≥ 1 collector signer for each language as **test** (never used in training or tuning), 1 as val, the rest train. Public data goes to train only.
6. `ml/data/README.md` lists sources, licences, counts per class and the split table.

**Acceptance:** each class has ≥ 500 training samples, and the split has no signer leakage (assert in a test).

### 1.5 Training and evaluation ✅ 24 Nov (held-out macro-F1: ASL MLP 0.962 on signers P9–P10; ISL logistic regression 0.989 on unseen signer; baselines + LOSO in EVAL.md)

**Steps:**
1. `train.py --config configs/asl_letters.yaml`: baselines (kNN, logistic regression, SVM), then the MLP with augmentation. Seeds fixed. Writes `runs/<date>-asl/report.json` with confusion matrix PNG and per-class F1.
2. Same for ISL.
3. Leave-one-signer-out over the collector signers for a variance estimate.
4. If below the 0.90 gate:
   - check the per-class confusions
   - add targeted recordings (H3 round 2) for confused letters
   - try the angle-only feature subset
   - retrain
   - log every attempt in `docs/EVAL.md`

**Acceptance:** held-out macro-F1 ≥ 0.90 for both languages, and the MLP beats logistic regression (otherwise ship logistic regression; the same exporter handles one layer).

### 1.6 Export, JS inference, parity ✅ 24 Nov (asl 86 KB, isl 17 KB weights; mlp.ts; 100 parity tests incl. models, gestures, emotion)

**Steps:**
1. `export.py` writes `{name}.bin` + `{name}.json` to `web/public/models/` and updates `manifest.json` (sha256, bytes, version, licence, metrics).
2. `engines/vision/mlp.ts`: load, standardise, dense/ReLU loop with `Float32Array`, softmax. About 60 lines, unit-tested.
3. Logits parity fixture from Torch; test diff < 1e-4.
4. Worker integration: `classifier` option in `init`.

**Acceptance:** parity green, MLP < 1 ms per frame in the browser (logged `inferMs`).

### 1.7 Sign→Text page ✅ 24 Nov (FR-SG-01..09; real fake-webcam e2e: held-out signer photos L, O, V → "LOV"; error/keyboard/mobile e2e. Live-person accuracy check still to do with the team)

**Steps:**
1. Layout per DESIGN-SYSTEM (camera left, detected text right; mobile: camera on top).
2. Language chips: ASL and ISL are live. FSL, LSM, LIS and DGS are disabled, with the explanation and links.
3. `smoothing.ts` (EMA) and `committer.ts` (SYSTEM-ARCHITECTURE §8.3), unit-tested with synthetic probability sequences: hold, flicker, repeat letters, hand drop.
4. Confidence ring and "Not sure" chips (top 3, tap to commit).
5. Output panel: `aria-live` letters, Space, Backspace, Speak Aloud (uses the P3 TTS engine; until then plain `speechSynthesis`), Copy, Clear. Keyboard shortcuts: Space, Backspace, Ctrl+Enter speaks.
6. Reference strip (alphabet images for the language; content comes from P5/P6, placeholder images until then).
7. Privacy strip "Camera stays on this device", plus a Playwright network assertion (no request bodies > 2 KB while running).
8. Disclaimer line (FR-SG-09).

**Acceptance:**
- 3 people spell 10 words each with ≥ 85% of letters correct (live commit accuracy, logged in EVAL.md).
- Fake-camera e2e: a `.y4m` clip of someone spelling "HI" produces "HI".
- axe clean.

**Visual check:** Light + High Contrast, desktop + mobile, with landmarks visible.

---

## Phase 2: Gesture & Emotion (difficulty 3) ✅ 24 Nov (FR-GE-01..06)

### 2.1 Gesture rules ✅ 24 Nov (97.3% on 626 unseen HaGRID users; wave detector unit-tested; ILY untested on real data, no public set)

**Steps:**
1. `gestures.ts`: finger extension by distance ratios (tip-to-wrist vs PIP-to-wrist > 1.15), thumb direction, and the rule table (SYSTEM-ARCHITECTURE §6.6).
2. `wave.ts`: ring buffer and sign-change count.
3. Unit tests from recorded landmark fixtures (from the collector gesture set).
4. Tune thresholds on the H3 recordings until accuracy ≥ 90%.

**Acceptance:** 8-gesture confusion table in EVAL.md, ≥ 90%.

### 2.2 Emotion ✅ 24 Nov (logistic regression on 52 blendshapes, 0.744 macro-F1 on 20 unseen KDEF people; rule weights kept for the "based on" explanation)

**Steps:**
1. Add `FaceLandmarker` (`outputFaceBlendshapes:true`, numFaces 1) to vision.worker behind the `face` flag, running every 3rd frame.
2. `emotion.ts` scorer with weights from `content/emotion-weights.json`.
3. `ml/tune_emotion.py`: grid search over the weights on acted clips with held-out people; writes the JSON and a report.

**Acceptance:** macro-F1 reported in EVAL.md (no gate). The UI shows the "approximate" label and the top 3 driving blendshapes.

### 2.3 Page ✅ 24 Nov (fake-webcam e2e: open hand → "Open palm"; log once per new gesture; CSV export; mobile)

**Steps:**
1. One camera stage with hand and face overlays.
2. Gesture card: emoji-free SVG icon, name, meaning, confidence.
3. Emotion card: label, bar, drivers.
4. "Speak meanings" toggle (hold 800 ms, 3 s cooldown).
5. Session log table + CSV export (IndexedDB).
6. Gesture reference cards (8).

**Acceptance:** combined pipeline ≥ 15 fps on a laptop, log exports, axe clean.

**Visual check:** with real gestures.

---

## Phase 3: Speech (difficulty 3) ✅ 24 Nov (FR-TTS-*, FR-STT-*)

### 3.1 TTS engine ✅ 24 Nov (`engines/speech/{tts,chunk,voices}.ts`; sentence chunking ≤180 chars incl. Hindi danda, boundary + estimated word timing after 400 ms, Chrome keep-alive, local-voice ranking; 5 unit tests)

**Steps:**
1. `voices.ts`: loads voices with `voiceschanged` and a timeout; ranks `localService` first; matches language.
2. `tts.ts`:
   - sentence chunker (≤ 180 chars, splitting on `.?!।`)
   - utterance queue; pause/resume/stop/repeat
   - `cancel()` before speak
   - 10 s resume ping for Chrome long-text
   - events `{word, charIndex}` to the UI
3. `wordTiming.ts`: if no `boundary` within 400 ms, schedule word highlights from per-character estimates scaled by rate.
4. Unit tests with a fake `speechSynthesis`.

**Acceptance:** speaks a 600-character paragraph in Chrome, Firefox and Safari without cutting off. Highlight follows along: real boundaries in Firefox/Safari, estimated in Chrome network voices.

### 3.2 TTS page and quick access ✅ 24 Nov (`/tools/text-to-speech`; English + Hindi phrase sets, 6/5 categories; live caption; e2e desktop + mobile incl. keyboard Ctrl+Enter)

**Steps:**
1. Text area, voice/language select, speed slider (1–10), caption band, controls.
2. `content/phrases/quick-access.en.json` + `.hi.json`, with categories as in FR-TTS-06. At least 10 per category; use the report's Fig 3.5.6.1 phrases as the base set.
3. Chips speak on tap, and keyboard Enter works.

**Acceptance:** FR-TTS-01..06 checks pass. axe clean.

### 3.3 gTTS fallback ✅ 24 Nov (Flask function `web/api/tts.py` on Vercel per D-24; tested locally: en + hi mp3, empty → 400)

**Steps:**
1. `POST /api/tts`: gTTS with lang map, length cap, rate limit, sha1 disk cache, `audio/mpeg`.
2. Client: used when no voices exist, or when "Use server voice" is chosen.

**Acceptance:** pytest (gTTS mocked) passes, plus a manual run.

### 3.4 STT browser path ✅ 24 Nov (`engines/speech/{stt,punctuate}.ts`, Brave detection; 21 punctuation tests; captions view; e2e)

**Steps:**
1. `stt.ts`: constructor detection (`SpeechRecognition` / `webkit…`), `continuous`, `interimResults`, `lang`, `processLocally` when supported, auto-restart while active, error mapping.
2. `brave.ts`: if Brave, or after 2 `network` errors, switch to the Whisper offer.
3. `punctuate.ts`: rules per FR-STT-02, using result timestamps for pause gaps, with unit tests (20 cases, English and Hindi question words).
4. Page: big mic button with a magenta live state, transcript box (`aria-live`), toggles (smart punctuation, captions), Speak / Copy / Clear / Download.
5. Caption overlay (full-screen, 2 lines, ≥ 32 px).

**Acceptance:** live words < 500 ms in Chrome. Punctuation tests green.

### 3.5 Whisper opt-in ✅ 24 Nov (whisper-tiny.en in a worker, 16 kHz PCM via AudioWorklet, silence skip; WebGPU only if an adapter exists, else WASM; real e2e with a spoken clip as fake mic → transcript contains "hospital"; worker chunk not in entry) (FR-STT-05)

**Steps:**
1. A dialog showing the size (~40 MB, once).
2. On accept, dynamically `import('@huggingface/transformers')` inside `workers/asr.worker.ts`; pipeline `onnx-community/whisper-tiny.en`, q8, WebGPU or WASM; progress through ModelProgress.
3. MediaRecorder, 5 s chunks, then `decodeAudioData`, resample to 16 kHz, then the worker, then text appended.
4. Verify the transformers chunk is **not** in the entry bundle (size check).

**Acceptance:** in Brave, transcribes a 20 s English clip with readable output. The main bundle is unchanged in size.

---

## Phase 4: Braille ⇄ Text (difficulty 3) ✅ 24 Nov (FR-BR-*)

### 4.1 liblouis engine ✅ 24 Nov (D-24: liblouis 3.39.0 compiled to WebAssembly, 143 KB gzip with 17 tables embedded, UCS-4; worker `workers/braille.worker.ts`; 59 golden cases from native liblouis match exactly in Vitest and pytest)

**Steps:**
1. `louis_svc.py`: table map (SYSTEM-ARCHITECTURE §7.2); `translateString`, `backTranslateString`; Unicode output through `unicode.dis`; build `cells` (dots from the code point minus 0x2800) and `brf` (with `en-us-brf.dis`, or our own ASCII map).
2. Endpoints `/api/braille/translate` and `/api/braille/back`, with limits.
3. Golden tests: the report's cases ("HELLO, HOW ARE YOU?" G1, "THE RED FORT" G2) and 30 UEB samples. Expected outputs are generated once from liblouis and committed, so a table change is caught.

**Acceptance:** pytest green inside Docker.

### 4.2 Client engine and DotGrid ✅ 24 Nov (`engines/braille/client.ts` with offline Grade 1 fallback; DotGrid with dot numbers)

**Steps:**
1. `grade1.ts`: UEB Grade 1 offline map (letters, digits with number sign, capitals indicator, basic punctuation), with tests that agree with the server on 50 strings.
2. `cells.ts`, `brf.ts`, unit-tested.
3. `BrailleCell` / `DotGrid` SVG components; accessible names "dots 1 2 5, letter h".

**Acceptance:** tests green. Offline toggle in DevTools shows Grade 1 with the banner.

### 4.3 Text→Braille page ✅ 24 Nov (report cases reproduce exactly in e2e; .txt conversation log + .brf downloads)

**Steps:**
1. Grade select (Grade 1, Grade 2, Hindi Bharati), input, Convert, output (Unicode + Copy), DotGrid, Speak Aloud.
2. Downloads: conversation log `.txt` in the Fig 3.5.9.1 format, and `.brf`.

**Acceptance:** the report's own test cases reproduce exactly.

### 4.4 Braille→Text (Perkins) ✅ 24 Nov (S D F J K L chording on last-key release; tap-dots for touch; e2e keyboard + touch)

**Steps:**
1. `perkins.ts`:
   - keydown/keyup set
   - commit on the last key release
   - S D F J K L map, plus Space and Backspace
   - ignore auto-repeat
2. On-screen 6 dots (toggle buttons) plus a "Next cell" button for touch.
3. Live cells row, then back-translate (debounced 300 ms; server; offline Grade 1 inverse); output text + Speak.
4. Help panel with the key map.

**Acceptance:** chording F+J gives "c". A Grade 2 contraction expands. Usable with keyboard only and with touch only.

### 4.5 Bharati ✅ 24 Nov (hi-in-g1 in WASM; 10 golden Hindi cases; e2e)

**Steps:**
1. `hi-in-g1.utb` in the table map.
2. Golden tests on 10 Hindi words.
3. Devanagari input font loaded.

**Acceptance:** tests green.

---

## Phase 5: Text→Sign and content (difficulty 4) ✅ 24 Nov (FR-TS-*)

> Built without a server (D-24): the browser calls sign.mt directly; animations use our own `.pose` reader and compact format (D-30); ISL gloss runs in JS (D-31). Screenshots: `docs/screens/p5-p8/`.

### 5.1 Content pipeline ✅ 24 Nov
`tools-content/signs/` prepares word and phrase animations from sign.mt (`fetch-poses.mjs` → compact JSON) and DGS signer videos from SignDict (`fetch-videos.mjs`, per-video CC licences); `verify.mjs` checks everything with the app's own tokenizer and decoder. Lexicons in `content/lexicons/<lang>.json` for ISL, ASL, FSL, LSM, LIS and DGS (everyday words plus the quick-access phrases); credits in `content/credits/signs.json` (shown on /about/credits, grouped). `web/scripts/content-check.mjs` fails the build if any lexicon, phrase or letter file points at a missing file. **Evidence:** all media references resolve (see the build log); sign media is about 38 MB, loaded only when shown and cached on first use. No Lifeprint, Handspeak, Spread The Sign, Sématos or DGS-Korpus media.

### 5.2 Gloss ✅ 24 Nov (JS, D-31)
`engines/sign/gloss.ts`. **Evidence:** 12 unit tests, including "Where is the hospital?" → `HOSPITAL WHERE` and "I am not hungry" → `I HUNGRY NOT`.

### 5.3 Pose fallback (sign.mt) ✅ 24 Nov
Direct browser request (CORS `*`), language codes ase/ins/fsl/mfs/ise/gsg, 20 s timeout and one retry on a server error, Cache API `bridgify-signs-live-v1`; our own `.pose` reader (no pose-viewer). **Evidence:** `poseFile`/`poseCompact` unit tests; e2e under the production CSP.

### 5.4 Player and page ✅ 24 Nov
`/tools/text-to-sign`: six language chips, Show signs, Speak, ISL word-order line, SignPlayer (play/pause, previous/next, speed, loop, strip), per-language quick phrases, disclaimer. Stored lexicon → live sign.mt → fingerspelling; a stored phrase that fails to load is signed word by word. The figure renderer draws a person, not a skeleton (D-35). **Evidence:** `e2e/sign.spec.ts` on desktop and Pixel 7 (ASL "hello" plays, names are fingerspelled, ISL order line with stored signs while sign.mt is down, all six languages present).

---

## Phase 6: home demo, Tutorials (difficulty 2) ✅ 24 Nov (FR-SH-03, FR-TU-*)

### 6.1 Home "Every way" demo ✅ 24 Nov
Composer rows: Spoken, Braille (grade 1), Fingerspelled (in the chosen sign language, when pictures exist), Large print. Only new or changed braille cells animate. **Evidence:** Lighthouse mobile on `/` (see 8.2); axe clean in 12 modes.

### 6.2 Braille tutorials ✅ 24 Nov
`/learn/braille/{alphabet,numbers,contractions}` from `content/tutorials/braille-g1.json` and `braille-g2.json` (generated with liblouis 3.39; 85 Grade 2 entries, all matching liblouis), "Hear how braille cells work", and a quiz. **Evidence:** `e2e/learn.spec.ts`.

### 6.3 Sign tutorials ✅ 24 Nov (with documented gaps)
- **Alphabets:** ISL 26/26 (two hands; H, J and Y from photos), ASL 26/26, FSL 26/26 (Commons photos), DGS 30/30 (A–Z, Ä, Ö, Ü, SCH).
- **Numbers:** ISL 10/10, ASL 10/10.
- **Phrases:** 30 per language. Each plays its own stored animation where one exists, and is otherwise planned word by word.
- **Scripts:** ISL letters can be shown in 22 Indian scripts (13 Noto fonts, loaded on demand).
- **Gaps:** LSM and LIS have no openly licensed alphabet pictures (LSM: L, S and M only). Their pages say so and offer the animated signer. Numbers for FSL, LSM, LIS and DGS likewise have no pictures. ISL tips need a signer's check (Q-12).
- **Evidence:** `e2e/learn.spec.ts` (26 ASL letter pictures, 10 number pictures, a stored LSF phrase plays, the LIS page explains and switches Text to sign to LIS).

### 6.4 Practice mode ✅ 24 Nov (FR-TU-04)
`/learn/sign/{asl,isl}/practice`: target letter, camera, Well done, Next letter, score. It only asks for letters the model was trained on (D-34).

---

## Phase 7: Bridge, SOS, PWA (difficulty 4) ✅ 24 Nov (FR-BG-*, FR-SOS-*, FR-PWA-01)

> Built peer to peer (D-24, D-37), so 7.1 "server rooms" became the PeerJS + same-browser transport. Evidence: `docs/EVAL.md` §9, screenshots `docs/screens/p7/` (88: /bridge, /sos and 9 conversation states × 4 modes × desktop and mobile).

### 7.1 Rooms ✅ 24 Nov (peer to peer instead of a server)
PeerJS on the free broker (`bridgify-CODE` host id) plus a BroadcastChannel path for a second tab; 6-character codes; two-person cap (`full` packet); 8 KB packet cap, field-by-field validation, 50 packets/s limit; 30-minute idle expiry. **Evidence:** 28 unit tests (`engines/bridge/*.test.ts`), including the QR encoder checked bit for bit against qrencode 4.1.1.

### 7.2 Client room and router ✅ 24 Nov
`/bridge` start and join (code, QR, read-aloud, copy link), `/bridge/:code` conversation with "How you send", "How you receive", a meter (bytes/s, round trip) and status. Reconnects after 15 s of silence and queues typed messages; rejoins within 30 s after navigating away. **Evidence:** two-tab e2e (type → receive → switch to braille → leave), keyboard-only join, bad codes, third person turned away; an `@online` test through the public broker. Connect 0.36–0.58 s (tabs), 1.6–3.1 s (broker).

### 7.3 Send modes ✅ 24 Nov
Send: Type, Speak (STT engine; each sentence sent on a pause), Quick phrases, Fingerspell (letters held steady build a word; Send word). Receive: captions, speech, braille cells, sign (the P5 player). **Not done:** no send mode emits `gloss` packets yet (they are received and rendered); a connected braille display (WebHID) is future work.

### 7.4 "Show my hands" stream and metrics ✅ 24 Nov
Int16 x/y hand points (z dropped, D-37) with keyframes; the receiver draws the outline (`RemoteHands`). **Evidence:** 13.8 kbps for a continuously moving hand at 30 fps input (target < 15 kbps), 1.6–1.9 kbps when still; round trip median 0.8–2.7 ms on one machine. Real-phone numbers: Q-10.

### 7.5 SOS ✅ 24 Nov
`/sos`: preset cards from `content/phrases/sos.json` (each with a Hindi line), Speak, Show full screen (with Turn text around), Sign it (signs on demand), Your details (name, emergency contact, medical notes, stored on the device), Call contact, Share my location. **Evidence:** e2e (presets, Speak, contact survives reload, offline after one visit); first card in 103–287 ms offline (target 300 ms). Hindi lines need a native check (Q-09).

### 7.6 PWA ✅ 24 Nov
`vite-plugin-pwa` generateSW with a prompt-to-reload toast (`src/app/pwa.ts`, loaded after the page); manifest with braille-"b" icons, maskable icons and SOS/Bridge shortcuts; caching per SYSTEM-ARCHITECTURE §6.8 (D-38). **Evidence:** e2e checks the manifest and icon sizes, that the worker registers without precaching models, that Text to speech works offline, and that SOS works offline.

---

## Phase 8: hardening and ship (difficulty 3) ✅ 24 Nov

### 8.1 Accessibility sweep ✅ 24 Nov (NFR-01)
axe (WCAG 2.2 AA) over 16 routes × 12 modes: 0 serious or critical issues; Bridge and SOS have their own 12-mode sweeps. Keyboard-only tests (display settings, Bridge join, braille keys, lesson tabs); 200% text at 320 px without sideways scrolling. Two issues found and fixed in this phase: a `dd` with `role="img"` inside the home definition list, and script letters using a language name instead of a code in `lang`. **Not done:** a manual screen-reader pass by a person (Q-11).

### 8.2 Performance ✅ 24 Nov (NFR-02)
Entry 121.8 KB gzip of 180 (React Router 7 added 9 KB, D-36). Text no longer shifts as fonts load: the interface fonts are preloaded and the main area reserves its height (CLS 0.144 → 0). `robots.txt` added. Lighthouse (mobile, production): see `PERF` below.

### 8.3 Security ✅ 24 Nov
- **CSP:** strict, and checked at build (D-32). Every flow was tested under it, locally with `scripts/serve-prod.mjs` and in production.
- **Dependency audits:** `pnpm audit --prod` 0 vulnerabilities after the React Router 7 upgrade; `pip-audit` on the function's requirements 0.
- **Secret scan:** gitleaks over all commits found 1 false positive (a localStorage key name), listed in `.gitleaksignore`.
- **Insecure-defaults audit (Trail of Bits):** 4,921 files, 6 categories, 71 patterns. 15 candidates, all refuted on verification; 0 findings. Its optional notes were applied: a 20/min-per-IP limit on `/api/tts` (per warm instance), and the local test server now binds to 127.0.0.1 and refuses paths outside `dist/`.
- **Supply-chain audit (Trail of Bits):** 50 direct dependencies, 0 known advisories. Three unused packages were removed (`socket.io-client`, `@fontsource/syne`, `idb-keyval`), and React and Lucide are pinned exactly.

### 8.4 Design QA ✅ 24 Nov
`npx impeccable detect` on the new routes: 0 anti-patterns. One line-length finding on About was fixed with a 34em measure. Screenshots: `docs/screens/p5-p8/` (8 routes × Light, Dark, High Contrast, Dyslexia × desktop and phone) and `docs/screens/p7/`. Fixes from looking at them: the sign figure renderer (D-35), and an honest panel instead of empty letter cards for LSM and LIS.

### 8.5 Evidence ✅ 24 Nov (FR-EV-01)
`/about/evidence` renders `content/evidence.json`: four model numbers with confusion matrices, plus checks for braille, parity, accessibility, contrast, e2e, Bridge bandwidth and connect time, SOS offline time, and bundle size. Every number traces to `docs/EVAL.md` or a test.

### 8.6 Docs for the team ✅ 24 Nov
- `README.md`: an animated banner and demo clips, a deep-link table of every page, step-by-step use, a five-minute test, how it works, and run-locally steps.
- `docs/Bridgify-User-Guide.pdf`: built by `web/scripts/make-guide.mjs`, with screenshots from the live site, a link per page, a 48-row checklist, a demo script and viva questions.
- `docs/REPORT-UPDATES.md`: paste-ready report text.
- A fresh clone of the public repo installs and builds with `pnpm install && pnpm build` (no Docker needed since D-24).

### 8.7 Ship ✅ 24 Nov
Pushed to `RidzM/bridgify`, where `RidzM` is the only contributor; the mirror is synced. Production deploy to https://bridgify-vcet.vercel.app, and the e2e suite run against production (see `SHIP` below). The passcode gate was dropped by D-25 (public).
