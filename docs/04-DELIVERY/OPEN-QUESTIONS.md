---
doc: open-questions
status: filled
last_updated: 2026-11-24
confidence: high
---

# Open questions

Ranked by how much each one blocks the build.

| ID | Question | Blocks | Default if no answer |
|---|---|---|---|
| Q-02 | Which GitHub account and name/email should commits and the repo carry? (Token needed.) | First push (P0.6) | Build locally; no push |
| Q-03 | Backend host: Render free (needs an account) or an existing server? | P0.6 deploy | Render free |
| Q-01 | Patent: keep the live link behind a passcode until the provisional is filed? Who are the named inventors? (Everyone who contributed an inventive idea must be listed; leaving one out can invalidate a patent.) | P8.7 | Passcode gate ON |
| Q-06 | Date of the next mentor review or demo? | Scope trimming | Build the full plan ASAP |
| Q-08 | Who records the training data (≥ 5 people, ~20 min each)? | P1.5 accuracy gate | Team of 4 + 1 friend |
| Q-07 | Is the GPL-2 licence on the Kaggle ASL alphabet images acceptable for training? | P1.4 | Use it for pre-training only; our own recordings dominate |
| Q-05 | Will the team update the report text with the v2 changes (PRD §9)? | P8.6 | Provide `REPORT-UPDATES.md` |
| Q-04 | Confirm the visual direction after the first screenshots (P0.4) | P0 sign-off | Proceed with D-20 |

## Contradictions

| Date | A | B | Resolution |
|---|---|---|---|
| 24 Nov | Report figures show a light indigo UI with a blue logo | The Lovable brief asks for deep violet/magenta, Syne + Atkinson | D-20: brand violet as the default Light mode, the report's 12 named modes kept |
| 24 Nov | Report: "custom TensorFlow.js classifier", "Flask Whisper", "face-api.js" | Light-site requirement | D-03, D-04, D-05; wording changes in PRD §9 |
