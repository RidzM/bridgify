---
doc: eval
status: filled
last_updated: 2026-11-24
---

# Model evaluation

> Every number here comes from a run in `ml/runs/` (git-ignored) produced by the code in `ml/`.
> Reproduce with the steps in `ml/README.md`. Method: `docs/03-SYSTEM/ML-PIPELINE.md`.
> Held-out sets were never used for any choice (model, hyper-parameter or threshold) unless stated.

## Summary

| Model | Shipped as | Held-out set | Metric | Result | Gate |
|---|---|---|---|---|---|
| ASL letters (24 static) | MLP 91→128→64→24 (`asl-letters`) | ASL-HG signers P9 + P10 (4,799 frames) | macro-F1 | **0.962** (acc 0.964) | ≥ 0.90 ✔ |
| ISL letters (23 static) | Logistic regression 184→23 (`isl-letters`) | Dwibon held-out signer (1,150 frames) | macro-F1 | **0.989** (acc 0.989) | ≥ 0.90 ✔ |
| Gestures (rules) | `content/gesture-thresholds.json` | HaGRID, 626 unseen users (9,467 hands) | accuracy, 6 target gestures | **0.973** (mean recall incl. `none`: 0.972) | ≥ 0.90 ✔ (on HaGRID, not the live 3×8×5 test) |
| Emotion (model) | Logistic regression 52→7 (`emotion`) | KDEF, 20 unseen people (838 images) | macro-F1 | **0.744** (acc 0.746) | none, "approximate" |
| Emotion (rules) | `content/emotion-weights.json` (explanations only) | same | macro-F1 | 0.576 (acc 0.584) | none |

Live-camera metrics in ML-PIPELINE §6 (live commit accuracy, latency, 3-person gesture test) are **not measured yet**. They need the browser build.

## 1. Datasets

| Data | Source | Licence | What we used | Counts |
|---|---|---|---|---|
| ASL-HG | HF `juanjodurillo/asl-hg` (participant-separated release) | CC-BY-4.0 | 24 static letters A–Y without J, Z (digits dropped), all 10 participants | 24,000 images → 23,947 with a hand (99.78 %) |
| Dwibon ISL landmarks | Kaggle `dwibonbhargabdeka/isl-dataset-mediapipe-hand-landmarks` | CC-BY-SA-4.0 | `combined_train_dataset.csv` (6 signers, 21,740 rows), `held_out_dataset.csv` (1 signer, 1,150 rows) | 23 classes: A–G, I, K–X, Z (no H, J, Y) |
| HaGRID annotations | Kaggle `kapitanov/hagrid`, `ann_test/*.json` only (no images) | CC-BY-SA-4.0 | like, dislike, palm, stop, one, peace, fist + negatives call, ok, rock, three | 26,594 hands, 2,086 users |
| KDEF | Kaggle `muhammadnafian/kdef-dataset` | KDEF terms: non-commercial research | views S, HL, HR; 7 emotions; 70 people × 2 sessions | 2,938 images → 2,934 with a face (S 100 %, HL 99.7 %, HR 99.9 %) |
| MediaPipe models | `storage.googleapis.com/mediapipe-models/…/float16/latest/` | Apache-2.0 | `hand_landmarker.task` (7.8 MB), `face_landmarker.task` (3.7 MB); same files the web loads | — |

Not used: the "extra test" sets in ML-PIPELINE §3.1 (Pugeault & Bowden, Mendeley ISLAN). No cross-dataset test exists yet.

Downloads total ≈ 0.8 GB (ASL-HG 372 MB, KDEF zip 510 MB of which 301 MB extracted, HaGRID annotations 116 MB, Dwibon 25 MB).

## 2. Features (spec v1)

Full index-by-index spec: docstring of `ml/bridgify_ml/features.py`. Short version, per hand (91 values):

| Index | Content |
|---|---|
| 0–62 | 21 landmarks × (x, y, z) after: x,z × aspect (W/H) → minus wrist → mirror (x → −x) if flagged → z × 0.5 → divide by \|P9\| |
| 63–77 | 15 joint angles, `atan2(|u×v|, u·v)` between consecutive bones, finger-major (thumb at 1,2,3; index at 5,6,7; …) |
| 78–87 | 10 fingertip distances, pairs (4,8)(4,12)(4,16)(4,20)(8,12)(8,16)(8,20)(12,16)(12,20)(16,20) |
| 88–90 | palm normal: unit (P5 − P0) × (P17 − P0) |

