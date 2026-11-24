---
doc: prd
status: filled
last_updated: 2026-11-24
confidence: high
---

# Bridgify v2: product requirements

> **Source of truth:** the team's Sem 6 report, `docs/99-RAW/report/bridgify-report-sem6.pdf` (text copy: `bridgify-report-sem6.txt`). The mentor has read it, so **every claim in the report must be true in the build**. Where v2 goes further, the report wording that needs changing is listed in [§9](#9-report-deltas).
>
> **Truth labels:**
> - `[CONFIRMED]`: from the report, the Lovable brief or the team.
> - `[DECISION]`: recorded in `../04-DELIVERY/DECISIONS.md`.
> - `[ASSUMED]`: needs a check.
> - `[UNKNOWN]`: open question.
>
> **Acceptance format:** EARS ("When <trigger>, the system shall <response>").

## 1. What it is

Bridgify is a free, browser-based communication platform. It is for people who are Deaf, hard of hearing, mute, non-verbal, blind, low vision, autistic or dyslexic, and for the caregivers, teachers and doctors who talk with them. `[CONFIRMED]` (report §1.1, Abstract)

**Tagline:** *Speak Your Way. Be Heard Every Way.* `[CONFIRMED]` (Lovable brief)

**Aim** (report §1.2, word for word): "to build a single, free, browser-based platform that genuinely serves people with speech, hearing, vision, cognitive, and neurological differences by bringing six assistive communication tools together in one accessible interface, without compromising the quality or depth of any individual tool, and at zero cost to the user."

## 2. Who it is for

| Persona | Need | Main tools |
|---|---|---|
| **Deaf / hard of hearing** (ISL or ASL signer) | Follow speech and be understood by people who don't sign | Speech→Text, Sign→Text, Text→Sign, Bridge |
| **Mute / non-verbal** (incl. AAC users) | Say something urgent in one tap | Text→Speech quick access, SOS |
| **Blind / low vision** | Read and write braille; large, high-contrast UI | Text⇄Braille, Low Vision and High Contrast modes, screen-reader support |
| **Autistic** | Calm, predictable interface; express a feeling without words | Autism-Friendly and Calm modes, Gesture & Emotion, quick access |
| **Dyslexic** | Readable type and spacing | Dyslexia mode, TTS read-aloud |
| **Caregiver / educator / doctor** | Talk to all of the above; learn ISL or braille | Bridge, Tutorials, every tool |
| **Mentor / examiner** (project audience) | See that every claim works, live | All tools, the evidence page (`/about/evidence`) |

## 3. Scope

**In (v2):**
- the 7 tool pages:
  - Text→Speech
  - Speech→Text
  - Text→Braille
  - Braille→Text
  - Sign→Text
  - Text→Sign
  - Gesture & Emotion
- 12-mode personalisation
- Tutorials
- **Conversation Bridge**
- **SOS card**
- **offline PWA**
- the evidence page (model metrics and accessibility results)

**Out** (report §1.4 plus our decisions):
- Real-time sign-to-speech *video generation*.
- Continuous sentence-level sign *translation*. We recognise fingerspelling and a fixed word list; we do not translate sign language `[DECISION D-07]`.
- Accounts and logins. Nothing needs one `[CONFIRMED report §1.4]`.
- A native mobile app (the PWA covers it).
- A custom 3D avatar `[DECISION D-09]`.

## 4. Functional requirements

IDs are stable. Each requirement traces to a report section. Build-plan sub-phases cite these IDs.

### 4.1 Platform shell (report §3.2, §3.3 intro)

