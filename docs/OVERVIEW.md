# Bridgify v2: the whole thing, in plain language

This page is for people. Read it once and you will know:
- what each part does
- how it works underneath
- which code matters most
- what to say when someone asks "how does this work?"

---

## 1. The product in one minute

Bridgify is a website that turns a message into whatever form the other person can receive:

| You have… | Bridgify gives… | Tool |
|---|---|---|
| Typed text | Speech, with the words lit up as they're spoken | Text to speech |
| Someone's speech | Live captions with punctuation | Speech to text |
| Text | Braille (Grade 1, Grade 2, Hindi Bharati) as dots, a file, or a download for embossers | Text to braille |
| Braille typed on 6 keys | Text and speech | Braille to text |
| Fingerspelling on camera (ASL or ISL) | Letters, words, speech | Sign to text |
| Text | Sign videos, sign animations or fingerspelling in 6 sign languages | Text to sign |
| A hand gesture or facial expression | Its meaning, spoken aloud | Gesture & emotion |

**On top of the tools:**
- **12 display modes:** dyslexia, autism-friendly, low vision, high contrast and others.
- **Tutorials** for braille and 6 sign languages.
- **Bridge:** two phones, one conversation, each person picks how they receive.
- **SOS card.**
- **Offline use** once installed.

---

## 2. Three ideas hold it together

1. **Everything sensitive happens on your device.** The camera and microphone are processed in the browser. The server only does:
   - braille translation
   - a backup voice
   - grammar for sign glosses
   - passing short Bridge messages between two phones
2. **There's always a plan B.** Every tool has a fallback, and it tells you which one it's using. Examples:
   - The server is asleep: braille Grade 1 still works offline.
   - Your browser has no speech recognition: an on-device Whisper model is offered.
   - A sign has no video: an animation plays. No animation either: fingerspelling.
3. **Light on purpose.** The first load is tiny. Heavier pieces (the hand-tracking model, the face model, Whisper) download only on the page that needs them, once, and are cached.

---

## 3. How each part works

### Text to speech
- The browser's built-in voices do the speaking (Web Speech API).
- Text is split into sentences so long passages don't cut off. This is a known Chrome bug.
- For the moving highlight, the browser reports each word as it is spoken. Some voices don't report words, so the app estimates the timing instead.
- Quick-access phrases speak on one tap.
- If the device has no voices, the server makes an MP3 with gTTS.

### Speech to text
- The browser's speech recognizer turns speech into words.
- Our "smart punctuation" adds full stops at pauses and question marks after question words.
- Brave blocks the recognizer and some phones lack it. In those cases the app offers to download a small **Whisper** model (~40 MB, once) and transcribes 5-second chunks on the device.

### Braille
- The server runs **liblouis**, the open-source braille engine used by screen readers worldwide. It translates text to Grade 1 or Grade 2 braille, or Hindi Bharati braille.
- The page draws each braille cell as six dots, with the raised ones filled, so sighted helpers can read it too.
- **Braille to text** uses the Perkins layout. The keys S D F J K L are dots 3 2 1 4 5 6. Press keys together and release, just like a real Perkins brailler.

### Sign to text: the real machine-learning part
1. **Find the hand.** Google's MediaPipe hand model finds 21 points on each hand (wrist, knuckles, fingertips) about 30 times a second, inside the browser.
2. **Describe the hand shape.** We turn those points into numbers that don't care where the hand is or how big it looks:
   - points relative to the wrist
   - scaled by hand size
   - left hands mirrored
   - plus finger angles and fingertip distances
3. **Classify it.** A small neural network (an MLP, about 25,000 numbers) that **we trained** says which letter it is and how sure it is. It runs in about 60 lines of JavaScript, so it needs no heavy ML library.
4. **Commit a letter only when it's steady.** It must be held for 0.7 s at 80% or higher confidence. Otherwise the app shows "Not sure" and the top 3 guesses to tap.

**How the model was made** (details in `03-SYSTEM/ML-PIPELINE.md`):
- **Data:** public multi-signer datasets (ASL-HG, an ISL landmark set). There were no team recordings (D-27).
- **Training:** in Python, with augmentation (rotation, scaling, jitter).
- **Testing:** on **people the model never saw**. That held-out number is the honest accuracy, published on the Evidence page.
- **Parity check:** an automated test proves the browser computes exactly the same numbers as Python did in training.

ISL letters use both hands, so the ISL model reads two hands at once.

### Text to sign
1. Your sentence is split into words. For ISL, the browser first reorders it into approximate ISL grammar ("Where is the hospital?" → HOSPITAL WHERE).
2. Each word or stored phrase is looked up, in this order:
   1. A **stored sign**: an animation kept in the site (prepared from sign.mt), or for German Sign Language a real signer video from SignDict.
   2. If there is none, a **live animation** from the free sign.mt service.
   3. If there is none, **fingerspelling**, letter by letter.
