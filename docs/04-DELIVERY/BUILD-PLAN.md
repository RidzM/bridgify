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
| H1 | Give a GitHub token (private repo) and say which name/email commits should carry | Before the first push (P0.6) | Owner |
| H2 | Choose the backend host: Render free (needs a Render account) **or** an existing server | P0.6 | Owner |
| H3 | **Recording session:** ≥ 5 people sign ASL + ISL letters in `/lab/collector` (about 20 min each), plus 8 gestures and 7 acted emotions | During P1 (day 1–2) | Team / friends |
| H4 | Review the sign lexicon word list for ISL (regional variants) | P5 | Team |
| H5 | Patent: file the provisional before removing the passcode gate | After P8 | Team / college IPR cell |
| H6 | Two-phone Bridge demo rehearsal | P7 end | Team |

---

## Phase 0: foundation (difficulty 2) 🟡 (0.1–0.5 ✅ 24 Nov; 0.6 waits on Q-02/Q-03)

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

### 0.6 First deploy (de-risk hosting early) ⬜ blocked on Q-02 (repo account) + Q-03 (API host)

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

## Phase 1: vision core, ML, Sign→Text (difficulty 5) ⬜

**Goal:** real on-device ASL and ISL fingerspelling at ≥ 0.90 macro-F1 on held-out signers, with a smooth live UX (FR-SG-01..09).

### 1.1 Camera and vision worker ⬜

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

### 1.2 Feature spec, Python ↔ TypeScript ⬜

**Steps:**
1. `ml/` env: `uv init --python 3.12`, then add `torch`, `mediapipe`, `numpy`, `pandas`, `scikit-learn`, `pyyaml` and `pytest`.
2. `bridgify_ml/features.py`: ML-PIPELINE §4, exactly as specified (translate, scale, mirror, z-weight, 15 angles, 10 distances, palm normal; ISL two-slot + mask).
3. `web/src/engines/vision/features.ts`: the same, line by line.
4. `ml/tests/make_fixtures.py` writes `web/src/engines/vision/__fixtures__/features.json` (20 frames, ASL + ISL, including one with a missing hand).
5. `features.parity.test.ts` asserts max abs diff < 1e-5.

**Acceptance:** the parity test is green in CI.

### 1.3 Collector (`/lab/collector`) ⬜

**Steps:**
1. The flow from ML-PIPELINE §3.2: signer form, letter queue with reference image, countdown, 4 s capture, live count of good frames, redo button.
2. Saves raw landmarks to IndexedDB `samples`, with export to `.jsonl.gz` (CompressionStream).
3. A gesture set (8) and an emotion set (7 acted, 5 s each, face blendshapes) in the same tool, for P2.

**Acceptance:** one person records A–E; the export file opens in Python with ≥ 100 good frames per letter.

**Human:** **H3 starts now.** Send the team the link and a 1-page guide covering light, background, distance and both hands for ASL.

### 1.4 Data assembly ⬜

**Steps:**
1. Download the Kaggle ISL landmark CSVs. Verify the column order and whether the coordinates are raw image-normalised. If they are already normalised differently, reconstruct or re-extract from the image set.
2. Download ASL alphabet images and extract landmarks with `extract.py` (MediaPipe Python, same `hand_landmarker.task`), sampling ≤ 300 per class.
3. Load collector exports.
4. `datasets.py` builds `(X, y, signer_id, source)`.
5. Split by signer: hold out ≥ 1 collector signer for each language as **test** (never used in training or tuning), 1 as val, the rest train. Public data goes to train only.
6. `ml/data/README.md` lists sources, licences, counts per class and the split table.

**Acceptance:** each class has ≥ 500 training samples, and the split has no signer leakage (assert in a test).

### 1.5 Training and evaluation ⬜

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

### 1.6 Export, JS inference, parity ⬜

**Steps:**
1. `export.py` writes `{name}.bin` + `{name}.json` to `web/public/models/` and updates `manifest.json` (sha256, bytes, version, licence, metrics).
2. `engines/vision/mlp.ts`: load, standardise, dense/ReLU loop with `Float32Array`, softmax. About 60 lines, unit-tested.
3. Logits parity fixture from Torch; test diff < 1e-4.
4. Worker integration: `classifier` option in `init`.

