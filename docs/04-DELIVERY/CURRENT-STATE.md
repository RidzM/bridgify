---
doc: current-state
status: filled
last_updated: 2026-11-24
confidence: high
---

# Current state

**As of 24 Nov 2026: Phase 0 done locally (except deploy).** `[OBSERVED]`

| Area | State | Real or fake |
|---|---|---|
| Web shell | Top bar, Personalize panel (12 modes, text size, tool toggles, extras, undo), Tutorials panel (links), SOS link, skip link, footer, 404, error boundary | **Real** |
| 12 display modes | Token themes; contrast-checked; no-flash boot | **Real** |
| Home page | "Every way" demo: speech (browser voices, word highlight where supported), braille Grade 1 (offline engine) as SVG cells, large print. Tool directory, Bridge band, who it's for | **Real.** The fingerspelling row arrives in P6 |
| Tool pages | Routes exist and show "being built" | **Placeholder** |
| Braille Grade 1 offline engine | `engines/braille/grade1.ts`, unit-tested, including UEB capitals passage | **Real.** Matches liblouis 3.39 byte for byte on the report strings `[OBSERVED]` |
| API | Flask app factory, CORS allowlist, limiter, Socket.IO initialised, `/api/health` | **Real** (health only) |
| Tests | Vitest 9 unit; Playwright 15 (axe × 12 modes, keyboard, persistence, reflow); pytest 4 | **Real** |
| Deploy | — | Not started (Q-02, Q-03) |
| Diagrams | `docs/diagrams/*.html` (architecture, ML pipeline, Bridge sequence) | Done |