- **ASL** F = 91: mirror when MediaPipe handedness is "Left".
- **ISL** F = 184: two hands are ordered by wrist x (slot 0 = image-left, **mirrored**; slot 1 not mirrored). A single hand goes to slot 0 if labelled "Left", else slot 1. A missing hand is a block of 91 zeros. The last 2 values are the presence mask.

### Deviations from ML-PIPELINE §4 and why

1. **Aspect correction (added).** MediaPipe x is a fraction of the width and y a fraction of the height, so on a 16:9 camera a hand is stretched 1.78× in x. Features multiply x and z by W/H first. ASL-HG uses the true size of each image. **Dwibon does not record its frame size: we assume 640×480 (4:3)** `[ASSUMED]`. To cover a wrong guess, ISL training stretches x by a random factor in 0.85–1.2. An attempt to estimate the aspect from the data (hand-shape vs orientation) gave unstable answers and was dropped.
2. **Angles via atan2** instead of arccos, for numerical stability, so the TS port matches to ~1e-12.
3. **Single-hand ISL slot.** "Ordered by image-x" is undefined for one hand, so we use the handedness label. MediaPipe labels the image-left hand "Left" when hands are not crossed, so the two rules agree.
4. **Mirror invariance for ISL.** With slot 0 mirrored, a horizontally flipped frame gives exactly the same two blocks swapped. Training applies that swap at random (p = 0.5). The model therefore works whether or not Dwibon recorded mirrored frames, and for left-handed signers. A unit test checks the identity.

### Dwibon re-scaling check `[OBSERVED]`

`ml/scripts/dwibon_check.py`:
- Every present hand has wrist = (0, 0, 0) exactly. The CSV is wrist-relative in normalised image units, not world coordinates.
- Five random rows were moved back into absolute image coordinates by adding an arbitrary wrist position per hand. Features were recomputed and matched the wrist-relative computation to max |Δ| ≤ 9e-15. So running our pipeline directly on the CSV is valid: translation is a no-op and scale is removed by \|P9\|.
- Slot mapping: `left_*` → slot 0, `right_*` → slot 1. Train file: 17,276 rows with both hands, 4,435 with only the right slot, 29 with only the left slot. Held-out file: 835 / 307 / 8.
- The 20 parity frames include 11 ISL frames built this way (raw coords = Dwibon row + wrist position, including 4 with the detector order reversed and 2 single-hand frames).

## 3. ASL-HG landmark extraction

HandLandmarker, IMAGE mode, `num_hands=1`, all confidences 0.3. ASL-HG images are tight hand crops of 130–220 px, which the palm detector often misses. The retry ladder is:
- attempt 0: raw image
- attempt 1: 15 % border (median edge colour) + 1.5× upscale
- attempt 2: 50 % border + 2× upscale. **This rung is extra**, not in the brief.

| | attempt 0 | attempt 1 | attempt 2 | no hand | detection |
|---|---|---|---|---|---|
| All 24,000 | 20,393 | 3,104 | 450 | 53 | 99.78 % |

Per letter (detected / 1000): A 1000, B 1000, C 992, D 1000, E 1000, F 1000, G 1000, H 997, I 1000, K 1000, L 1000, M 1000, N 1000, **O 966**, P 998, Q 996, R 1000, S 1000, T 1000, U 1000, V 1000, W 1000, X 998, Y 1000. The fist-like letters (A, C, N, O, Q, S, T) needed the padded retries most: up to 58 % of O. Per participant: 98.5 % (P3) to 100 %. Raw log: `ml/data/processed/asl_hg_detection.json`.

Handedness: 97.1 % of detections are labelled "Right" and 702 "Left" (0–9 % per signer). These are single crops of the signers' dominant hand, so most "Left" labels are probably detector mistakes on tight crops. They get mirrored and add some label noise. `[ASSUMED]`

## 4. Letter classifiers

### Splits (by signer)

| | Train | Val | Test (held out) |
|---|---|---|---|
| ASL | P1–P7 (16,751) | P8 (2,397) | **P9, P10 (4,799)** |
| ISL | Dwibon train file, stratified 85 % (18,479) | 15 % (3,261) | **Dwibon held-out file, 1 unseen signer (1,150)** |

ISL train/val is a random split inside the same 6 signers, because the file has no signer ids. **ISL validation is therefore not signer-independent** and saturates at about 1.0. Only the held-out file measures generalisation.

