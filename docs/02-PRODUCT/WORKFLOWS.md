---
doc: workflows
status: filled
last_updated: 2026-11-24
confidence: medium
---

# Workflows

Each workflow names its actor, trigger, steps, exceptions and the FRs it exercises. These are also the e2e test scripts and the demo script.

### W1: Non-verbal user says something urgent (FR-TTS-06, FR-SOS-01)
- **Actor:** non-verbal adult at a pharmacy.
- **Trigger:** needs to say "I need help".
- **Steps:**
  1. Opens Bridgify (installed PWA).
  2. Text to speech → Quick access → Emergency → taps "I need help".
  3. The phone speaks immediately and shows the caption.
- **Exceptions:**
  - No voices loaded: the server voice plays.
  - Offline with no voices: the SOS card shows large text and the user turns the screen around.

### W2: Deaf user follows a doctor (FR-STT-*)
- **Actor:** Deaf patient, hearing doctor.
- **Steps:**
  1. Speech to text → Start listening.
  2. The doctor speaks; live captions appear with punctuation.
  3. Captions mode goes full screen.
  4. The patient types a reply in Text to speech.
- **Exceptions:**
  - Brave or Firefox Android: the system offers on-device Whisper (opt-in download).
  - Noisy clinic: "Noisy room" switches to Whisper.

### W3: Blind student's braille round trip (FR-BR-*)
- **Actor:** blind student with a screen reader, and a sighted teacher.
- **Steps:**
  1. The teacher types a sentence in Text to braille (Grade 2) and downloads `.brf` for an embosser.
  2. The student writes an answer with the Perkins keys (S D F J K L).
  3. Back-translated text is spoken and shown to the teacher.
- **Exceptions:**
  - Server asleep: Grade 1 offline engine, with a banner.
  - Screen reader announces each cell: "dots 1 2 5, h".

### W4: Signer fingerspells a word for a hearing person (FR-SG-*)
- **Actor:** ISL signer.
- **Steps:**
  1. Sign to text → ISL → Start camera.
  2. Signs letters; each commits after a 0.7 s hold.
  3. Space.
  4. Speak aloud.
- **Exceptions:**
  - Low light: a hint appears.
  - Unsure letter: the top 3 show as chips to tap.
  - J/Z: a motion-letter note.

### W5: Caregiver learns ISL (FR-TU-*)
- **Steps:**
  1. Tutorials panel → Sign language → ISL → A–Z.
  2. The card shows the sign and the letter in 22 scripts.
  3. Practice → sign "A" to the camera → pass.

### W6: Two-phone conversation (FR-BG-*)
- **Actors:** A is a Deaf ISL signer; B is hearing.
- **Steps:**
  1. A → Bridge → Start a conversation → shows the code and QR.
  2. B scans or types the code.
  3. A sets receive = captions + sign and send = fingerspell/type. B sets receive = speech and send = speak.
  4. A fingerspells HELP; B's phone says "help".
  5. B says "Are you hurt?"; A sees captions plus ISL signs.
- **Exceptions:**
  - Room full: an error.
  - Disconnect: auto-reconnect, with a "Reconnecting…" status.
  - 30 min idle: the room expires.

### W7: SOS (FR-SOS-*)
- **Steps:**
  1. Tap SOS (on every page).
  2. A full-screen card: "I am Deaf. Please write or type." Plus the ISL clip, braille and a speak button.
  3. Share location, call contact.
- Works offline.

### W8: Personalise once (FR-PZ-*)
- **Steps:**
  1. Personalize → Dyslexia mode, text 140%, hide Gesture & Emotion.
  2. Every page follows these settings.
  3. Reload: no flash, same settings.