| ID | Requirement | Acceptance (EARS) |
|---|---|---|
| FR-SH-01 | Runs in any modern browser. No install, no account, no paid API | When a first-time visitor opens `/`, the system shall show the dashboard within 2 s on a 4G mid-range phone (LCP ≤ 2.5 s), with no sign-in prompt |
| FR-SH-02 | Sticky top bar: logo on the left, **Personalize** trigger (left panel), **Tutorials** trigger (right panel), **SOS** always visible `[CONFIRMED Lovable brief, report Fig 3.5.1]` | While scrolling any page, the bar and its three triggers shall stay visible and reachable by keyboard |
| FR-SH-03 | The dashboard lists the tools, a "who it's for" section, and Bridge as the featured action | When the user hides a tool in Personalize, its dashboard entry and nav link shall disappear and stay hidden on reload |
| FR-SH-04 | Every tool page has the same frame: back to home, title, one-line purpose, an input area, an output area, a quick-access tray, and a privacy strip that says where the data goes | When any camera or mic tool is active, the privacy strip shall say "Processed on this device" unless a server path is in use, in which case it shall say so |
| FR-SH-05 | Capability detection | When an API is missing (camera, mic, SpeechRecognition, WebGPU), the system shall show the fallback in use, or a plain explanation, never a blank screen |

### 4.2 Text to Speech (report §3.3.1, Fig 3.5.6, 3.5.6.1)

| ID | Requirement | Acceptance |
|---|---|---|
| FR-TTS-01 | Type text and hear it spoken with Web Speech `speechSynthesis` | When the user presses Speak, audio shall start within 300 ms on a local voice |
| FR-TTS-02 | A speed slider (levels 1–10) maps to `utterance.rate` (0.5–2.0) `[CONFIRMED]` | When the level changes mid-utterance, the next sentence chunk shall use the new rate |
| FR-TTS-03 | **Live caption bar** highlights each word as it is spoken | When a `boundary` event fires, the current word shall be highlighted. When no boundary events arrive within 400 ms, the system shall estimate word timing from the rate and chunk length |
| FR-TTS-04 | Controls: Speak Aloud, Pause/Resume, Repeat, Stop | Each control shall work by mouse, keyboard and touch, with its state announced to screen readers |
| FR-TTS-05 | Voice picker with language filter (English, Hindi, plus whatever the device has) | When a Hindi voice exists, Hindi text shall default to it |
| FR-TTS-06 | Quick Access chips speak on one tap. Categories: Common words, Phrases, Common sentences, Introduction, Greetings, Basic needs, Emergency `[CONFIRMED Fig 3.5.6.1]` | When a chip is tapped, it shall play immediately with no Speak press needed |
| FR-TTS-07 | Fallback: server gTTS `[CONFIRMED §3.3.1]` | When `speechSynthesis` is missing or has no voices, the system shall play `/api/tts` audio |

### 4.3 Speech to Text (report §3.3.2, Fig 3.5.7)

| ID | Requirement | Acceptance |
|---|---|---|
| FR-STT-01 | Tap the mic and transcribe live with Web Speech `SpeechRecognition`, interim and final results | When the user speaks, interim words shall appear within 500 ms |
| FR-STT-02 | **Smart punctuation** toggle | When enabled, the output shall have capitalised sentences, full stops after pauses ≥ 700 ms, and "?" after question words, plus Chrome `unspokenPunctuation` where available |
| FR-STT-03 | **Live caption overlay** toggle: a large, high-contrast caption band you can show full-screen | When caption mode is on, the latest 2 lines shall show at ≥ 32 px |
| FR-STT-04 | Speak Aloud, Copy, Clear, Download (.txt) | — |
| FR-STT-05 | **Whisper fallback** `[CONFIRMED §3.3.2]`: in-browser Whisper (`whisper-tiny.en` / `whisper-base`, transformers.js in a Web Worker), **downloaded only when the user opts in** (size shown first) `[DECISION D-04]` | When the browser has no working SpeechRecognition (Brave, Firefox Android, unsupported browsers) **or** the user picks "Noisy room", the system shall offer "Use on-device Whisper (≈40 MB, once)". After download it shall record 5 s chunks with MediaRecorder and transcribe them into the same box |
| FR-STT-06 | Languages: English (en-IN, en-US) and Hindi | Hindi uses the browser recognizer. The Whisper fallback is English-only in v2, and the UI says so |

### 4.4 Text ⇄ Braille (report §3.3.3, Fig 3.5.8–3.5.9.1)