### Training setup (as in ML-PIPELINE §5)

- **MLP:** F→128→64→C, ReLU, dropout 0.2, AdamW (lr 3e-3, wd 1e-4), cosine schedule, up to 60 epochs, batch 256, label smoothing 0.05. Keeps the best-val-macro-F1 epoch, patience 20. Seed 0.
- **Augmentation**, on normalised landmarks before the engineered features, regenerated every epoch:
  - rotation ±15° about the wrist
  - independent x/y scale 0.9–1.1 (ISL: x 0.85–1.2). Uniform scale would be a no-op after \|P9\| normalisation, so the axes are scaled separately.
  - Gaussian jitter σ = 0.01 and z noise σ = 0.01, in hand units (\|P9\| = 1)
  - finger dropout p = 0.1 per hand: one finger's 22 features (4 landmarks, 3 angles, 4 tip distances) set to the training mean, i.e. 0 after standardisation
  - ISL only: slot swap p = 0.5
- **Baselines** on standardised features, no augmentation:
  - kNN, k = 5
  - logistic regression, C ∈ {0.1, 1, 10} chosen on val
  - RBF-SVM, C ∈ {1, 10} chosen on val

### Runs

ASL (`2026-11-24-asl-base`; `asl-final` is the same config re-run and reproduced the numbers exactly):

| Model | Val (P8) macro-F1 | **Held-out (P9–P10) macro-F1** | Held-out acc |
|---|---|---|---|
| kNN (k=5) | 0.731 | 0.924 | 0.926 |
| Logistic regression (C=10) | **0.897** | 0.928 | 0.929 |
| RBF-SVM (C=1) | 0.851 | 0.956 | 0.956 |
| **MLP** (best epoch 26) | 0.882 | **0.962** | **0.964** |

ISL (`2026-11-24-isl-final`):

| Model | Val macro-F1 | **Held-out signer macro-F1** | Held-out acc |
|---|---|---|---|
| kNN (k=5) | 0.9995 | 0.977 | 0.978 |
| **Logistic regression (C=0.1)** | 0.9995 | **0.989** | **0.989** |
| RBF-SVM (C=1) | 0.9995 | 0.973 | 0.974 |
| MLP (best epoch 16) | 1.000 | 0.988 | 0.988 |

An earlier identical-config ISL run (`isl-base`) gave MLP held-out 0.981 with the same LR numbers. MLP results vary by about ±0.007 between runs.

### Model choice: what ships, and why (no test numbers used)

The rule in ML-PIPELINE §5 is to ship the MLP only if it beats logistic regression by ≥ 3 macro-F1 points, otherwise ship LR.

- **ASL:** P8 alone preferred LR (0.897 vs 0.882). One validation signer is a noisy judge, and ML-PIPELINE §6 asks for leave-one-signer-out. So we ran **LOSO on P1–P8 only** (`ml/runs/loso/asl-base.json`; MLP at a fixed 30 epochs, no early stopping):

  | Fold (held signer) | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | **mean** |
  |---|---|---|---|---|---|---|---|---|---|
  | LR | 0.775 | 0.878 | 0.822 | 0.922 | 0.859 | 0.927 | 0.816 | 0.897 | **0.862** |
  | MLP | 0.919 | 0.882 | 0.886 | 0.954 | 0.972 | 0.934 | 0.873 | 0.847 | **0.908** |
  | MLP+LR avg | 0.812 | 0.877 | 0.863 | 0.954 | 0.934 | 0.932 | 0.839 | 0.907 | 0.890 |

  The MLP beats LR by 4.6 points → **the MLP ships**. P8 is the only signer where LR wins, which explains the single-val result.
- **ISL:** validation is saturated (LR 0.9995, MLP 1.000), so the MLP does not clear the +3-point bar → **logistic regression ships**. It is one dense layer with no activation, so it uses the same exporter and runtime.

### Improvement attempts

The gate was met on the first run for both languages, so no fix-up attempts were needed. One exploratory variant was judged by ASL LOSO only:

| Attempt | Change | LOSO mean macro-F1 (LR / MLP / ens) | Decision |
|---|---|---|---|
| `strongaug` | rotation ±25°, jitter 0.02, x/y scale 0.85–1.15 | 0.862 / 0.910 / 0.897 | +0.002 vs base: within noise. Kept the documented config |
| `ens` | MLP + LR probability average | 0.890 (base) | Worse than MLP alone. Not used |

