---
doc: design-system
status: filled
last_updated: 2026-11-24
confidence: medium
---

# Design system

> **Brief** `[CONFIRMED]`: brand colours deep violet #3D0075, magenta #C700C7, soft white #F8F4FF, dark #0E0014. Headings in Syne, body in Atkinson Hyperlegible. "Modern, inclusive, clean, welcoming. Avoid generic or clinical design" (Lovable brief). Target: a polished product feel, nothing that reads as templated.
>
> **Method:** the frontend-design guidance. Plan → check against generic defaults → revise → build → screenshot critique. Impeccable `detect` runs in CI.

## 0. Revision 2 (24 Nov): what changed and why

An audit of the first build against the "AI slop" sign lists (Unslop, Impeccable) found these problems:
- big headline words above a card
- lavender-on-lavender surfaces
- an icon on every list row
- thick decorative rules
- a generic "who it's for" block
- Syne bold headlines

Revision 2 makes these changes:

| Area | Now |
|---|---|
| Direction | **Product:** one message turned into speech, braille, sign and large print.<br>**Character:** steady, plain-spoken, tactile.<br>**World:** embossed braille paper and the reception desk where these conversations happen.<br>**Moment:** the composer is the home page, and the message appears in every form as you type.<br>**Signature:** the braille cell (logo and output) |
| Concept | "Say it once; everyone receives it their way." |
| Shell | An app layout: a sticky left **sidebar** on desktop, grouped by Hick's law (Say it · Understand it · Together · Learn), with SOS at the top and Display settings at the bottom. Mobile has a top bar with a menu sheet and SOS always visible. The right-hand Tutorials panel is replaced by the Learn group (Jakob's law: apps navigate from a sidebar) |
| Colour | Light mode neutral ramp tinted slightly toward violet: bg #F6F5F8, surface #FFF, ink #18131F, muted #595363, hairline #E5E2EA. Violet #3D0075 is the **only** chrome accent (the primary action). Magenta only means *live*. No gradients, glows or coloured shadows |
| Type | **Atkinson Hyperlegible Next only** (400/500/600), with hierarchy from size. Syne is dropped: it reads poorly at UI sizes, and one family with character is stronger. Large print in the composer is the one display moment |
| Spacing and radius | 4-pt grid. Radius 8 for controls, 10 for inputs and primary, 12 for cards, 16 for the composer. Depth comes from a hairline border only |
| Motion | Tokens `--ease-out` cubic-bezier(.32,.72,0,1), `--ease-in`, `--ease-in-out`; 140 ms press (scale .96), 240 ms sheets. Nothing moves on its own except the one-shot braille raise; reduced-motion modes switch it off |
| Copy | No hero slogan. One plain sentence of what it does, then the tool |

Sections 2–4 below are the original plan; where they conflict, this section wins.

## 1. Subject, audience, job

- **Subject:** turning one message into every form a person can receive it in: speech, text, braille, sign.
- **Audience:**
  - disabled users, often with assistive tech or atypical motor and vision needs
  - the hearing caregivers next to them
  - a professor judging it
- **Primary job:** say something and be understood, fast, without setup. Everything else is secondary.

## 2. Design plan (v1)

| Axis | v1 idea |
|---|---|
| Colour | Violet-tinted paper, violet ink, magenta accent on headings, gradient hero like the Lovable build |
| Type | Syne for headings, Atkinson for body |
| Layout | Top bar, 3-slide hero carousel, grid of 6 identical feature cards, footer |
| Signature | Big gradient "Welcome to BRIDGIFY" |

## 3. Check against generic defaults

| v1 choice | Problem | Revision |
|---|---|---|
| Gradient hero and gradient headline text | The purple-to-magenta gradient wash is today's most common generated-SaaS tell. The Lovable v1 has exactly this | **No gradients anywhere.** Violet is a solid ink colour |
| 3-slide auto carousel | Generic, and an accessibility failure: moving content needs a pause control (WCAG 2.2.2). Users miss 2 of 3 slides | Replace it with **one live demo** that does the product's actual job (§4) |
| 6 identical rounded cards with shadows | The "SaaS card kit" tell. Every tool looks equally important | Tools become a **two-column directory by direction** ("Say it" / "Understand it"): rows with a divider, a braille initial and a one-line purpose. Bridge gets a wide band of its own |
| Magenta used for decoration | Dilutes its meaning | Magenta means one thing only: **live** (mic listening, camera seeing, sign detected, Bridge connected) |
| ALL-CAPS eyebrows above sections | Template chrome | Sentence-case headings, no eyebrows |
| "→" on every link | Template chrome | Plain verbs ("Open text to speech") |