**Acceptance:** parity green, MLP < 1 ms per frame in the browser (logged `inferMs`).

### 1.7 Sign→Text page ⬜ (FR-SG-01..09)

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

## Phase 2: Gesture & Emotion (difficulty 3) ⬜ (FR-GE-01..06)

### 2.1 Gesture rules ⬜

**Steps:**
1. `gestures.ts`: finger extension by distance ratios (tip-to-wrist vs PIP-to-wrist > 1.15), thumb direction, and the rule table (SYSTEM-ARCHITECTURE §6.6).
2. `wave.ts`: ring buffer and sign-change count.
3. Unit tests from recorded landmark fixtures (from the collector gesture set).
4. Tune thresholds on the H3 recordings until accuracy ≥ 90%.

**Acceptance:** 8-gesture confusion table in EVAL.md, ≥ 90%.

### 2.2 Emotion ⬜

**Steps:**
1. Add `FaceLandmarker` (`outputFaceBlendshapes:true`, numFaces 1) to vision.worker behind the `face` flag, running every 3rd frame.
2. `emotion.ts` scorer with weights from `content/emotion-weights.json`.
3. `ml/tune_emotion.py`: grid search over the weights on acted clips with held-out people; writes the JSON and a report.

**Acceptance:** macro-F1 reported in EVAL.md (no gate). The UI shows the "approximate" label and the top 3 driving blendshapes.

### 2.3 Page ⬜

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

## Phase 3: Speech (difficulty 3) ⬜ (FR-TTS-*, FR-STT-*)

### 3.1 TTS engine ⬜

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

### 3.2 TTS page and quick access ⬜

**Steps:**
1. Text area, voice/language select, speed slider (1–10), caption band, controls.
2. `content/phrases/quick-access.en.json` + `.hi.json`, with categories as in FR-TTS-06. At least 10 per category; use the report's Fig 3.5.6.1 phrases as the base set.
3. Chips speak on tap, and keyboard Enter works.

**Acceptance:** FR-TTS-01..06 checks pass. axe clean.

### 3.3 gTTS fallback ⬜

**Steps:**
1. `POST /api/tts`: gTTS with lang map, length cap, rate limit, sha1 disk cache, `audio/mpeg`.
2. Client: used when no voices exist, or when "Use server voice" is chosen.

**Acceptance:** pytest (gTTS mocked) passes, plus a manual run.

### 3.4 STT browser path ⬜

**Steps:**
1. `stt.ts`: constructor detection (`SpeechRecognition` / `webkit…`), `continuous`, `interimResults`, `lang`, `processLocally` when supported, auto-restart while active, error mapping.
2. `brave.ts`: if Brave, or after 2 `network` errors, switch to the Whisper offer.
3. `punctuate.ts`: rules per FR-STT-02, using result timestamps for pause gaps, with unit tests (20 cases, English and Hindi question words).
4. Page: big mic button with a magenta live state, transcript box (`aria-live`), toggles (smart punctuation, captions), Speak / Copy / Clear / Download.
5. Caption overlay (full-screen, 2 lines, ≥ 32 px).

**Acceptance:** live words < 500 ms in Chrome. Punctuation tests green.

### 3.5 Whisper opt-in ⬜ (FR-STT-05)

**Steps:**
1. A dialog showing the size (~40 MB, once).
2. On accept, dynamically `import('@huggingface/transformers')` inside `workers/asr.worker.ts`; pipeline `onnx-community/whisper-tiny.en`, q8, WebGPU or WASM; progress through ModelProgress.
3. MediaRecorder, 5 s chunks, then `decodeAudioData`, resample to 16 kHz, then the worker, then text appended.
4. Verify the transformers chunk is **not** in the entry bundle (size check).

**Acceptance:** in Brave, transcribes a 20 s English clip with readable output. The main bundle is unchanged in size.

---

## Phase 4: Braille ⇄ Text (difficulty 3) ⬜ (FR-BR-*)

### 4.1 liblouis service ⬜

