---
doc: data-model
status: filled
last_updated: 2026-11-24
confidence: high
---

# Data model

There is no database (D-01). All data lives on the user's device, except temporary Bridge rooms and content-addressed caches on the API.

| Store | Key / name | Shape | Retention |
|---|---|---|---|
| localStorage | `bridgify.prefs.v1` | `Prefs` (SYSTEM-ARCHITECTURE §6.3) | Until reset |
| IndexedDB `bridgify` | `logs` | `{id, tool:'gesture'\|'braille'\|'stt', ts, payload}` | Last 1,000 per tool; user can clear |
| | `samples` (lab only) | `{signer, lang, label, ts, handedness[], landmarks[][], device, light}` | Until exported and cleared |
| | `poseCache` | `{key: sha1(text+lang), blob, ts}` | LRU, 20 MB |
| | `bridgeHistory` | Current room's messages | Cleared on leave |
| Cache API | `bridgify-models-v1` | Model files by URL | Until manifest version changes |
| | `bridgify-signs-v1` | Sign media | LRU, 300 entries |
| API memory | `rooms` | `code → {members:set[sid], createdAt, lastActivity}` | 30 min idle |
| API disk | `pose-cache/`, `tts-cache/` | `sha1(params).pose` / `.mp3` | 30 days, no user identifiers |

## Content files (in git)

- `content/lexicons/{lang}.json`: `{version, lang, entries:[{gloss, words[], media:{type, src, poster?}, source, license, author, url}]}`
- `content/phrases/quick-access.{lang}.json`: `{categories:[{id, label, items:[{text, en?}]}]}`
- `content/phrases/sos.json`, `content/phrases/gestures.json`, `content/emotion-weights.json`
- `content/tutorials/*`, `content/scripts/indic-22.json`, `content/CREDITS.json`
- `web/public/models/manifest.json`: `{models:[{id, url, sha256, bytes, runtime, version, license, source, metrics?}]}`
