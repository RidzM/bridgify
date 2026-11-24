---
doc: integrations
status: filled
last_updated: 2026-11-24
confidence: medium
---

# Integrations

All of these are free (D-18). None needs a paid key.

| Service | Used for | Auth | Env var | Limits / risk | Fallback |
|---|---|---|---|---|---|
| Vercel (Hobby) | Hosting the web app | Vercel CLI login | — | Hobby is for non-commercial use (fine for a student project) | Netlify / Cloudflare Pages |
| Vercel Functions (Hobby, Python) | The gTTS voice fallback (`web/api/tts.py`) | — | — | Cold start on first use | Browser voices |
| PeerJS public broker (`0.peerjs.com`) | Introduces the two phones in Bridge; messages then go phone to phone (D-37) | none | — | Free, no SLA | Same-device tab mode (BroadcastChannel) |
| GitHub (public repo `RidzM/bridgify`, D-25) | Code | Token (repo scope) | — | Actions workflows are not pushed (the token has no workflow scope) | Run tests locally |
| SignDict (DGS) | Some German Sign Language word videos, stored in the repo with credit | none | — | Per-video licence, listed on the credits page | Animations and fingerspelling |
| sign.mt public API | Text→pose: prepared once for the stored lexicons, and called live from the browser for other words | none | — | No SLA; returns 500 for some single words (e.g. ISL "namaste"); app code is CC BY-NC-SA (we only call the API and credit it) | Stored animations, then fingerspelling |
| gTTS (Google Translate TTS endpoint) | Server TTS fallback | none | — | Unofficial; may get 429 from cloud IPs | Browser voices |
| Google model bucket (`storage.googleapis.com/mediapipe-models`) | Source of the `.task` files (copied into `public/models`) | none | — | Apache-2.0 | Self-hosted copy |
| Hugging Face Hub | Whisper tiny.en weights (opt-in) | none | — | Rate limits for anonymous use | Message to retry |
| Kaggle | Training datasets (download once, offline) | Kaggle account (team) | — | Licences per dataset (ML-PIPELINE §3.1) | Own recordings |
