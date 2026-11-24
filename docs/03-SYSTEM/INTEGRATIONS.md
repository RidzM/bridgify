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
| Render (free) **or** an existing server (Q-03) | Hosting the Flask API (Docker) | Account / SSH | `ALLOWED_ORIGINS`, … | Render free sleeps after 15 min (~30–60 s wake-up) and has an ephemeral disk | Web tools degrade gracefully (D-19, offline engines) |
| GitHub (private repo) | Code, CI (Actions minutes on the free plan) | Token (Q-02) | — | Private-repo Actions minutes are limited (2,000/month) | Run e2e locally |
| sign.mt public API | Text→pose for words not in the lexicon | none | `POSE_UPSTREAM` | No SLA; app code is CC BY-NC-SA (we only call the API and credit it) | Fingerspelling |
| gTTS (Google Translate TTS endpoint) | Server TTS fallback | none | — | Unofficial; may get 429 from cloud IPs | Browser voices |
| Google model bucket (`storage.googleapis.com/mediapipe-models`) | Source of the `.task` files (copied into `public/models`) | none | — | Apache-2.0 | Self-hosted copy |
| Hugging Face Hub | Whisper tiny.en weights (opt-in) | none | — | Rate limits for anonymous use | Message to retry |
| Kaggle | Training datasets (download once, offline) | Kaggle account (team) | — | Licences per dataset (ML-PIPELINE §3.1) | Own recordings |