| ID | Requirement | Acceptance |
|---|---|---|
| FR-BR-01 | Text → Unicode braille, **Grade 1 and Grade 2 (UEB)**, through **liblouis** on the Flask server `[CONFIRMED]` | When the user converts "HELLO, HOW ARE YOU?" (G1) and "THE RED FORT" (G2), the output shall equal liblouis 3.39 `en-ueb-g1.ctb` / `en-ueb-g2.ctb` output (golden tests) |
| FR-BR-02 | **Visual dot grid:** every cell is a 2×3 dot pattern (raised vs flat) with the source letter under it `[CONFIRMED]` | Each cell shall expose an accessible name, e.g. "dots 1 2 5, letter h" |
| FR-BR-03 | Copy, Speak Aloud, Download (`.txt` conversation log as in Fig 3.5.9.1, plus `.brf` for embossers) | The download shall list every conversion in the session: "[n] Input: … / Braille: …" |
| FR-BR-04 | **Braille → Text:** virtual 6-dot Perkins keyboard. Keys S D F J K L map to dots 3 2 1 4 5 6, chorded entry, Space, Backspace. Click or tap dots too. Back-translation through liblouis `[CONFIRMED Lovable "Braille to Text"]` | When the user chords F+J (dots 1 4), "c" shall appear. Grade 2 back-translation shall expand contractions |
| FR-BR-05 | **Hindi Bharati braille** (`hi-in-g1.utb`) `[DECISION D-11]` | When the table is "Hindi (Bharati)", Devanagari input shall translate |
| FR-BR-06 | Offline fallback: a small built-in **Grade 1** table in JS (≈2 KB). Grade 2 and Bharati need the server | When `/api` is unreachable, the system shall translate Grade 1 locally and say "Offline: Grade 1 only" |
| FR-BR-07 | *Stretch:* send output to a refreshable braille display over WebHID or Web Serial (Chromium) `[report §3.7 future work]` | Behind a "Connect display" button, shown only when the API exists |

### 4.5 Sign Language to Text (report §3.3.4, Fig 3.5.10)

| ID | Requirement | Acceptance |
|---|---|---|
| FR-SG-01 | On-device camera recognition: MediaPipe hand landmarks (21×3) go to a trained classifier, which returns a letter and a confidence `[CONFIRMED]`. **No frames leave the device** | When the camera runs, DevTools shall show no network requests carrying image or landmark data (Playwright test) |
| FR-SG-02 | **ASL fingerspelling** for 24 static letters (J and Z need motion, see FR-SG-06) | On the held-out-signer test, macro-F1 shall be ≥ 0.90 (published on `/about/evidence`) |
| FR-SG-03 | **ISL fingerspelling** for 23 static letters, two-handed (126 features + mask). This was "future work" in the report `[DECISION D-06]` | Held-out-signer macro-F1 shall be ≥ 0.90 |
| FR-SG-04 | **Live confidence** overlay on the video; "Not sure" below threshold `[CONFIRMED]` | Letters shall commit only after being held ≥ 700 ms at ≥ 0.80 smoothed confidence. A repeated letter needs the hand to drop or change in between |
| FR-SG-05 | Detected-text panel with Space, Speak Aloud, Copy, Clear, Backspace `[CONFIRMED]` | — |
| FR-SG-06 | *Cut from v2:* word-level sign recognition. It would need about 25 MB of extra models `[DECISION D-08]` | — |
| FR-SG-07 | Language chips: ASL and ISL are live. FSL, LSM, LIS and DGS show "recognition coming; use Text→Sign or Tutorials" `[CONFIRMED report §1.4 wording]` | — |
| FR-SG-08 | Reference strip: the alphabet chart for the selected language under the camera `[CONFIRMED Fig 3.5.10]` | — |
| FR-SG-09 | Labelled "**fingerspelling and sign recognition**", never "translation". Shows a note that it does not replace an interpreter `[DECISION D-07]` | — |

### 4.6 Text to Sign Language (report §3.3.5, Fig 3.5.11–3.5.16.1)

