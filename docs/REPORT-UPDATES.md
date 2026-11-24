# Report updates for Bridgify v2

The Sem 6 report describes the first version of Bridgify. v2 keeps every feature the report promises. Some features now work differently, usually better, and there are new ones. This file gives paste-ready text for each report section that should change. Every number comes from `docs/EVAL.md` or the evidence page (https://bridgify-vcet.vercel.app/about/evidence).

---

## Abstract: add after the first paragraph

> The deployed version runs entirely in the browser at https://bridgify-vcet.vercel.app. Its fingerspelling recognisers reach a macro-F1 of 0.962 (ASL) and 0.989 (ISL) on signers they never saw during training. Braille output is produced by liblouis 3.39 compiled to WebAssembly and matches the native library on all 59 reference cases. Every page passes automated WCAG 2.2 AA checks in all twelve display modes.

## 1.4 Scope: replace the paragraph on live recognition

> Live camera recognition works for **ASL and ISL fingerspelling**: 24 static ASL letters (J and Z involve movement and are typed), and 23 ISL letters signed with two hands (all except H, J and Y, which the training data does not include). Text to Sign covers all six languages (ASL, ISL, FSL, LSM, LIS, DGS) with sign animations, falling back to fingerspelling. Physical braille displays and continuous sentence-level sign translation remain out of scope.

## 2.3 Mini project contribution: add

> **Conversation Bridge.** Two phones join one conversation with a six-character code. Each person chooses how they send (typing, speaking, fingerspelling or quick phrases) and how they receive (captions, speech, braille or sign). Messages travel directly between the two devices. When the signer shares their hands, only hand-point coordinates are sent, never video.
>
> **SOS card.** A one-tap emergency card that shows a chosen message as large text, braille and a sign, speaks it aloud, and can share the person's location. It works offline.

## 3.1 / 3.2 Architecture: replace "Flask backend" paragraph

> Bridgify is a React 18 single-page application, built with Vite and hosted on Vercel's global CDN.
>
> All computer vision and machine learning run in the browser inside Web Workers: MediaPipe hand and face landmarkers, and small classifiers executed directly in JavaScript. liblouis runs in the browser as WebAssembly. A small Flask function on Vercel provides the gTTS voice fallback for devices without speech voices.
>
> No camera or microphone data is sent to a server. The app can be installed as a Progressive Web App and works offline once its models are cached.

## 3.3.1 Text to Speech: append

> Long text is spoken sentence by sentence, so browsers do not cut it off. When a voice does not report word timings, the caption still follows along using estimated timing. Quick phrases are available in English and Hindi.

## 3.3.2 Speech to Text: replace the fallback sentences

> When the browser cannot recognise speech itself (for example Brave), or the room is noisy, the user can switch on **on-device recognition**. This is OpenAI's Whisper model (tiny.en), run inside the browser with Transformers.js. It downloads once (about 40 MB), then works offline, and no audio leaves the device.

## 3.3.3 Text to Braille: replace the first sentence and add

> Input is translated by **liblouis 3.39 compiled to WebAssembly**, using the same tables as the native library: Unified English Braille Grade 1 and Grade 2, and Hindi Bharati braille. A set of 59 reference translations is checked against native liblouis on every build, and all match. Output can be copied, downloaded as a text log or as a .brf file for embossers.
>
> **Braille to Text** lets users write braille on six keys (S D F J K L), as on a Perkins brailler, or by tapping dots on a touch screen. The cells are back-translated to text and can be spoken aloud.

## 3.3.4 Sign Language to Text: replace "custom TensorFlow.js ASL classifier"

> Hand landmarks from MediaPipe (21 points per hand) are normalised for position, size and hand side. They are turned into 91 features per hand: coordinates, 15 joint angles, 10 fingertip distances and the palm direction. These go to a small classifier that runs directly in JavaScript, with no ML library needed in the browser:
> - **ASL:** a neural network with layers 91 → 128 → 64 → 24.
> - **ISL:** a logistic regression over two hands, 184 features.
>
> Predictions are smoothed over time. A letter is accepted only after it has been held for 0.7 seconds at 80% confidence or more. When the recogniser is unsure, it says so and offers its top three guesses to tap.
>
> **Training and testing** used public datasets with separate people for testing: ASL-HG (10 signers) and an ISL landmark dataset (7 signers). On signers never seen in training, macro-F1 is **0.962 for ASL** and **0.989 for ISL**. The browser computes exactly the same features and outputs as the Python training code; 100 automated parity tests check this.

## 3.3.5 Text to Sign Language: replace "emoji-annotated sign diagrams"

> Each word is first looked up in a per-language lexicon of prepared sign animations, generated with the open sign.mt project and stored in a compact format of about 20 KB per word. Words not in the lexicon are fetched live from sign.mt, and anything still unknown is fingerspelled letter by letter.
>
> For ISL, the input is first rearranged into an approximate ISL word order. Articles and forms of "be" are dropped, time words go first, question words go last and the verb goes at the end. For example, "Where is the hospital?" becomes HOSPITAL WHERE. A note reminds users that this is a word-by-word lookup, not an interpreter.

## 3.3.6 Gesture & Emotion: replace the model description

> One camera stream feeds two pipelines in a Web Worker:
> - **Gestures** (thumbs up, thumbs down, open palm, pointing, peace, fist, I-love-you and wave) are recognised from hand-landmark geometry. Measured on 626 people not used for tuning (HaGRID), accuracy is **97.3%**.
> - **Facial expression** (7 classes) comes from the 52 face-movement scores of MediaPipe's face landmarker, classified by a small trained model. It reaches a macro-F1 of **0.744** on 20 people not used for training (KDEF), and is labelled as approximate in the interface.
>
> Each recognised gesture can be spoken aloud as a meaning, for example thumbs up means "Yes, I agree". A session log can be exported as CSV.

## 3.3.7 Personalisation: append

> All twelve modes are checked automatically for colour contrast (12 colour pairs per mode, WCAG AA; AAA for High Contrast and Low Vision). Every page is checked with axe in all twelve modes. Text can be enlarged to 200% with no horizontal scrolling on a 320 px screen.

## 3.4 Hardware & Software: software list changes

- **Frontend:** React 18, Vite 8, React Router 6, Zustand, Motion, Tailwind CSS 4, MediaPipe Tasks Vision 1.2.3, Transformers.js (Whisper), liblouis 3.39 (WebAssembly), PeerJS (Bridge).
- **Server side:** a Flask function on Vercel for the gTTS fallback.
- **Training:** Python 3.12, MediaPipe, PyTorch, scikit-learn.
- **Datasets:**
  - ASL-HG (CC BY 4.0)
  - ISL MediaPipe landmark dataset (CC BY-SA 4.0)
  - HaGRID (CC BY-SA 4.0)
  - KDEF (research use)
  - Sign animations from sign.mt

## 3.5 Results: new figures you can add

- **Fig: Home composer:** one message as speech, braille, fingerspelling and large print.
- **Fig: Sign to text:** recognising fingerspelling with a live confidence ring.
- **Fig: Text to sign:** an animated sign figure for each word.
- **Fig: Conversation Bridge on two phones.**
- **Fig: Evidence page:** accuracy and confusion matrices.

All screenshots are in `docs/screens/`, and the user guide has them too.

## 3.6 Analysis: replace with measured results

| Feature | Test | Result |
|---|---|---|
| Text to braille | 59 reference cases vs native liblouis | 59 / 59 identical |
| Sign to text (ASL) | held-out signers P9–P10, 4,799 frames | macro-F1 0.962 |
| Sign to text (ISL) | held-out signer, 1,150 frames | macro-F1 0.989 |
| Gestures | 626 held-out people, 9,467 hands | 97.3% |
| Expression | 20 held-out people, 838 images | macro-F1 0.744 |
| Accessibility | axe on every page × 12 modes | 0 serious or critical issues |
| Performance (Lighthouse, mobile) | home page | 96 performance, 100 accessibility, 100 best practices |

## 3.7 Future work: remove what is now done

These items are done and can be removed from future work:
- ISL live recognition
- on-device Whisper
- sign video output (now animations)
- offline mode

**Keep:**
- word- and sentence-level sign recognition
- physical braille displays (Web Serial)
- Deaf-led review of the sign content