**Steps:**
1. `louis_svc.py`: table map (SYSTEM-ARCHITECTURE §7.2); `translateString`, `backTranslateString`; Unicode output through `unicode.dis`; build `cells` (dots from the code point minus 0x2800) and `brf` (with `en-us-brf.dis`, or our own ASCII map).
2. Endpoints `/api/braille/translate` and `/api/braille/back`, with limits.
3. Golden tests: the report's cases ("HELLO, HOW ARE YOU?" G1, "THE RED FORT" G2) and 30 UEB samples. Expected outputs are generated once from liblouis and committed, so a table change is caught.

**Acceptance:** pytest green inside Docker.

### 4.2 Client engine and DotGrid ⬜

**Steps:**
1. `grade1.ts`: UEB Grade 1 offline map (letters, digits with number sign, capitals indicator, basic punctuation), with tests that agree with the server on 50 strings.
2. `cells.ts`, `brf.ts`, unit-tested.
3. `BrailleCell` / `DotGrid` SVG components; accessible names "dots 1 2 5, letter h".

**Acceptance:** tests green. Offline toggle in DevTools shows Grade 1 with the banner.

### 4.3 Text→Braille page ⬜

**Steps:**
1. Grade select (Grade 1, Grade 2, Hindi Bharati), input, Convert, output (Unicode + Copy), DotGrid, Speak Aloud.
2. Downloads: conversation log `.txt` in the Fig 3.5.9.1 format, and `.brf`.

**Acceptance:** the report's own test cases reproduce exactly.

### 4.4 Braille→Text (Perkins) ⬜

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

### 4.5 Bharati ⬜

**Steps:**
1. `hi-in-g1.utb` in the table map.
2. Golden tests on 10 Hindi words.
3. Devanagari input font loaded.

**Acceptance:** tests green.

---

## Phase 5: Text→Sign and content (difficulty 4) ⬜ (FR-TS-*)

### 5.1 Content pipeline ⬜

**Steps:**
1. `content/lexicons/{lang}.json` schema:

   ```json
   {gloss, words:[...], media:{type:'video'|'image', src, poster?}, source, license, author, url}
   ```

   Plus `content/CREDITS.json`.
2. `content/tools/fetch-media.mjs`:
   - per-source fetchers for **free, licence-clean sources only**: ASL Signbank (CC BY-NC-SA), SignDict API (DGS, per-video CC), Wikimedia Commons (LSF Lingua Libre / Elix, fingerspelling sets), ISLRTC (research use with credit)
   - downloads and transcodes to **WebM VP9, 240p, ≤ 120 KB** (ffmpeg locally)
   - writes the credit entries
3. Word list per language: the quick-access phrases' words plus ~60 everyday words (hello, thank you, help, water, doctor, pain, yes, no, family, school…), so ≈ 60–80 words × 4 languages ≈ 25–35 MB total. Served from `/signs/`, fetched only when shown, never precached except SOS.
4. CI check: every file in `web/public/signs` has a `CREDITS.json` entry, and the size budget is ≤ 40 MB.

**Acceptance:** the lexicon validates against a zod schema. The licence check passes. **H4** review is done for ISL.

### 5.2 Gloss service ⬜

**Steps:**
1. `gloss_svc.py`: spaCy `en_core_web_sm`; ISL rules (SYSTEM-ARCHITECTURE §7.2); ASL WH-last.
2. `/api/sign/gloss`.
3. 30 test sentences.
4. JS fallback with simple rules for offline use.

**Acceptance:** "Where is the hospital?" → `HOSPITAL WHERE`. "I am not hungry" → `I HUNGRY NOT`.

### 5.3 Pose fallback (sign.mt) ⬜

**Steps:**
1. `/api/sign/pose` proxy: param allowlist, 8 s timeout, disk cache, rate limit, credit header.
2. Language codes: ase, ins, fsl (+ spoken=fr), mfs, ise, gsg.
3. Client: lazy-load `pose-viewer` **only** when a pose is needed. Cache `.pose` blobs in IndexedDB.
4. If sign.mt is down: fingerspell.

**Acceptance:** "amigo" (LSM) and "scusa" (LIS) render as poses, matching the report §3.6 cases.

### 5.4 Player and page ⬜

