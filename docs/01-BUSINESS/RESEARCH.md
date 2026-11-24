---
doc: research
status: filled
last_updated: 2026-11-24
confidence: high
---

> **Note:** this records what the research found. Some options were later cut to keep the site light: onnxruntime-web, Human, Piper, the GestureSign word model, server Whisper and the liblouis WASM build. See `../04-DELIVERY/DECISIONS.md` D-03, D-04, D-05, D-08, D-16 and D-19.

Four research tracks, checked against gh / npm / PyPI / official docs on 24 Nov 2026.
[V] = verified in source, [I] = inferred. Not legal advice.

## 1. Patent reality (India)

- **Software per se is barred** by S.3(k). Under the CRI Guidelines 2025 (29 Jul 2025) a claim needs a technical solution to a technical problem, and an effect beyond the UI (Ab Initio 2024; Raytheon 2023). [V]
  https://ipindia.gov.in/frontend/pdf/patents/guidelines/GUIDELINES%20FOR%20EXAMINATION%20OF%20COMPUTER%20RELATED%20INVENTIONS%20%28CRIs%29%20-%202025.pdf
- **Novelty is absolute.** The S.31 grace period covers only govt-notified exhibitions and papers read before a learned society. A public website, a public repo, a demo day or a normal paper all count as disclosure. [V]
  https://www.intepat.com/blog/grace-period-under-section-31-of-the-patents-act-in-india
  → **File the provisional before making the link or repo public.** Anything already public from v1 is prior art.
- **Fees for a natural person or educational institution (e-filing)** [V], from the Schedule 1 PDF on ipindia.gov.in:
  - Form 1: ₹1,600
  - Form 18 (examination): ₹4,000
  - Form 9 (early publication): ₹2,500
  - The complete specification is due within 12 months of the provisional.
- **University of Mumbai IPR policy:** a student invention made using university resources vests in the university. Disclose it to the IPR cell. [V]
  https://mu.ac.in/old/wp-content/uploads/2022/07/IPR-policy_UoM-F.pdf
- **Already taken (prior art):**
  - US9111545B2 (TCS): sign/braille/text/audio converted per the recipient's profile. **This is the closest match.**
  - US8793118B2: adaptive multimodal assist.
  - US12437673: bidirectional sign translation across two devices.
  - US12518653B2 (Sign-Speak): MediaPipe keypoints + avatar.
  - US12597365B2: MediaPipe keypoints with confidence-scored glosses.
  - CN202998144U.
  - Indian student filings are mostly glove or speech-to-sign systems.
- **Claimable angle** [I]: a two-device cross-modal relay. It works like this:
  - On-device sign capture sends only a compact landmark/gloss/confidence packet (no video).
  - The receiver's profile router renders that packet as sign, speech, text or braille HID output.
  - If confidence is low, a fingerspelling confirm loop kicks in.
  - Model tier and frame rate adapt to latency.
  - It must be backed by **measured** numbers: kbps vs video, end-to-end latency, CPU load.
- **Alternatives:**
  - Copyright the code (Form XIV, ₹500).
  - GUI design registration, only when applied to an article (Calcutta HC, Mar 2026).

## 2. Sign → Text

- **Hand landmarks:** `@mediapipe/tasks-vision@1.2.3` (22 Nov 2026). Pin the wasm path to the same version, run it in a Web Worker, and mirror only the CSS preview (mirroring the frame flips handedness). [V]
  - Models: `storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, `.../gesture_recognizer/.../gesture_recognizer.task`
- **ASL letters:** train our own landmark MLP. It trains in seconds to minutes on CPU.
  - Stopgap: HF `nocontextdoruk/asl-landmark-mlp` (63 features, A–Z plus 0–9), but it is **CC-BY-NC**.
  - Avoid: GPL repos and repos with no license.
  - Data: our own webcam collector (5–10 signers), plus the ASL-HG dataset (a participant-disjoint baseline reaches 90.5%).
- **ISL letters:** 126 features (two hand slots, assigned by geometry rather than the handedness label, plus a presence mask).
  - Data: Kaggle `dwibonbhargabdeka/isl-dataset-mediapipe-hand-landmarks` (CC BY-SA, 6 signers, 23 static letters; reported 0.99 F1 on a held-out signer).
  - `hp-creates/isl-translator` (MIT) is a useful reference.
- **ASL words:** `shashank11yadav/GestureSign` (MIT) ships `model.onnx` (5.6 MB, 250 signs, Holistic + onnxruntime-web, 72% top-1 on unseen signers). Restrict its output to our phrase vocabulary.
- **ISL words:** INCLUDE (CC-BY-4.0, 263 words) with a small GRU on landmark sequences for 20–30 words. Expect 60–80%. [I]
- **Pipeline:**
  1. Normalize: subtract the wrist, divide by the 0→9 distance, mirror the left hand, down-weight z.
  2. Augment: ±15° rotation, scale, jitter.
  3. Evaluate on a **held-out signer**.
  4. Smooth over 10–15 frames, then commit when the sign is held at ≥0.8 for 600–800 ms. Below that, show "not sure".
  5. J and Z need motion.
- **Framing:** call it "fingerspelling recognition", not "sign language translation". The Deaf community pushes back on overclaiming (arXiv 2512.08839, ASSETS'23).

## 3. Text → Sign

- **sign.mt API** [V]: `GET https://us-central1-sign-mt.cloudfunctions.net/spoken_text_to_signed_pose?text=…&spoken=en&signed=ase`
  - Returns a `.pose` file with CORS `*`, rendered by the `pose-viewer` web component (MIT).
  - Signed-language codes: ase, ins, fsl (needs spoken=fr; it returns 500 for unknown words), mfs, ise, gsg.
  - It has no SLA, so cache responses and credit it. The app code is CC BY-NC-SA.
