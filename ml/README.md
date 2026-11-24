# ml/ — Bridgify on-device models

Data prep, training, evaluation and export for the models the web app loads from
`web/public/models/`. CPU only. Results and method: `docs/EVAL.md`. Plan: `docs/03-SYSTEM/ML-PIPELINE.md`.

## What lives here

| Path | What |
|---|---|
| `bridgify_ml/features.py` | Hand feature spec v1 (the TS port in `web/src/engines/vision/features.ts` must match it 1:1) |
| `bridgify_ml/extract_asl.py` | MediaPipe HandLandmarker over ASL-HG images → `data/processed/asl_hg_landmarks.parquet` |
| `bridgify_ml/extract_kdef.py` | MediaPipe FaceLandmarker blendshapes over KDEF → `data/processed/kdef_blendshapes.parquet` |
| `bridgify_ml/data.py` | Loaders for ASL-HG landmarks and the Dwibon ISL CSVs |
| `bridgify_ml/train.py` | Baselines (kNN, logistic regression, RBF-SVM) + MLP, signer splits, run reports |
| `bridgify_ml/loso.py` | Leave-one-signer-out model selection for ASL on P1–P8 |
| `bridgify_ml/gestures.py`, `tune_gestures.py` | Rule-based gestures (2-D) + threshold tuning on HaGRID |
| `bridgify_ml/emotion.py`, `tune_emotion.py` | Blendshape emotion rules + weight tuning on KDEF |
| `bridgify_ml/emotion_model.py` | Logistic regression on all 52 blendshapes (the shipped emotion model) |
| `bridgify_ml/export.py` | Writes `<id>.bin` + `<id>.json` and `web/public/models/manifest.json` |
| `bridgify_ml/fixtures.py` | Parity fixtures in `web/src/engines/vision/__fixtures__/` |
| `tests/test_parity.py` | numpy forward == torch / sklearn, fixtures reproduce, feature invariances |
| `scripts/download.sh` | Fetches every raw input |
| `scripts/dwibon_check.py`, `scripts/make_eval_figs.py` | EVAL.md checks and confusion PNGs |
| `data/raw/` (git-ignored) | Raw downloads. Never committed |
| `data/processed/` | Extracted landmarks / blendshapes + detection logs |
| `runs/` (git-ignored) | One folder per training run with `report.json` |

## Reproduce

```bash
cd ml
uv sync                                   # Python 3.12, CPU torch
scripts/download.sh                       # ~0.8 GB: models, ASL-HG, Dwibon, HaGRID annotations, KDEF
uv run python -m bridgify_ml.extract_asl --workers 4      # ~5 min
uv run python -m bridgify_ml.extract_kdef --workers 2     # ~2 min
uv run python -m bridgify_ml.loso --name base             # ASL model selection (P1–P8 only)
uv run python -m bridgify_ml.train --lang asl --name final --cfg '{"force":"mlp"}'
uv run python -m bridgify_ml.train --lang isl --name final
uv run python -m bridgify_ml.tune_gestures
uv run python -m bridgify_ml.tune_emotion
uv run python -m bridgify_ml.emotion_model
uv run python -m bridgify_ml.export --asl runs/<date>-asl-final --isl runs/<date>-isl-final
# content/*.json are written from runs/gestures/report.json and runs/emotion/report.json (see docs/EVAL.md)
uv run python -m bridgify_ml.fixtures
uv run pytest -q
```

Seeds are fixed (numpy/torch seed 0, split seeds 0). Copy `hand_landmarker.task` and
`face_landmarker.task` from `models_src/` to `web/public/models/` if you re-download them.

## Datasets and licences

| Data | Source | Licence | Used for |
|---|---|---|---|
| ASL-HG (10 signers, P1–P10) | huggingface.co/datasets/juanjodurillo/asl-hg | CC-BY-4.0 | ASL letters (24 static, no J/Z) |
| Dwibon ISL landmarks (6 + 1 held-out signer) | kaggle.com/datasets/dwibonbhargabdeka/isl-dataset-mediapipe-hand-landmarks | CC-BY-SA-4.0 | ISL letters (23 classes) |
| HaGRID annotations (`ann_test`, 2-D landmarks + user_id) | kaggle.com/datasets/kapitanov/hagrid | CC-BY-SA-4.0 | Gesture thresholds |
| KDEF (70 people, views S/HL/HR) | kaggle.com/datasets/muhammadnafian/kdef-dataset | KDEF terms: non-commercial research | Emotion rules + model |
| MediaPipe hand / face landmarker (float16) | storage.googleapis.com/mediapipe-models | Apache-2.0 | Landmarks (same files as the web) |

The shipped ISL weights are derived from CC-BY-SA data, and the emotion weights from KDEF
(non-commercial). Both licences are recorded in `web/public/models/manifest.json`.