### Per-class F1 on the held-out sets

ASL (MLP, P9–P10, 200 frames per letter unless noted):

| A | B | C | D | E | F | G | H | I | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.953 | 1.000 | 0.936 | 1.000 | 0.973 | 1.000 | 0.983 | 0.998 | 1.000 | 0.998 | 1.000 | 0.895 |

| N | O | P | Q | R | S | T | U | V | W | X | Y |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.998 | 0.966 | 0.966 | 1.000 | 0.995 | 0.849 | **0.663** | 0.985 | 1.000 | 1.000 | 0.953 | 0.985 |

Known weak (< 0.80): **T**. 109 of 200 are correct; T is confused with S (53) and M (32), the expected fist-family confusion where the thumb sits between fingers. S (0.849) and M (0.895) follow. Confusion matrix: `eval/confusion-asl.png`.

ISL (LR, held-out signer, 50 frames per letter): all letters 1.000 except **C 0.952, R 0.935, S 0.948, W 0.901**. Nothing is below 0.80. Confusion matrix: `eval/confusion-isl.png`.

### Export and parity

- `web/public/models/asl-letters.{bin,json}`: 3 layers, 86,368 B. `isl-letters.{bin,json}`: 1 layer, 17,020 B.
- The JSON holds `featureSpec`, `F`, `labels`, `layers[{in,out,activation}]`, `mean`, `std` (float32-rounded), the bin's `sha256`, and `metrics`.
- Bin layout: little-endian float32, per layer W row-major [out][in], then b.
- `ml/tests/test_parity.py` (10 tests, all pass):
  - numpy forward over the exported files == torch (ASL) or the sklearn formula (ISL, emotion), atol 1e-5
  - every fixture reproduces
  - translation and scale invariance
  - frame flip == ISL block swap

## 5. Gestures (rules, 2-D)

- **Rules:** docstring of `ml/bridgify_ml/gestures.py`. A finger is extended if `d(tip, wrist) > r·d(pip, wrist)`. The thumb needs three checks:
  - it runs past the IP joint
  - it is roughly straight at the IP joint
  - its tip is farther from the pinky MCP than the thumb MCP is, i.e. not folded across the palm
- **Thumbs up/down:** thumb only, decided by the sign of y(tip) − y(MCP).
- **Data and split:** HaGRID `ann_test`, users split 70/30 with seed 0. 1,460 train users, 17,127 hands; **626 held-out users, 9,467 hands**.
- **Tuning objective:** mean per-class recall on the train users over thumbs_up, thumbs_down, open_palm, pointing, peace, fist and `none` (negatives: call, ok, rock, three). Random search (3,000 draws), then coordinate refinement.
- **Rule iterations:**
  1. The first thumb rule ("tip away from the index MCP") scored only 0.764 mean recall on held-out users. Peace and stop failed because a thumb tucked over the ring finger counted as extended.
  2. Replacing it with the pinky-MCP rule, and letting open_palm ignore the thumb, gave the result below.
  3. `four` was then dropped from the negatives, because open_palm ignores the thumb by design.

Chosen thresholds (`content/gesture-thresholds.json`): `finger_ratio 1.2, thumb_ratio 1.3, thumb_away 1.2, thumb_ip_max_deg 120, dir_margin 0.0, dir_vertical 0.25, palm_needs_thumb false`.

| Held-out users | thumbs_up | thumbs_down | open_palm (palm / stop) | pointing | peace | fist | none (call / ok / rock / three) |
|---|---|---|---|---|---|---|---|
| recall | 0.970 | 0.951 | 0.987 (1.000 / 0.975) | 0.956 | 0.983 | 0.976 | 0.980 (0.983 / 0.964 / 0.985 / 0.990) |

**Accuracy over the 6 target gestures: 0.973.** Mean recall including `none`: 0.972. Train-user mean recall was 0.975 (no overfit). The untuned default thresholds scored 0.869. Main errors: thumbs ↔ fist (a thumb pressed to the fist) and `stop`/`one` → `none`. Confusion matrix: `eval/confusion-gestures.png`.

**ILY is not measured:** HaGRID has no I-love-you class. `rock` (index + pinky, no thumb) correctly comes out `none` 98.5 % of the time, and 4 of 3,303 negatives were called `ily`. The fixture holds 3 synthetic ILY hands (held-out palms with middle and ring folded).

