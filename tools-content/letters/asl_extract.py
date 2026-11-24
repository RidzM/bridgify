"""Hand landmarks for the ASL-HG classes the ML pipeline does not extract: J, Z and 0-9.

Same detector and attempt ladder as ml/bridgify_ml/extract_asl.py (MediaPipe
HandLandmarker, IMAGE mode, num_hands=1, confidences 0.3, padding retries), but only
for the training signers P1-P8 (the train split), because the diagrams use the
training-signer medoid.

Usage (from ml/, so the ml venv with mediapipe is used):
  cd ml && uv run python -I ../tools-content/letters/asl_extract.py [--workers 4]
Output: tools-content/letters/.cache/asl_extra_landmarks.parquet
"""

from __future__ import annotations

import argparse
import multiprocessing as mp_
import time
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

from bridgify_ml import extract_asl as X  # _init / _work: the exact extractor the model uses

HERE = Path(__file__).resolve().parent
ML = HERE.parents[1] / "ml"
RAW = ML / "data/raw/asl-hg/data/train-00000-of-00001.parquet"
OUT = HERE / ".cache/asl_extra_landmarks.parquet"
NAMES = [str(i) for i in range(10)] + [chr(65 + i) for i in range(26)]
WANT = set("0123456789JZ")


def _items():
    t = pq.read_table(RAW, columns=["image", "label", "participant_id"])
    labels = t.column("label").to_pylist()
    pids = t.column("participant_id").to_pylist()
    imgs = t.column("image")
    for i, lab in enumerate(labels):
        name = NAMES[lab]
        if name in WANT:
            rec = imgs[i].as_py()
            yield (rec["path"], name, pids[i], rec["bytes"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    rows = []
    with mp_.Pool(args.workers, initializer=X._init) as pool:
        for k, r in enumerate(pool.imap_unordered(X._work, _items(), chunksize=16)):
            rows.append(r)
            if k % 1000 == 0:
                print(f"{k} done, {time.time() - t0:.0f}s", flush=True)
    df = pd.DataFrame(rows).sort_values("path").reset_index(drop=True)
    df.to_parquet(OUT, index=False)
    det = df.groupby("letter").apply(lambda g: (g.attempt >= 0).mean(), include_groups=False)
    print("detection rate per class:\n", det.round(3).to_string())
    print(f"{len(df)} images, {time.time() - t0:.0f}s -> {OUT}")


if __name__ == "__main__":
    main()