- **Real signer clips** (curated lexicon of {gloss, url, license, credit}, self-hosted):
  - ASL: ASL Signbank (CC BY-NC-SA).
  - ISL: ISLRTC dictionary (allowed for research and tech with credit, not for resale).
  - DGS: SignDict GraphQL API (CC per video; copy to our own CDN).
  - LSF: Wikimedia Commons (Lingua Libre and the Elix subset).
  - **No:** Lifeprint, Handspeak, Spread The Sign, Sématos, DGS-Korpus (license forbids).
- **Fingerspelling images:**
  - ASL: Commons `Category:ASL_letters` (public domain).
  - LSF: `Category:French_manual_alphabet` (CC BY-SA).
  - DGS: `Category:German_manual_alphabet` (CC BY-SA).
  - LSM: Zenodo 10.5281/zenodo.10067509 (CC BY).
  - LIS and ISL: no open image sets, so use sign.mt letters.
- **ISL gloss rules** (about 50 lines with spaCy): drop articles and be-verbs, lemmatize, SOV order, time words first, question words and negation last. Label the result a "gloss approximation".
  - Reference: jigargajjar55/Audio-Speech-To-Sign-Language-Converter (MIT).
- **Avatars:**
  - A custom three.js/VRM avatar is 2–3 weeks of work, so it is out of scope.
  - CWASA/SiGML needs expert authoring, so it is out too.
- **Deaf community** (WFD/WASLI 2018): avatars are not interpreters. So show real signer video first, then a "word-by-word sign lookup" label, credits, and a "not a substitute for an interpreter" note.

## 4. Rest of the stack

| Feature | Primary | Fallback | Notes |
|---|---|---|---|
| TTS | Web Speech + `boundary` | `kokoro-js@1.2.1` (English, about 92 MB q8), `@mintplex-labs/piper-tts-web@1.0.5` with `hi_IN` voices | Chrome network voices fire no word boundaries and cut off after about 15 s. Prefer `localService` voices, chunk by sentence, and estimate timings when none arrive |
| Server TTS | gTTS 2.5.4 | — | May get 429 errors from cloud IPs |
| STT | Web Speech (`processLocally`, Chrome 139+; Firefox 160+) | `@huggingface/transformers@4.3.2` Whisper in a worker (WebGPU, else WASM) | **Brave fails with a network error**, so detect it and route to Whisper. Safari is prefixed only. Hindi needs whisper-small or turbo |
| Punctuation | Chrome `unspokenPunctuation` | rule-based: pause timing and question words | The HF punctuation model is 268 MB, which is too heavy |
| Braille (server) | liblouis 3.39 via Debian `python3-louis` (trixie-backports) | build `liblouis/python` | **Never `pip install louis`** (it is an unrelated 2013 package). Tables: `unicode.dis,en-ueb-g1.ctb` / `en-ueb-g2.ctb`, Hindi `hi-in-g1.utb`. Back-translation via `backTranslateString` |
| Braille (client) | own Emscripten build of 3.39 | — | npm `liblouis@0.4.0` is broken on G2. LGPL means we ship the source |
| Gesture | MediaPipe GestureRecognizer | — | Built-in classes: Closed_Fist, Open_Palm, Pointing_Up, Thumb_Down, Thumb_Up, Victory, ILoveYou. **Wave is custom:** open palm plus 3 or more wrist x-velocity sign flips within about 1 s |
| Emotion | `@vladmandic/human@3.3.6` (7 classes) | FaceLandmarker blendshape rules | face-api.js is dead. Label results "approximate" |
| Fonts | `@fontsource/atkinson-hyperlegible-next`, `@fontsource/opendyslexic` | — | OFL |
| A11y proof | `@axe-core/playwright@4.14` across every route × every mode, Lighthouse CI | manual keyboard and screen-reader pass | axe catches about 57% of issues. Target WCAG 2.2 AA |
| Hosting | Vercel (web) + Render free (Flask, 512 MB, sleeps after 15 min) | Railway ($1 credit) | HF Docker Spaces now need PRO. Fly has no free tier. Server-side Whisper won't fit in 512 MB, so Whisper runs in the browser |

## 5. Competitors

- sign.mt/Rylo
- Google SL2T (Pixel, Aug 2026)
- Ava (rooms via QR)
- MS Translator (5-digit room code)
- Hand Talk
- India: Ishaara (on-device ISL), IIIT-H SignPlug (ISL avatar), ISLRTC, Bhashini
- Student GitHub all-in-ones have about 0 stars and are Flask demos.

No one combines ISL + Hindi + Bharati braille + a deaf-blind braille display path in the browser. [I]