HaGRID gives no image size, so tuning used aspect = 1. On camera the rules get the real W/H. The thresholds are ratios, but foreshortening differs, so the planned live 3 × 8 × 5 test is still needed.

## 6. Emotion

- **Data:** KDEF, views S/HL/HR. Blendshapes from FaceLandmarker in IMAGE mode (`output_face_blendshapes`).
- **Split:** by person (both photo sessions on the same side), seed 0. **50 people train (2,096 images), 20 held-out people (838 images)**. Held-out people: AF/AM/BF/BM ids listed in `ml/runs/emotion/report.json`.

### 6a. Rules (SYSTEM-ARCHITECTURE §6.6 shape)

- **Shape:** weighted sums of the named blendshapes, with L/R pairs averaged, plus a per-emotion bias. neutral = 1 − max(others) + bias.
- **Tuning:** coordinate search on a weight grid 0–16 and a bias grid −2…2, sign-constrained, with 5 random restarts. Objective: macro-F1 on the 50 training people.
- **Results:**
  - untuned shape (all weights 1): held-out macro-F1 0.415
  - tuned: train 0.534 → **held-out macro-F1 0.576, accuracy 0.584**

| | neutral | happy | surprised | sad | angry | disgusted | fearful |
|---|---|---|---|---|---|---|---|
| F1 | 0.505 | 0.894 | 0.729 | 0.508 | 0.601 | 0.405 | 0.388 |

- **By view (macro-F1):** S 0.637, HL 0.521, HR 0.556.
- **Main confusions:**
  - disgusted → angry: 57 of 119
  - fearful → surprised: 28 of 120
  - neutral → sad or fearful
- **Tuned-weight artefacts:** the search set sad's −mouthSmile and angry's mouthPress to 0. Confusion matrix: `eval/confusion-emotion-rules.png`.

### 6b. Model (shipped for the prediction)

- **Model:** multinomial logistic regression on all 52 blendshapes, standardised. Inputs are in FaceLandmarker category order (index 0 = `_neutral`). C = 1, chosen by 5-fold person-grouped CV on the 50 training people (CV macro-F1 0.722).
- **Result:** held-out **macro-F1 0.744, accuracy 0.746**.

| | neutral | happy | surprised | sad | angry | disgusted | fearful |
|---|---|---|---|---|---|---|---|
| F1 | 0.798 | 0.962 | 0.811 | 0.690 | 0.667 | 0.705 | 0.576 |

- **By view (macro-F1):** S 0.772, HL 0.750, HR 0.710.
- **Main confusions:** fearful → surprised (26/120) and sad → neutral (20/120).
- **Files:**
  - model: `web/public/models/emotion.{bin,json}`, `featureSpec "blendshapes52-v1"`, 1,484 B
  - confusion matrix: `eval/confusion-emotion-model.png`
  - rule weights `content/emotion-weights.json`: kept only to explain a prediction ("based on: smile, raised brows")

## 7. Files produced

- **Models:** `web/public/models/` holds:
  - `hand_landmarker.task`, `face_landmarker.task`
  - `asl-letters.{bin,json}`, `isl-letters.{bin,json}`, `emotion.{bin,json}`
  - `manifest.json`, with ids `hand_landmarker`, `face_landmarker`, `asl-letters`, `isl-letters`, `emotion`. Each entry has `url`, `bytes`, `sha256`, `files{…}`, `licence`, `source` and headline metrics.
- **Fixtures** in `web/src/engines/vision/__fixtures__/`:

  | File | Contents |
  |---|---|
  | `features.json` | 20 frames: 9 ASL incl. 3 "Left", 9 ISL two-hand incl. 4 reversed order, 2 ISL single-hand |
  | `mlp-asl.json`, `mlp-isl.json` | 10 cases each |
  | `gestures.json` | 30 samples |
  | `emotion.json` | 20 cases, rules |
  | `emotion-model.json` | 10 cases |

- **Content:** `content/gesture-thresholds.json`, `content/emotion-weights.json`
- **Figures:** `docs/eval/confusion-{asl,isl,gestures,emotion-rules,emotion-model}.png`

## 8. Limitations (honest)

