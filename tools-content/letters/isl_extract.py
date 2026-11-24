"""Hand landmarks (both hands) for the Kaggle ISL classes Dwibon lacks: H, J, Y and 1-9.

MediaPipe HandLandmarker, IMAGE mode, num_hands=2, confidences 0.3 (same model file as
the web app). One row per detected hand. The photos are 128 x 128, so they are upscaled
2x first (the palm detector misses small hands otherwise).

Usage (from ml/): uv run python -I ../tools-content/letters/isl_extract.py [--workers 4]
Input:  .cache/isl-kaggle/Indian/<class>/*.jpg (isl_fetch.py)
Output: .cache/isl_kaggle_landmarks.parquet
"""

from __future__ import annotations

import argparse
import multiprocessing as mp_
import os
import time
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SRC = HERE / ".cache/isl-kaggle/Indian"
OUT = HERE / ".cache/isl_kaggle_landmarks.parquet"
MODEL = ROOT / "ml/models_src/hand_landmarker.task"
CLASSES = list("HJY") + [str(d) for d in range(1, 10)]

_lmk = None


def _init():
    global _lmk
    os.environ.setdefault("GLOG_minloglevel", "2")
    from mediapipe.tasks.python import BaseOptions, vision

    opts = vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL)),
        running_mode=vision.RunningMode.IMAGE, num_hands=2,
        min_hand_detection_confidence=0.3, min_hand_presence_confidence=0.3,
        min_tracking_confidence=0.3)
    _lmk = vision.HandLandmarker.create_from_options(opts)


def _work(path: Path):
    import mediapipe as mp

    im = Image.open(path).convert("RGB")
    im = im.resize((im.width * 2, im.height * 2), Image.BICUBIC)
    arr = np.ascontiguousarray(np.asarray(im))
    res = _lmk.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=arr))
    rel = f"Indian/{path.parent.name}/{path.name}"
    rows = []
    for k, hand in enumerate(res.hand_landmarks):
        hd = res.handedness[k][0]
        rows.append(dict(file=rel, label=path.parent.name, n_hands=len(res.hand_landmarks), hand=k,
                         handedness=hd.category_name, hand_score=float(hd.score),
                         aspect=im.width / im.height, lm=[c for p in hand for c in (p.x, p.y, p.z)]))
    if not rows:
        rows.append(dict(file=rel, label=path.parent.name, n_hands=0, hand=-1, handedness=None,
                         hand_score=float("nan"), aspect=im.width / im.height, lm=None))
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()
    files = sorted(f for c in CLASSES for f in (SRC / c).glob("*.jpg"))
    t0 = time.time()
    rows = []
    with mp_.Pool(args.workers, initializer=_init) as pool:
        for k, r in enumerate(pool.imap_unordered(_work, files, chunksize=32)):
            rows.extend(r)
            if k % 2000 == 0:
                print(f"{k}/{len(files)} {time.time() - t0:.0f}s", flush=True)
    df = pd.DataFrame(rows).sort_values(["file", "hand"]).reset_index(drop=True)
    df.to_parquet(OUT, index=False)
    per = df.groupby(["label", "file"]).n_hands.first().groupby("label").value_counts().unstack(fill_value=0)
    print(per.to_string())
    print(f"{len(files)} photos in {time.time() - t0:.0f}s -> {OUT}")


if __name__ == "__main__":
    main()
