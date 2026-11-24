# Bridgify

**Speak your way. Be heard every way.**

**Live:** https://bridgify-vcet.vercel.app

Bridgify is a free, browser-based communication platform for people who are Deaf, hard of hearing, mute, non-verbal, blind, low vision, autistic or dyslexic, and for the people who talk with them. Speech, text, braille and sign, in every direction, in one place. Camera and microphone processing stays on the device.

Mini project, Semester VI Computer Engineering, Vidyavardhini's College of Engineering & Technology (University of Mumbai), A.Y. 2025–26.
Team: Riddhi Mehta, Vedika Misal, Siddhi Bhosale, Om Panjari · Mentor: Prof. Manali Payghan

## Features

| Tool | What it does |
|---|---|
| Text to speech | Speaks typed text with word-by-word live captions and one-tap quick phrases |
| Speech to text | Live captions with smart punctuation; on-device Whisper fallback |
| Text to braille | Grade 1, Grade 2 (UEB) and Hindi Bharati braille via liblouis, dot grid, .txt/.brf download |
| Braille to text | Six-key Perkins-style input, back-translated to text and speech |
| Sign to text | On-device ASL and ISL fingerspelling recognition with live confidence |
| Text to sign | Sign videos, sign animations or fingerspelling in ASL, ISL, FSL, LSM, LIS and DGS |
| Gesture and emotion | Hand gestures and facial expressions turned into spoken meanings |

Plus 12 display modes, braille and sign-language tutorials, Bridge (two-device conversations), an SOS card and offline use.

## Run locally

```bash
# API (Flask + liblouis) on :8000
docker compose up --build

# Web on :5173
cd web && pnpm install && pnpm dev
```

## Project layout

```
web/       React 18 + Vite app (the website)
server/    Flask API: braille, speech fallback, sign gloss and pose, Bridge rooms
ml/        Training code for the on-device sign-letter classifiers
content/   Phrases, sign lexicons, tutorials, credits
docs/      Requirements, architecture, ML pipeline, design system, build plan
```

Start with [`docs/00-START-HERE.md`](docs/00-START-HERE.md).

## Licence

Code: MIT. Third-party media and data keep their own licences, listed in `content/CREDITS.json`.