| ID | Requirement | Acceptance |
|---|---|---|
| FR-TS-01 | Six languages: **ASL, ISL, FSL (LSF), LSM, LIS, DGS** `[CONFIRMED]` | When the user enters HELLO (ASL), NAMASTE (ISL), AU REVOIR (FSL), AMIGO (LSM), SCUSA (LIS) or WASSER (DGS), a sign shall appear. These are the report's own §3.6 test cases |
| FR-TS-02 | Input is tokenised and each token looked up in that language's **JSON lexicon** `[CONFIRMED]` | — |
| FR-TS-03 | Output order: **(1) real signer video** from the curated lexicon, **(2) sign.mt pose animation** for words not in the lexicon, **(3) fingerspelling** cards, one per letter `[DECISION D-09]` | Each card shall show the gloss, the source and the licence credit |
| FR-TS-04 | Player: plays the sequence with play/pause, speed (0.5×–1.5×), loop and step | When reduced motion is on, it shall not autoplay |
| FR-TS-05 | **ISL gloss approximation**: drop articles and be-verbs, lemmatise, SOV order, time words first, question words last. Shown as a "Gloss" line | "Where is the hospital?" → `HOSPITAL WHERE` |
| FR-TS-06 | **Localised Quick Access** for each language (ISL in Hindi, FSL in French, LSM in Spanish, LIS in Italian, DGS in German, ASL in English), with English in brackets `[CONFIRMED]` | — |
| FR-TS-07 | Speak Aloud of the input in the matching spoken language `[CONFIRMED §3.6]` | — |
| FR-TS-08 | Disclaimer: "Word-by-word sign lookup. Not a substitute for an interpreter." `[DECISION D-07]` | — |

### 4.7 Gesture & Emotion (report §3.3.6, Fig 3.5.17)

| ID | Requirement | Acceptance |
|---|---|---|
| FR-GE-01 | Two pipelines on one camera stream, both on-device `[CONFIRMED]` | Combined pipeline shall run ≥ 15 fps on a mid-range laptop |
| FR-GE-02 | **Emotion:** 7 classes (Happy, Sad, Angry, Surprised, Fearful, Disgusted, Neutral) with confidence. MediaPipe **FaceLandmarker** (478-point face mesh + 52 blendshapes) feeds a transparent blendshape-to-emotion scorer `[DECISION D-05]` | Labelled "approximate". Shows the 3 blendshapes that drove the result |
| FR-GE-03 | **Gestures:** Thumbs Up, Thumbs Down, Open Palm, Pointing, Peace, Fist, **Wave**, plus I-Love-You. Classified from the **same hand landmarks** as Sign→Text with geometric rules (finger extension and thumb direction), with Wave as a motion rule. No extra model `[DECISION D-16]` | ≥ 90% correct on a 3-person × 8-gesture check. Wave = open palm with ≥ 3 changes of wrist x-direction within 1.2 s |
| FR-GE-04 | Each gesture maps to a meaning card (e.g. Thumbs Up = "Yes / I agree") and can be **spoken aloud** | This turns gesture detection into communication, not a demo |
| FR-GE-05 | Session log (time, gesture, emotion, confidence), exportable as CSV, kept on the device only | — |
| FR-GE-06 | Gesture reference cards `[CONFIRMED Fig 3.5.17]` | — |

### 4.8 Personalisation (report §3.3.7, Fig 3.5.2–3.5.2.2)

