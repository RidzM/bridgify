---
doc: changelog
status: filled
last_updated: 2026-11-24
confidence: high
---

# Changelog

User-visible changes on https://bridgify-vcet.vercel.app, newest first.

## 2026-11-24 (evening): Phases 5–8

- **Text to sign** in six sign languages (ISL, ASL, FSL, LSM, LIS, DGS). Stored sign animations for everyday words and phrases, German signer videos, live sign.mt requests for other words, then fingerspelling. ISL sentences are first put into approximate ISL word order.
- **Learn:**
  - Braille: alphabet, numbers, Grade 2 contractions and a quiz.
  - Sign: everyday phrases in six languages; alphabets for ISL, ASL, FSL and DGS (ISL letters also shown in 22 Indian scripts); numbers for ISL and ASL; camera practice for ISL and ASL.
  - LSM and LIS have no openly licensed alphabet pictures, and their pages say so and point to the animated signer.
- **Conversation Bridge:** two phones join one conversation with a code or QR. Each person picks how they send (type, speak, quick phrases, fingerspell) and how they receive (captions, speech, braille, sign). Phone to phone, with nothing stored. A second-tab mode lets one laptop demo it.
- **SOS:** emergency cards with Speak, full-screen view, signs, an emergency contact to call, and location sharing. Works offline.
- **Install and offline:** the site installs like an app. After one visit, SOS, text to speech, braille and (after one use) the camera tools work without internet. When a new version is ready, a Reload prompt appears.
- **About, Privacy, Evidence and Credits** pages.
- **Sign to text:** an alphabet reference under the camera; the page says which letters are typed instead (J and Z for ASL; H, J and Y for ISL).
- **Polish:**
  - Text no longer shifts as fonts load.
  - The home braille dots animate only for new letters.
  - The signer figure is drawn as a person.
  - About pages have a comfortable line length.
- **Security:** a strict Content-Security-Policy, and React Router 7 (two advisories cleared).

## 2026-11-24 (afternoon): Phases 0–4

- New app shell with 12 display modes, Display settings and the home composer.
- Text to speech, Speech to text (with optional on-device Whisper), Text ⇄ braille (liblouis in the browser: Grade 1, Grade 2, Hindi Bharati), Sign to text (ASL and ISL fingerspelling), Gesture and emotion.

## 2026-11-24 (morning)

- Planning for v2: requirements, architecture, ML pipeline, design system, build plan, decisions, research. No user-visible changes yet.