3. Every sign shows where it came from. A note says this is a word-by-word lookup, not an interpreter.

### Gesture and emotion
- The **same hand points** tell us the gesture through simple geometry, e.g. "only the index finger is straight" = pointing. A **wave** is an open palm moving side to side.
- Emotion uses Google's face model, which outputs 52 "face movement" scores (smile, brow raise, jaw open…). A small trained model (logistic regression on KDEF photos) turns them into one of 7 emotions: macro-F1 0.744 on 20 people it never saw.
- It is labelled **approximate**, and it shows which face movements drove the guess.

### Personalisation
- One setting changes the whole site, because every colour and size comes from a theme variable.
- Settings are saved in the browser and applied before the page appears, so the wrong colours never flash.
- Calm, Focus and Autism modes switch off all animation.

### Bridge (new)
1. Phone A starts a conversation and shows a 6-letter code and a QR.
2. Phone B joins.
3. Each person chooses **how they send** (type, speak, fingerspell, quick phrases) and **how they receive** (captions, speech, braille, signs).
4. Messages go **directly from phone to phone** (WebRTC). A free PeerJS server only introduces the two phones. A text message is about 120 bytes, and each phone converts it on arrival. Two tabs on one laptop can also talk, for demos.
5. An optional "show my hands" mode sends hand **points** instead of video, at under 15 kbps, versus hundreds of kbps for video.

The meter on screen shows the real bandwidth and delay. This per-person conversion of one conversation is the idea the team may patent.

### SOS (new)
One tap shows a full-screen card ("I am Deaf, please write") with an ISL clip, braille and a speak button, plus location share and call contact. It works offline.

---

## 4. The parts of the code that matter most

| If you touch… | Be careful because… |
|---|---|
| `web/src/engines/vision/features.ts` **and** `ml/bridgify_ml/features.py` | They must stay identical, or the model sees different numbers than it was trained on. The parity test guards this |
| `web/src/engines/vision/committer.ts` | Decides when a letter "counts". Too eager means wrong letters; too slow feels laggy |
| `web/src/design/modes.css` + `scripts/contrast-check.ts` | All 12 modes and their contrast guarantees |
| `web/src/engines/speech/tts.ts` | Browser speech bugs live here (Chrome cut-offs, missing word events) |
| `server/bridgify/services/louis_svc.py` | Braille correctness. Golden tests lock the output |
| `server/bridgify/realtime/bridge.py` | Rooms, limits, and the rule that messages are never logged |
| `content/CREDITS.json` | Every sign image and video must be credited; CI checks it |
| `web/public/models/manifest.json` | Which model versions ship, their checksums and their measured accuracy |

---

## 5. The build, phase by phase

| Phase | What it delivers | Why in this order |
|---|---|---|
| 0 Foundation | The site shell, 12 modes, settings, the server skeleton, a first deploy | Everything sits on this |
| 1 Vision + ML | Camera, hand tracking, the data collector, trained letter models, Sign to text | Hardest and riskiest, so first. The team's recording session runs in parallel |
| 2 Gesture & emotion | Gesture rules, the face model, the emotion scorer | Reuses phase 1's camera pipeline |
| 3 Speech | Text to speech, speech to text, Whisper opt-in | Independent; ready for Bridge |
| 4 Braille | liblouis server, dot grid, Perkins keyboard, Bharati | Independent; ready for Bridge |
| 5 Text to sign | Licensed media, sign animations, ISL grammar | Content-heavy; Bridge needs it |
| 6 Home + tutorials | The live "every way" demo, braille and sign lessons, practice | Uses all the engines above |
| 7 Bridge, SOS, offline | Two-phone conversations, emergency card, install/offline | Combines everything |
| 8 Hardening | Accessibility sweep, speed, security, evidence page, docs, launch | Proof that it all works |

The full checklist, with acceptance tests for every step, is in `04-DELIVERY/BUILD-PLAN.md`.

---

## 6. Answers for the viva

- **"Is the sign recognition real?"** Yes. The model was trained by the team on hand landmarks and tested on people it never saw. The accuracy and confusion matrix are on the Evidence page.
- **"Does video go to a server?"** No. Hand and face models run in the browser. You can open DevTools and watch the network while the camera runs.
- **"Why not translate full sign language?"** Sign languages have their own grammar, including the face and body. Claiming translation from fingerspelling would mislead people. The Deaf community has asked developers not to do this.
- **"What's new compared to existing apps?"** One free browser tool covering all directions; Indian focus (ISL, Hindi, Bharati); 12 accessibility modes; and Bridge, which sends hand points, not video, with each receiver choosing their own format.
- **"Is it accessible itself?"** Automated WCAG 2.2 AA checks run on every page in all 12 modes, plus manual screen-reader tests. Results are on the Evidence page.