**Steps:**
1. `tokenize.ts` (greedy multi-word match), `sequence.ts` state machine (preload next 2), `fingerspell.ts`.
2. Page:
   - language chips (6)
   - input, Show Signs, Speak Aloud
   - gloss line (ISL)
   - SignPlayer (play/pause, speed, loop, step)
   - cards strip showing the source type badge (Video / Animation / Fingerspelling) and credit
3. Localised quick access per language (`quick-access.{hi,fr,es,it,de,en}.json`) with English in brackets.
4. Disclaimer (FR-TS-08).

**Acceptance:** all 6 report test words render. Reduced motion means step mode. axe clean.

---

## Phase 6: home demo, Tutorials (difficulty 2) ⬜ (FR-SH-03, FR-TU-*)

### 6.1 Home "Every way" demo ⬜

**Steps:**
1. Input, then four rows (Spoken, Braille, Fingerspelt, Large print), reusing the TTS engine, `grade1.ts` (instant, no network), the fingerspelling images and CSS.
2. The dot-raise animation (the only orchestrated motion), off in no-motion modes.
3. Tool directory ("Say it" / "Understand it" columns, with braille initials), Bridge band, "Who it's for" rows, privacy note.

**Acceptance:** LCP ≤ 2.5 s (Lighthouse mobile). Works with no backend.

**Visual check:** 4 modes, plus a critique against the DESIGN-SYSTEM §3 table.

### 6.2 Braille tutorials ⬜

**Steps:**
1. `content/tutorials/braille-g1.json` (A–Z with dots), numbers, `braille-g2.json` (whole-word and part-word contractions, generated from liblouis and then curated).
2. Pages and panel views. "Hear it" button. A quiz: show a cell, pick the letter.

**Acceptance:** content matches liblouis.

### 6.3 Sign tutorials ⬜

**Steps:**
1. For each of the 6 languages:
   - A–Z: Commons images for ASL/LSF/DGS, Zenodo for LSM, sign.mt pose for LIS/ISL letters where no open images exist, ISLRTC where licensed
   - numbers
   - 30 phrases (reusing lexicon media, then pose, then fingerspelling)
2. ISL letter cards with the **22-script row** (`content/scripts/indic-22.json`, Noto fonts on demand).

**Acceptance:** 6 × (26 + 10 + 30) cards render, each with credit. Each script renders (font check).

### 6.4 Practice mode ⬜ (FR-TU-04)

**Steps:** target letter, then the camera (reuse P1), then a pass when the committer emits the target letter, then the next letter. Score shown.

**Acceptance:** works for ASL and ISL.

---

## Phase 7: Bridge, SOS, PWA (difficulty 4) ⬜ (FR-BG-*, FR-SOS-*, FR-PWA-01)

### 7.1 Server rooms ⬜

**Steps:**
1. `realtime/bridge.py`: events per SYSTEM-ARCHITECTURE §7.3; room code generator; 2-member cap; token-bucket rate limit; 8 KB packet cap; sweeper thread; a logger filter that drops `msg` payloads.
2. Tests with `socketio.test_client`: create, join, full, relay, rate, expire.

**Acceptance:** pytest green.

### 7.2 Client room and router ⬜

**Steps:**
1. `bridge/socket.ts` (connect lazily, reconnect with back-off), `room.ts`, `packets.ts` (zod-validated), `router.ts` (receive profile to renderer), `metrics.ts`.
2. Pages:
   - `/bridge`: Start (shows the code, a QR of the `/bridge/CODE` URL, read-aloud) and Join (code input)
   - `/bridge/:code`: conversation view with two lanes, "how I receive" and "how I send" selectors, a meter (bytes/s, RTT), and status (typing, listening, signing)

**Acceptance:** two Playwright browser contexts exchange text both ways. Connected in < 2 s.

### 7.3 Send modes ⬜

**Steps:** wire each send mode into the room:
- Type
- Speak (STT engine)
- Fingerspell (Sign→Text committer; a word is sent on Space)
- Quick phrases

Receive modes:
- captions
- speech (TTS)
- braille (DotGrid, plus a WebHID display if connected, stretch)
- sign (P5 player)

**Acceptance:** the demo script (H6) runs end to end on two phones.

### 7.4 "Show my hands" stream and metrics ⬜ (FR-BG-03, 04)