- **Few test signers.** ASL is tested on 2 signers and ISL on 1. These are point estimates with wide uncertainty: in ASL LOSO, single-signer macro-F1 ranged 0.85–0.97 for the MLP. Expect lower numbers for new signers, cameras and lighting.
- **Photos, not live video.** ASL-HG is tightly cropped still photos and Dwibon was captured in one setup. Neither looks like a live, motion-blurred webcam. No cross-dataset or live test has been run (ML-PIPELINE §6 live-commit and latency rows are open).
- **ISL setup assumptions.** Validation is not signer-independent, the Dwibon frame aspect (4:3) is assumed, and the dataset has no H, J or Y.
- **ASL handedness labels.** About 3 % of ASL-HG crops are labelled "Left" and probably wrong. Mirroring is driven by that label, so the same failure can occur live.
- **Gestures.** Tuned on HaGRID photos, mostly frontal at arm's length, with an unknown aspect. ILY is untested on real data. The live 3 × 8 × 5 test is still required for the ≥ 90 % gate.
- **Emotion.** KDEF is posed, studio-lit and only 70 adults of similar background. Acted expressions are not felt emotions, so the UI must say "approximate". KDEF's licence is non-commercial research, and the emotion weights inherit that.
- **ISL licence.** The ISL weights derive from CC-BY-SA-4.0 data (share-alike applies to the weights file).

## 9. Bridge (phone to phone) `[OBSERVED]`, 24 Nov 2026

Measured on one laptop: two tabs, and two browser contexts through the public PeerJS broker. Phone-to-phone numbers on real networks are **not measured yet** `[UNKNOWN]`. Method: the e2e suites `web/e2e/bridge.spec.ts` plus a test-only hook that feeds hand points through the real session code (headless camera inference runs at only 2 fps).

| What | Result |
|---|---|
| Connect, two tabs (guest opens link → both "Connected") | 363–579 ms (handshake 8–15 ms) |
| Connect, public PeerJS broker, isolated runs | 1.6–3.1 s (one run under a fully loaded parallel suite took 10.2 s) |
| Round trip, two tabs | median 0.8–1.7 ms, p95 1.2–2.2 ms |
| Round trip, PeerJS (same machine) | median 1.2–2.7 ms, p95 1.6–2.9 ms |
| Send → receipt | 6–17 ms |
| Text message | 117–141 B, plus a 52 B receipt |
| Idle keep-alive | 45 B ping + 45 B pong every 5 s (about 18 B/s each way) |
| Hands stream, moving hand, 30 fps input | 183 B per packet for one hand (295 B for two), 9.4 packets/s = **13.8 kbps** (target < 15 kbps) |
| Hands stream, still hand | about 1.6–1.9 kbps (keyframes only) |
| SOS offline, navigation → first card | 103–287 ms (target 300 ms) |


## 10. Real-world robustness and the 25 Nov retrain `[OBSERVED]`

The team reported that live recognition "always detects R". Held-out scores were high, but they were measured on the same capture setups the models were trained on. Real cameras, people and hand angles differ. Measured with `bridgify_ml.eval_ood` and `bridgify_ml.robustness`, using datasets for evaluation only, never trained on unless stated:

| Test | Old models (24 Nov) | New models (25 Nov) |
|---|---|---|
| ASL, webcam photos of another person ("ASL Alphabet Test", 708 hands) | 77.4% | **79.5%** |
| ASL held-out signers P9–P10 (macro-F1) | 0.962 | 0.962 |
| ISL, Kaggle ISL photos (prathumarikeri, 1,378 hands) | **41.6%**; R was the most-predicted letter | trained on (see below) |
| ISL, third independent set (rushilverma07, another signer and camera, 884 hands) | **18.1%**; U and R dominated | **60.2%** |
| ISL held-out Dwibon signer (macro-F1) | 0.989 | 0.993 |

**What changed**
- **ISL training data:** the 6 Dwibon signers plus the Kaggle ISL photo set (CC BY-SA 4.0), 600 photos per letter, for a second signer and camera.
- **Camera-angle augmentation:** in-plane roll went from ±15° to ±25°, and a new 3-D turn of ±25° left/right and up/down was added.
- **Model choice:** the augmented MLP is shipped for both languages. The selection rule changed from "best validation score" (saturated at 0.999 for ISL) to "trained for camera-angle robustness" (D-40).

**Still weak:**
- ASL T, D, N, M and R on webcam photos. These are letters that differ by thumb position and finger crossing, which 2-D landmarks see poorly.
- About 40% of ISL letters on a completely new signer.

A 3-person live check with the team (CURRENT-STATE) remains the real test.
