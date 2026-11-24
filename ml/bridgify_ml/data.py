"""Load raw-landmark datasets into a common shape for training.

Every dataset becomes a dict of numpy arrays:
  lm0, lm1   (N, 21, 3) normalised image coords (lm1 only for ISL)
  p0, p1     (N,) bool  hand present in slot
  mirror0    (N,) bool  ASL only: mirror flag (handedness == "Left")
  aspect     (N,)       image W/H
  y          (N,) str   label
  group      (N,) str   signer / split tag
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / "data/processed"
RAW = ROOT / "data/raw"

# Dwibon's frames: capture size is not recorded. We assume a 640x480 webcam (4:3).
# [ASSUMED] — training adds x-stretch augmentation (0.85-1.2) to cover 16:9 too.
DWIBON_ASPECT = 4 / 3
ASL_LABELS = list("ABCDEFGHIKLMNOPQRSTUVWXY")


def load_asl() -> dict:
    df = pd.read_parquet(PROC / "asl_hg_landmarks.parquet")
    df = df[df.attempt >= 0].reset_index(drop=True)
    lm = np.stack(df.lm.to_numpy()).reshape(-1, 21, 3).astype(np.float64)
    return dict(
        lm0=lm,
        mirror0=(df.handedness == "Left").to_numpy(),
        aspect=df.aspect.to_numpy(np.float64),
        y=df.letter.to_numpy(),
        group=df.participant.to_numpy(),
        path=df.path.to_numpy(),
        handedness=df.handedness.to_numpy(),
    )


def _dwibon(path: Path, tag: str) -> dict:
    d = pd.read_csv(path)
    left = d[[f"left_lm{i}_{c}" for i in range(21) for c in "xyz"]].to_numpy(np.float64).reshape(-1, 21, 3)
    right = d[[f"right_lm{i}_{c}" for i in range(21) for c in "xyz"]].to_numpy(np.float64).reshape(-1, 21, 3)
    # Columns are already wrist-relative (lm0 == 0). Our pipeline subtracts the wrist
    # again, which is a no-op, then scales by |lm9|: valid because the features are
    # translation and scale invariant. Dwibon "left_*" = MediaPipe label "Left" = our
    # slot 0 (image-left hand); "right_*" = slot 1. Missing hand = all zeros.
    p0 = np.abs(left).sum((1, 2)) > 0
    p1 = np.abs(right).sum((1, 2)) > 0
    return dict(lm0=left, lm1=right, p0=p0, p1=p1,
                aspect=np.full(len(d), DWIBON_ASPECT), y=d.label.astype(str).to_numpy(),
                group=np.full(len(d), tag))


def load_isl() -> tuple[dict, dict]:
    return (_dwibon(RAW / "dwibon/combined_train_dataset.csv", "dwibon_train"),
            _dwibon(RAW / "dwibon/held_out_dataset.csv", "dwibon_heldout"))


def subset(d: dict, idx) -> dict:
    return {k: v[idx] for k, v in d.items()}
