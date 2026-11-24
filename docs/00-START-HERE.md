---
doc: start-here
status: filled
last_updated: 2026-11-24
confidence: high
---

# Bridgify: start here

> **BRIDGIFY: Bridging Communication Gaps.** Mini project, Sem VI Computer Engineering, VCET (University of Mumbai), A.Y. 2025-26.
> **Team:** Riddhi Mehta, Vedika Misal, Siddhi Bhosale, Om Panjari. **Mentor:** Prof. Manali Payghan.
> **This folder** is the single source of truth for v2: a full rebuild that makes every claim in the Sem 6 report real and adds Bridge, SOS and offline use.

## Read in this order

| File | What it holds | Read it when |
|---|---|---|
| `OVERVIEW.md` | The whole concept in plain language: every feature, how it works underneath, what matters in the code | First, for anyone |
| `02-PRODUCT/PRD.md` | Every requirement with an ID and an acceptance test, traced to the report; §9 lists report wording to update | Before building or changing a feature |
| `02-PRODUCT/WORKFLOWS.md` | 8 end-to-end user journeys (also the demo and e2e scripts) | Before testing or demoing |
| `03-SYSTEM/SYSTEM-ARCHITECTURE.md` | Stack with versions, repo layout, frontend and backend modules, APIs, sockets, flows, security, performance, deployment | While building |
| `03-SYSTEM/ML-PIPELINE.md` | Data, features, training, evaluation, export, runtime for the on-device models | During Phase 1–2 |
| `03-SYSTEM/DESIGN-SYSTEM.md` | Visual direction, tokens for 12 modes, type, layout, components, writing, accessibility checklist | Any UI work |
| `03-SYSTEM/DATA-MODEL.md` · `INTEGRATIONS.md` | Where data lives; external services (all free) | As needed |
| `04-DELIVERY/BUILD-PLAN.md` | Phases and sub-phases, hardest first, with acceptance and visual checks (live checklist) | Every build session |
| `04-DELIVERY/DECISIONS.md` | Every locked choice and why | Before reversing anything |
| `04-DELIVERY/OPEN-QUESTIONS.md` | What still needs an answer | Start of each session |
| `04-DELIVERY/CURRENT-STATE.md` | What actually works right now (real vs fake) | Before a demo |
| `04-DELIVERY/SCENARIOS.md` | What-ifs and fallbacks | Before the demo |
| `01-BUSINESS/RESEARCH.md` | Every library, dataset and source checked, with links and licences | When a choice depends on outside facts |
| `diagrams/*.html` | Visual architecture, ML pipeline, Bridge sequence (open in a browser) | Anytime |

## The idea in one paragraph

People who are Deaf, mute, blind, autistic or dyslexic use scattered, paid or inaccessible tools to communicate. Bridgify puts the conversions in one free website:
- speech ⇄ text
- text ⇄ braille
- sign ⇄ text
- gesture and emotion → meaning

It also has 12 display modes so the interface itself fits the person. Camera and microphone processing stays on the device. v2 adds **Bridge** (two phones, one conversation, each person receives in their own form), an **SOS card** and **offline** use.

## Current state

| | |
|---|---|
| Stage | Phase 0 done locally (shell, 12 modes, API skeleton, tests); deploy waiting on Q-02/Q-03 |
| Next | Phase 1 (vision and ML, the hardest part); P0.6 deploy once Q-02/Q-03 are answered |
| Blocking questions | Q-02 (repo account), Q-03 (API host) |
| Live link | Not yet |

## Hard rules

1. Every report claim must be true in the build. Changes go in PRD §9.
2. Free services only.
3. Light site: first load ≤ 180 KB JS; ML loads only on the page that uses it.
4. Nothing is called done if it is mocked. `CURRENT-STATE.md` stays honest.
5. Repo private, and the live link behind a passcode until the patent's provisional is filed.

## Truth labels

| Label | Meaning |
|---|---|
| `[CONFIRMED]` | From the report, the brief or the team |
| `[OBSERVED]` | Verified in code or the running app |
| `[ASSUMED]` | Needs confirming |
| `[UNKNOWN]` | Open question |
| `[DECISION]` | See `DECISIONS.md` |