| ID | Requirement | Acceptance |
|---|---|---|
| FR-PZ-01 | **12 display modes** `[CONFIRMED Fig 3.5.2]`: Light, Dark, High Contrast, Solarized, Night Blue, Forest, Sepia, Calm, Focus, Low Vision, Autism-Friendly, Dyslexia | Every mode shall pass WCAG AA contrast for text (≥ 4.5:1) and UI (≥ 3:1). Checked by axe in CI for all 12 |
| FR-PZ-02 | **Dyslexia mode:** OpenDyslexic, letter spacing 0.05em (OpenDyslexic is already wide), word spacing 0.14em, line height 1.8, left-aligned, no justified text `[CONFIRMED]` | — |
| FR-PZ-03 | **Autism-Friendly and Calm modes:** muted palette and all animation off; **Focus mode:** dims everything except the active tool | When any of these is on, computed `animation-duration` shall be 0 everywhere |
| FR-PZ-04 | **Text-size slider** (80%–200%), all sizes in rem `[CONFIRMED]` | At 200%, no horizontal scroll at 320 px width (WCAG 1.4.10) |
| FR-PZ-05 | **Show/hide** each tool `[CONFIRMED Fig 3.5.2.2]` | — |
| FR-PZ-06 | Settings saved in localStorage with Zustand `persist` `[CONFIRMED]` | When the user reloads, all settings shall come back before first paint (no flash of the wrong theme) |
| FR-PZ-07 | Follows OS `prefers-reduced-motion`, `prefers-contrast` and `prefers-color-scheme` on first visit | — |
| FR-PZ-08 | Extras: an underline-links toggle and a large-cursor toggle | — |

### 4.9 Tutorials (report §1.3, Fig 3.5.3–3.5.5.1)

| ID | Requirement | Acceptance |
|---|---|---|
| FR-TU-01 | **Braille:** Grade 1 A–Z (cell plus dot numbers), numbers 0–9 (number sign ⠼), Grade 2 contractions (whole-word and part-word) `[CONFIRMED]` | — |
| FR-TU-02 | **Sign languages:** for each of the 6, A–Z fingerspelling, numbers, and **30 common phrases** `[CONFIRMED]` | 6 × (26 + 10 + 30) cards, each with media and credit |
| FR-TU-03 | **ISL regional scripts:** each ISL letter card shows the matching letter in the **22 scheduled Indian languages'** scripts `[CONFIRMED Fig 3.5.5.1]` | Fonts: Noto Sans for each script, loaded only when that script is selected |
| FR-TU-04 | Practice mode: show a letter, sign it to the camera, get it checked (reuses FR-SG) `[DECISION D-12]` | — |
| FR-TU-05 | Opened from the right-hand **Tutorials** panel and also as full pages under `/learn` | — |

### 4.10 New in v2

| ID | Requirement | Acceptance |
|---|---|---|
| FR-BG-01 | **Conversation Bridge:** two devices join a room with a 6-character code or QR | When device B enters A's code, both shall see "Connected" within 2 s |
| FR-BG-02 | Each side picks **how they receive** (text, speech, large captions, braille, or sign) and **how they send** (type, speak, fingerspell, quick phrases) | When A fingerspells "HELP", B (receive = speech) shall hear "help" |
| FR-BG-03 | Only **text, gloss and landmark packets** cross the network, never audio or video. A meter shows packet size (bytes/s) and latency (ms) | Average landmark-stream bandwidth shall be < 15 kbps (vs about 500+ kbps for video). Median relay latency shall be < 250 ms on the same Wi-Fi |
| FR-BG-04 | Optional "show my hands": landmark packets render as a live skeleton on the other device (a privacy-preserving "video") | — |
| FR-BG-05 | Rooms are temporary (they expire 30 min after the last activity). Nothing is stored on the server | — |
| FR-SOS-01 | **SOS card:** a one-tap full-screen card. Presets: "I am Deaf", "I need a doctor", "Call this number", allergies or medical notes. Shown as large text, ISL video, braille and spoken audio. Works offline | When SOS opens, it shall render within 300 ms from cache, offline |
| FR-SOS-02 | Optional location share (navigator.geolocation into a maps link) and an editable emergency contact, stored on the device only | — |
| FR-PWA-01 | Installable PWA. Every on-device tool works offline once its model is cached | Lighthouse PWA installable. Airplane-mode test: TTS, braille Grade 1, sign→text, SOS |
| FR-EV-01 | **Evidence page** `/about/evidence`: model metrics (macro-F1, confusion matrix, latency), accessibility results (axe per mode), Bridge bandwidth numbers, credits and licences | — |

## 5. Non-functional requirements

