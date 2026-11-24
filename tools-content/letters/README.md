# tools-content/letters — fingerspelling, braille and script content

Scripts that build the letter-level teaching content. Everything they write is generated:
change a script and re-run it, never hand-edit the outputs.

| Output | Made by |
|---|---|
| `web/public/signs/asl/letters/A-Z.svg`, `.../asl/numbers/0-9.svg` | `asl_extract.py` → `asl_build.py` |
| `web/public/signs/isl/letters/A-Z.svg`, `.../isl/numbers/0-9.svg` | `isl_fetch.py` → `isl_extract.py` → `isl_build.py` |
| `web/public/signs/lsf/letters/A-Z.webp`, `.../dgs/letters/A-Z,Ä,Ö,Ü,SCH.webp`, `.../lsm/letters/L,S,M.webp` | `commons_fetch.py` |
| `content/tutorials/fingerspelling/{asl,isl,lsf,dgs,lsm,lis}.json`, `content/credits/letters.json` | `build_tutorials.py` |
| `content/tutorials/braille-g1.json`, `braille-g2.json` | `braille_build.py` (inside Docker) |
| `content/scripts/indic-22.json` | `indic_build.py`, checked by `indic_check.py` |
| `medoids.json` (here) | which photo / row every diagram was drawn from |

`.cache/` holds downloads and intermediate landmarks. It is git-ignored (see `.gitignore`).

## Regenerate

Needs: the `ml/` uv venv (MediaPipe, Pillow, pandas), `ml/data/raw` (run `ml/scripts/download.sh`),
the Kaggle CLI with an API token (`~/.local/bin/kaggle`), Docker image `bridgify-api` (liblouis 3.39),
`npm`, and `rsvg-convert` for previews only.

```bash
cd ~/bridgify
# 1. ASL diagrams (ASL-HG). The 24 static letters reuse ml/data/processed/asl_hg_landmarks.parquet.
(cd ml && uv run python -I ../tools-content/letters/asl_extract.py)      # J, Z, 0-9 landmarks, ~3 min
(cd ml && uv run python -I ../tools-content/letters/asl_build.py)

# 2. ISL diagrams (Dwibon CSV for 23 letters, Kaggle photos for H, J, Y, 1-9; 0 reuses ASL "O")
~/.local/share/uv/tools/kaggle/bin/python -I tools-content/letters/isl_fetch.py   # 281 MB zip, keeps 12 classes
(cd ml && uv run python -I ../tools-content/letters/isl_extract.py)      # ~4 min
(cd ml && uv run python -I ../tools-content/letters/isl_build.py)

# 3. LSF / DGS images and LSM L, S, M from Wikimedia Commons (slow on purpose: polite pacing)
(cd ml && uv run python -I ../tools-content/letters/commons_fetch.py)

# 4. Braille from native liblouis
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD/tools-content/letters:/scripts:ro" -v "$PWD/content/tutorials:/out" \
  bridgify-api /venv/bin/python -I /scripts/braille_build.py /out

# 5. Indian scripts
python3 -I tools-content/letters/indic_build.py
(cd ml && uv run python -I ../tools-content/letters/indic_check.py --npm --fonts)

# 6. Tutorial JSON + credits, then check everything
python3 -I tools-content/letters/build_tutorials.py
(cd ml && uv run python -I ../tools-content/letters/validate.py)

# optional: diagrams next to their source photos -> .cache/preview/*.png
(cd ml && uv run python -I ../tools-content/letters/preview.py asl)
(cd ml && uv run python -I ../tools-content/letters/preview.py isl)
```

## How the diagrams are made

- **Medoid, not a drawing from memory.** For each class the drawn hand is one real sample: the one
  closest to the class mean in normalised-landmark space (`ml/bridgify_ml/features.py`
  `normalise_hand`: wrist at origin, scaled by wrist→middle-knuckle). ASL uses training signers
  P1-P8 only. Two-handed ISL letters concatenate both hands.