## 4. Final direction: "Every way"

**The signature element:** the home page opens with a single input, "Type something to say". As you type, the same message appears at once in **four rows**:
- **Spoken**: a play button and the word-highlight caption.
- **Braille**: cells raise dot by dot, so the change is visible.
- **Fingerspelled**: hand images, letter by letter, in the chosen sign language.
- **Large print**: big text.

This is the product's promise, shown working in the first second. It is the only orchestrated motion on the site. With reduced motion, the cells appear instantly.

**The braille cell as the structural unit.** The 2×3 dot grid is the brand's recurring device, and it always carries information:
- **Logo mark:** the cells for "b".
- **Tool directory:** each row shows its initial in braille (aria-hidden; the text label is the accessible name).
- **Loading indicator:** dots fill 1 to 6 for real download progress.
- **Section dividers:** none. Plain whitespace does that job.

**Restraint:** one bold thing (the live demo and the dots). Everything else is quiet, dense, legible product UI.

### 4.1 Colour tokens: default mode "Light" (the brand)

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--bg` | #F8F4FF (soft white) | Page | — |
| `--surface` | #FFFFFF | Panels, inputs | — |
| `--ink` | #1A0833 | Body text | 17.9:1 on bg |
| `--ink-muted` | #4E3F66 | Secondary text | 8.6:1 |
| `--line` | #DDD3EE | Dividers, input borders | 3:1 needed only for input borders, so inputs use `--line-strong` #8C7BA8 (3.4:1) |
| `--brand` | #3D0075 (deep violet) | Primary buttons, links, logo | 13.4:1 on bg |
| `--live` | #A800A8 (magenta, deepened from #C700C7 for text contrast) | Live states only | 6.1:1 on white. #C700C7 kept for non-text fills ≥ 3:1 |
| `--ok` / dot raised | #0B6E69 (teal) | Raised braille dots, success | 5.9:1 |
| `--warn` | #8A5300 | Warnings | 5.6:1 |
| `--danger` / SOS | #B3261E | SOS, errors | 6.3:1 |
| `--focus` | #C700C7 ring 3 px + 2 px offset `--bg` | Focus | ≥ 3:1 against both sides |

All ratios are **targets**. P0 adds `web/scripts/contrast-check.ts`, which computes every token pair for all 12 modes and fails CI below AA. Numbers above are `[ASSUMED]` until that script runs.

### 4.2 The 12 modes `[CONFIRMED report Fig 3.5.2]`

Each mode overrides the same tokens under `[data-mode]`.

| Mode | bg / ink / brand / live | Extra rules |
|---|---|---|
| Light (default) | #F8F4FF / #1A0833 / #3D0075 / #A800A8 | — |
| Dark | #0E0014 / #EFE8FA / #C9A6FF / #F07CF0 | Shadows become 1 px borders |
| High Contrast | #000000 / #FFFFFF / #FFE600 / #00E5FF | Links underlined. 2 px borders everywhere. Focus is a 4 px yellow ring. AAA |
| Solarized | #FDF6E3 / #073642 / #6C71C4 / #D33682 | — |
| Night Blue | #0B1426 / #E6EDF7 / #8DB4FF / #FF9BD2 | Lower luminance for night use |
| Forest | #F1F5EE / #17301F / #2E6B3F / #9C2F6A | — |
| Sepia | #F4ECD8 / #3B2A1A / #6B3F1D / #8E2C48 | Warm, for eye strain |
| Calm | #EEF3F6 / #24323D / #3E6A86 / #5D6FA8 | Muted. **Motion off.** No live-colour flashing; the live state shows as a static outline |
| Focus | inherits Light | Hides everything outside the active tool (nav extras, footer, dashboard extras); hidden rather than faded so contrast stays AA. **Motion off** |
| Low Vision | #FFFFFF / #000000 / #2B0058 / #8A008A | Base text 125%, min 20 px. Bold weights. Thicker focus ring. AAA |
| Autism-Friendly | #EEF4F1 / #283A33 / #3F6F62 / #5B7FA0 | Soft pastels, no pure white. **Motion off.** No auto-play. Fewer simultaneous elements (quick-access trays collapsed by default) |
| Dyslexia | #FAF3E3 (cream) / #2A2320 / #4A2A7A / #8A2E7A | **OpenDyslexic** (its own wide spacing; no extra letter-spacing, 25 Nov), word-spacing 0.14em, line-height 1.8, max line 65ch, left-aligned, no italics |

### 4.3 Type

| Role | Face | Size and weight (at 100% scale) |
|---|---|---|
| Display (home hero line, page titles) | **Syne** 700 | 40/44 desktop, 30/34 mobile, tracking −0.01em. Used **only** at ≥ 28 px; Syne gets hard to read when small |
| Headings h2/h3 | **Atkinson Hyperlegible Next** 700 | 24/30, 19/26 |
| Body, UI | Atkinson Hyperlegible Next 400/500 | 17/26 base (1.0625rem), min 16 px |
| Live output (captions, transcripts) | Atkinson 500 | 22/32. Caption mode 32–48 |
| Braille glyphs | System braille font stack: `"Noto Sans Symbols 2", "Segoe UI Symbol", "Apple Braille", sans-serif` | 28 px in output. The DotGrid component draws SVG dots instead of relying on fonts |
| Indic scripts (tutorial row) | Noto Sans {Devanagari, Bengali, Tamil, …}, loaded on demand | 18 px |

- **Scale:** a 1.25 ratio from 17 px. All sizes are in rem, and `html { font-size: calc(100% * var(--text-scale)) }`.
- **Line length:** ≤ 70ch for prose.
- **Case:** sentence case everywhere. No all-caps labels.
- **Atkinson Hyperlegible** was designed by the Braille Institute for low-vision readers. That makes it a subject-true choice, not a default.

### 4.4 Layout

```text
Desktop ≥ 1024
┌──────────────────────────────────────────────────────────────────────┐
│ [b] Bridgify   Personalize        Tools ▾   Bridge   Learn ▸   [SOS] │  sticky 64px
├──────────────────────────────────────────────────────────────────────┤
│ Say it any way. Be understood every way.        (Syne, left-aligned) │
│ ┌──────────────────────────────────────────────────────────────┐     │
│ │ Type something to say…                               [Speak] │     │
│ └──────────────────────────────────────────────────────────────┘     │
│  Spoken      ▶ "where is the hospital"  (word highlight)             │
│  Braille     ⠺⠓⠑⠗⠑ ⠊⠎ …  (SVG dot cells, raise in sequence)          │
│  Fingerspelt [W][H][E][R][E] … ISL ▾                                 │
│  Large print WHERE IS THE HOSPITAL                                    │
├───────────────────────────────┬──────────────────────────────────────┤
│ Say it                        │ Understand it                        │
│ ⠞ Text to speech   one line   │ ⠎ Speech to text     one line        │
│ ⠃ Text to braille  one line   │ ⠃ Braille to text    one line        │
│ ⠎ Text to sign     one line   │ ⠎ Sign to text       one line        │
│                               │ ⠛ Gesture & emotion  one line        │
├───────────────────────────────┴──────────────────────────────────────┤
│ Bridge: two phones, one conversation. Each person picks how they     │
│ receive. [Start a conversation]  [Join with a code]                  │
├──────────────────────────────────────────────────────────────────────┤
│ Who it's for (6 short rows) · Privacy: camera never leaves device    │
└──────────────────────────────────────────────────────────────────────┘