| ID | Area | Target |
|---|---|---|
| NFR-01 | Accessibility | WCAG **2.2 AA** in every mode (this covers the report's 2.1 AA claim). AAA contrast in High Contrast and Low Vision. Keyboard-only use of every tool. Visible focus. 44×44 px targets. ARIA live regions for every live output |
| NFR-02 | Performance | Shell JS ≤ 180 KB gzip. Models lazy-loaded per tool and cached with the Cache API. LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.05. Vision ≥ 24 fps on a laptop. Classifier ≤ 3 ms per frame |
| NFR-03 | Privacy | Camera and mic data stay on the device by default. Every server path is opt-in and labelled. No analytics, no cookies. Bridge packets are never logged |
| NFR-04 | Cost | Runs free: Vercel Hobby plus a free or owned backend. No paid API keys needed |
| NFR-05 | Browsers | Chrome, Edge, Firefox (desktop and Android), Safari (macOS and iOS) and Brave, each with documented fallbacks |
| NFR-06 | Reliability | No tool breaks if the backend is down (offline engines, then a clear message) |
| NFR-07 | Honesty | Every ML output shows a confidence. Every sign asset is credited. A limitations section in About |
| NFR-08 | Code quality | TypeScript strict, ESLint, Ruff, unit tests for all engines, e2e for every route. CI green before deploy |

## 6. Success measures (for the review)

1. The mentor can open the live link and use **all 7 tools plus Bridge** on a phone and a laptop.
2. Every report figure (3.5.1–3.5.17.1) has a matching working screen.
3. The evidence page shows real held-out accuracy, 0 serious axe violations across 12 modes × all routes, and Bridge bandwidth and latency numbers.
4. Two-phone Bridge demo: a signer fingerspells, the hearing partner hears it, and the partner's reply comes back as captions or braille.

## 7. User journeys

Detailed in `WORKFLOWS.md`:
- **W1:** non-verbal user, quick phrase
- **W2:** Deaf user follows a doctor
- **W3:** blind student braille round trip
- **W4:** fingerspell to speech
- **W5:** learning ISL
- **W6:** Bridge conversation
- **W7:** SOS
- **W8:** personalise once, used everywhere

## 8. Constraints

- **Stack** as the report states: React 18 + Vite, React Router v6, Zustand, Framer Motion, MediaPipe, Web Speech, Socket.IO, Flask, Flask-SocketIO, Flask-CORS, liblouis, Whisper. Swaps are recorded in §9.
- **Weight:** first load ≤ 180 KB JS. ML loads only on the page that needs it. The biggest model is MediaPipe's hand landmarker (7.8 MB, once, cached). Whisper downloads only on explicit opt-in `[CONFIRMED]`.
- **Patent:** the repo stays private, and the public link sits behind a passcode until the provisional is filed `[ASSUMED, see Q-01]`.
- **Content licences:** no Lifeprint, Handspeak, Spread The Sign, Sématos or DGS-Korpus media (their terms forbid it).

## 9. Report deltas

These are what the team should update in the report after v2. Each is stronger than the original claim.

| Report says | v2 does | Why |
|---|---|---|
| "custom TensorFlow.js ASL classifier" | Small classifier trained in PyTorch, exported as plain weights and run with **about 60 lines of JS** (no ML runtime) | Keeps the site light: about 100 KB instead of 2–10 MB of runtime `[D-03]` |
| Live recognition "currently works for ASL" | **ASL and ISL** fingerspelling | Future work done |
| Whisper on Flask as fallback | **Whisper in the browser** (opt-in download) | Future work done; private; no heavy server |
| face-api.js ExpressionNet | MediaPipe FaceLandmarker blendshapes, then a 7-class scorer | face-api.js is unmaintained since 2022. This reuses the MediaPipe runtime already loaded |
| Text→Sign "static sign cards / emoji" | Real signer video, then pose animation, then fingerspelling | Future work done |
| No offline mode | PWA offline | Future work done |
| MediaPipe Python/OpenCV on the server | Not needed: all vision runs in the browser | Simpler and more private |
| WCAG 2.1 AA | WCAG 2.2 AA, tested in CI | Newer standard, superset |
| — | Conversation Bridge, SOS, Braille→Text, Hindi Bharati braille, evidence page | New |