- **Line art** (`handsvg.py`): 200×200 viewBox, the 21 MediaPipe joints and 21 connections as
  round strokes in `currentColor`, joint dots, larger fingertip dots, palm polygon 0-1-5-9-13-17
  at opacity .12. Depth cue: each bone and joint falls in a far / mid / near band from MediaPipe z
  (±0.16 hand sizes around the hand's median depth); nearer bands are thicker and darker. The app
  uses the SVGs as CSS masks, so only opacity matters, never colour.
- **Viewer's view.** Diagrams show what someone facing a right-handed signer sees (the signer's
  right hand on the viewer's left). In this MediaPipe build the handedness label follows how the
  hand looks in the image (checked: on ASL-HG, every "Right" sample has right-hand 3-D chirality).
  - ASL-HG photos are taken from the viewer's side: only "Right" samples are used, no mirroring.
  - Dwibon rows are left-handed in geometry for the hand labelled "right" (selfie-mirrored
    capture), so every Dwibon hand is mirrored. Wrist positions were not recorded, so two hands
    sit side by side with a fixed gap: **relative placement is schematic**; the tip says how the
    hands touch.
  - Kaggle ISL letter photos are taken from the viewer's side (right hand on the left): drawn as
    photographed, with the real placement of both hands. Kaggle number photos show a left hand:
    mirrored to a right hand.
- **Motion.** ASL J and Z get a dashed path with an arrowhead, traced as the signer writes them, so
  the viewer sees the J hook to their right and a reversed Z. ISL J gets the path from the ISLRTC
  chart (along the L-shaped hand, up to the thumb tip). ISL H and Y are marked `motion: true` and
  the movement is in the tip.
- **Substitutions.** ASL-HG "0" photos show the O hand edge-on in front of the other, open hand
  (the detector mostly returns the open hand), so ASL 0 is drawn from the letter-O medoid; ASL 0
  and O share the handshape. ISL 0 is the same O handshape (ISLRTC numbers chart), so it reuses
  that diagram.

## Sources and licences

Only free, licence-clean sources. Never Lifeprint, Handspeak, Spread The Sign, Sématos or DGS-Korpus.
The ISLRTC charts were read as a reference for the tips only; nothing from them is copied.

| Source | Licence | Used for |
|---|---|---|
| ASL-HG (huggingface.co/datasets/juanjodurillo/asl-hg) | CC BY 4.0 | ASL diagrams, ISL 0 |
| Dwibon ISL landmarks (Kaggle dwibonbhargabdeka) | CC BY-SA 4.0 | ISL letters except H, J, Y |
| Kaggle prathumarikeri/indian-sign-language-isl | CC BY-SA 4.0 | ISL H, J, Y, 1-9 |
| Commons, LSF letter photos by Clairette | CC BY-SA 3.0 (also 2.0 FR, GFDL) | LSF letters |
| Commons, DGS letter drawings (Deutsche Gehörlosenhilfe Bayern e.V. / Richard Huber) | CC BY-SA 4.0 | DGS letters |
| Commons, "Deletreo de LSM.png" by Guadalupe Gomez Tapia | CC BY-SA 4.0 | LSM L, S, M (the photo spells L-S-M) |
| liblouis 3.39 UEB tables | LGPL-2.1+ | braille JSON |

ISL diagrams adapt CC BY-SA data and are themselves CC BY-SA 4.0; the LSF/DGS/LSM images are
resized adaptations under their original licences. Per-file authors, licences and Commons pages
are in `content/credits/letters.json`.

**Licence caution, DGS.** The DGS files are line drawings that, per their Commons pages, follow
(and may be scans of) an info card of the Landesverband Bayern der Gehörlosen e.V. / Deutsche
Gehörlosenhilfe Bayern e.V.; the uploader released them as own work under CC BY-SA 4.0. If that
authorship claim is ever disputed on Commons, replace them.

**Commons downloads** go through `curl` with a 4 s pause: upload.wikimedia.org answers bursts of
uncached originals with HTTP 429 and `Retry-After: 600`, so a full first run takes ~30 minutes.
Metadata is cached in `.cache/commons_meta_<lang>.json` and originals in `.cache/commons/`.
`build_tutorials.py` can run at any point: a letter whose image is not downloaded yet is written
with `media: null`, so re-run it once the fetch has finished.

**Gaps.** LIS: no licence-clean alphabet exists on Commons and the one public photo set (Kaggle
"LIS-dataset") is under RAIL, which is not an open licence, so LIS letters have no media. LSM: no
alphabet chart exists on Commons; "Deletreo de LSM.png" turned out to be three photos spelling L-S-M,
so only L, S and M have images. No number images for LSF, DGS, LSM or LIS (the app animates them).
The ISL tips follow the ISLRTC chart and the reference photos; they should be reviewed by an ISL signer.