Tool page (ToolFrame)
┌─ Back to home ─ Text to speech ──────────────── privacy strip ──────┐
│ purpose line                                                        │
│ ┌ input (60%) ───────────────────┐ ┌ output / live (40%) ──────────┐ │
│ │                                │ │ caption band, cells, camera…  │ │
│ └────────────────────────────────┘ └───────────────────────────────┘ │
│ controls row (primary action largest, keyboard shortcuts shown)     │
│ Quick access ▾  (tabs by category; chips wrap; collapsible)         │
└─────────────────────────────────────────────────────────────────────┘
Mobile: single column; output first for camera tools; a sticky bottom action bar holds the primary action and SOS.
```

- **Alignment:** left-aligned throughout. Centred text appears only in the SOS card.
- **Grid:** 12 columns, max width 1200 px, 24 px gutters, 16 px on mobile.
- **Radius:**
  - 6 px for controls
  - 12 px for panels
  - 999 px for chips only
  - 0 for the top bar

  Hierarchy shows in the radius, not one radius everywhere.
- **Elevation:** borders, not shadows. The one exception is open sheets, which get a single 24 px blur shadow at 12% ink.

### 4.5 Motion

- **One orchestrated moment:** the hero braille dots raising (30 ms stagger, 180 ms ease-out).
- **Responses to user actions:** sheets slide (200 ms), the confidence ring fills, a committed letter pulses once.
- **Nothing else moves on its own.** No scroll reveals, no hover lifts.
- **Off entirely** in Calm, Focus and Autism modes, under OS reduced motion, or when the user turns it off.

### 4.6 Components (in `web/src/components/ui`, built on Base UI)

**Controls**
- `Button`: primary, secondary, quiet, danger.
- `Chip`: quick access; it speaks on press.
- `SegmentedControl`: language, grade.
- `Slider`: speed, text size. Shows its value. Arrow keys move it.
- `Switch`
- `Tabs`
- `Sheet`: left and right panels.
- `Dialog`
- `Toast`: polite live region.
- `Tooltip`: never the only label.

**Domain components**
- `ToolFrame`
- `PrivacyStrip`: "On this device" or "Sent to Bridgify server for braille translation".
- `LiveRegion`
- `BrailleCell` / `DotGrid`: SVG; raised dots are `--ok` filled, flat dots are a `--line-strong` outline.
- `PerkinsKeys`
- `CameraStage`: video, landmark overlay canvas, confidence ring, "can't see your hand" hint.
- `ConfidenceMeter`: value plus a text label.
- `CaptionBand`
- `SignPlayer`
- `ModeSwatch`: a radio card showing that mode's real bg/ink/brand.
- `ModelProgress`: braille-dot progress plus MB text.
- `RoomCode`: large, spaced, read aloud on focus.

**Shared rules**
- Every icon-only button has an `aria-label`.
- Every target is ≥ 44×44 px.
- Focus is always visible.

### 4.7 Writing

- **Plain verbs** that say what happens:
  - "Speak", "Start listening", "Convert to braille", "Show signs", "Start camera", "Start a conversation".
  - The same verb carries through to the result. "Copy" leads to "Copied".
- **Errors** say what happened and how to fix it. For example: "Camera blocked. Click the camera icon in the address bar, choose Allow, then press Try again."
- **Honest ML copy:** "Not sure: try more light or hold the shape still." "Approximate emotion from facial movement."
- **Banned words:** no "AI-powered", "seamless" or "revolutionary".

## 5. Accessibility checklist (applies to every screen)

- Landmarks: `header`, `nav`, `main`, `footer`. One `h1` per page.
- Skip link first in tab order.
- Keyboard-only: every action reachable, logical order, no traps (sheets trap focus but Esc closes them).
- Live outputs: `aria-live="polite"`. SOS and errors: `assertive`.
- Forms: visible labels, never placeholder-only.
- Text resizes to 200% with no loss of content. Reflows at 320 px.
- Contrast: AA in every mode, AAA in High Contrast and Low Vision.
- Motion follows §4.5.
- Media: sign videos have text glosses. Audio output always has a caption.
- Language: `lang` set on Hindi, French and other non-English strings.

## 6. Quality gates

1. `npx impeccable detect web/src` runs in CI, and also against `http://localhost:5173` for rendered checks.
2. axe runs on 12 modes × all routes.
3. Playwright screenshots of every route in Light, Dark, High Contrast and Dyslexia are reviewed by eye at each phase end. They go in `docs/screens/`.
4. The contrast script passes.
5. Before each phase is marked done: check the screen against this file's "check against generic defaults" table again.