**Steps:**
1. Quantise landmarks to Int16 (×1000) and send at 15 Hz as base64.
2. The receiver draws a skeleton (lightweight canvas renderer, not pose-viewer).
3. Log the metrics. An evidence script computes median and p95 bandwidth and latency over a 2-minute session.

**Acceptance:** < 15 kbps average and < 250 ms median RTT on the same Wi-Fi, recorded in EVAL.md.

### 7.5 SOS ⬜

**Steps:**
1. `/sos` full-screen card. Presets from `content/phrases/sos.json` plus the user's notes (prefs.sos).
2. Shows large text, ISL video (cached), braille cells, a Speak button, Share location, and a Call contact link.
3. Settings form in Personalize.

**Acceptance:** opens in < 300 ms offline (after the first visit).

### 7.6 PWA ⬜

**Steps:**
1. `vite-plugin-pwa`:
   - manifest (name, icons from the braille "b" mark, theme colour)
   - precache the shell, SOS and SOS media
   - runtime caching rules (SYSTEM-ARCHITECTURE §6.8)
   - update prompt toast
2. ModelManager's Cache API makes models available offline after first use.

**Acceptance:**
- Lighthouse: installable.
- Airplane-mode test: TTS, braille G1, Sign→Text (after one use) and SOS all work.

---

## Phase 8: hardening and ship (difficulty 3) ⬜

### 8.1 Accessibility sweep ⬜ (NFR-01)

**Steps:**
1. axe over every route × 12 modes in CI.
2. Keyboard-only Playwright scripts per tool.
3. Manual screen-reader pass with NVDA (Windows, if available) **or** Orca (Linux), plus VoiceOver (iOS) on Home, TTS, Braille, Sign→Text and Bridge. Findings recorded in `docs/A11Y.md`.
4. 200% zoom and 320 px reflow check.

**Acceptance:** 0 serious/critical issues. Manual findings fixed or recorded.

### 8.2 Performance ⬜ (NFR-02)

**Steps:**
1. Lighthouse CI on `/`, `/tools/text-to-speech` and `/tools/sign-to-text`.
2. Bundle visualiser review.
3. Font subsetting (Latin + Latin-ext for Atkinson; Syne display weight only).

**Acceptance:** Lighthouse Performance ≥ 90, Accessibility ≥ 98, entry ≤ 180 KB gz.

### 8.3 Security ⬜

**Steps:**
1. Final CSP.
2. Rate limits verified.
3. `pnpm audit`, `pip-audit`.
4. Static review for insecure defaults and supply-chain risk.
5. Confirm no secrets in the repo (`gitleaks detect`).

**Acceptance:** no high findings left open.

### 8.4 Design QA ⬜

**Steps:**
1. `npx impeccable detect` on the source and the running URL.
2. Screenshot every route in Light, Dark, High Contrast and Dyslexia, desktop and mobile.
3. Critique against DESIGN-SYSTEM §3 and fix.

**Acceptance:** no unexplained findings. The screens folder is complete.

### 8.5 Evidence ⬜ (FR-EV-01)

**Steps:**
1. `docs/EVAL.md` final.
2. `/about/evidence` renders `manifest.json` metrics, confusion-matrix images, axe summary JSON (from CI artefacts, copied at build) and Bridge numbers.
3. `/about/credits` from `CREDITS.json`, plus the liblouis LGPL source link.

**Acceptance:** every number on the page traces to a file in the repo.

### 8.6 Docs for the team ⬜

**Steps:**
1. `README.md`: what it is, the feature list mapped to report figures, run locally (web, server, ml), deploy, architecture diagram link.
2. `docs/REPORT-UPDATES.md`: PRD §9 written as paste-ready paragraphs for the report.
3. Team-facing docs contain no tooling or authorship notes.

**Acceptance:** a fresh clone runs with `docker compose up` + `pnpm dev` following the README only.

### 8.7 Ship ⬜

**Steps:**
1. Private repo push (H1 identity; the pre-push hook passes).
2. Vercel production deploy, project `bridgify`, passcode gate ON (Q-01).
3. Backend production.
4. Smoke test on a phone and a laptop.
5. Hand the link and passcode to the team.

**Acceptance:** the smoke checklist (all 7 tools + Bridge + SOS) passes on the production URL.
