"""Extract hand landmarks from ASL-HG images with MediaPipe Tasks HandLandmarker.

IMAGE mode, num_hands=1, all confidences 0.3 (same hand_landmarker.task as the web).
Attempt ladder per image:
  1. raw image
  2. 15% padding on every side (border colour = median edge colour) + 1.5x upscale
  3. 50% padding + 2x upscale (extra rung, logged separately)
Landmarks are stored in the normalised coords of the image that was actually fed
to MediaPipe, together with that image's aspect (W/H). Features are translation and
scale invariant, so padding does not change them beyond detector noise.

Usage: uv run python -m bridgify_ml.extract_asl [--workers 4] [--limit N]
Output: data/processed/asl_hg_landmarks.parquet, data/processed/asl_hg_detection.json
"""

from __future__ import annotations

import argparse
import io
import json
import multiprocessing as mp_
import os
import time
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.parquet as pq
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw/asl-hg/data"
OUT = ROOT / "data/processed"
MODEL = ROOT / "models_src/hand_landmarker.task"
LETTERS = [c for c in "ABCDEFGHIKLMNOPQRSTUVWXY"]  # 24 static letters (no J, Z)

_landmarker = None


def _init():
    global _landmarker
    os.environ.setdefault("GLOG_minloglevel", "2")
    from mediapipe.tasks.python import BaseOptions, vision

    opts = vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL)),
        running_mode=vision.RunningMode.IMAGE,
        num_hands=1,
        min_hand_detection_confidence=0.3,
        min_hand_presence_confidence=0.3,
        min_tracking_confidence=0.3,
    )
    _landmarker = vision.HandLandmarker.create_from_options(opts)


def _pad(im: Image.Image, frac: float, up: float) -> Image.Image:
    a = np.asarray(im)
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]], axis=0)
    fill = tuple(int(v) for v in np.median(edge, axis=0))
    w, h = im.size
    px, py = int(round(w * frac)), int(round(h * frac))
    im2 = ImageOps.expand(im, border=(px, py, px, py), fill=fill)
    return im2.resize((int(round(im2.width * up)), int(round(im2.height * up))), Image.BICUBIC)


def _detect(im: Image.Image):
    import mediapipe as mp

    arr = np.ascontiguousarray(np.asarray(im.convert("RGB")))
    res = _landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=arr))
    if not res.hand_landmarks:
        return None
    lm = np.array([[p.x, p.y, p.z] for p in res.hand_landmarks[0]], dtype=np.float64)
    hd = res.handedness[0][0]
    return lm, hd.category_name, float(hd.score)


def _work(item):
    path, letter, pid, data = item
    im = Image.open(io.BytesIO(data)).convert("RGB")
    ladder = [(0, None), (1, (0.15, 1.5)), (2, (0.5, 2.0))]
    for attempt, pad in ladder:
        img = im if pad is None else _pad(im, *pad)
        r = _detect(img)
        if r is not None:
            lm, hand, score = r
            return dict(path=path, letter=letter, participant=pid, attempt=attempt,
                        handedness=hand, hand_score=score, aspect=img.width / img.height,
                        width=img.width, height=img.height, lm=lm.reshape(-1).tolist())
    return dict(path=path, letter=letter, participant=pid, attempt=-1, handedness=None,
                hand_score=float("nan"), aspect=im.width / im.height, width=im.width,
                height=im.height, lm=None)


def _items(limit: int | None):
    n = 0
    for f in sorted(RAW.glob("*.parquet")):
        t = pq.read_table(f, columns=["image", "label", "participant_id"])
        labels = t.column("label").to_numpy()
        pids = t.column("participant_id").to_pylist()
        imgs = t.column("image")
        for i in range(t.num_rows):
            lab = int(labels[i])
            if lab < 10:
                continue
            letter = chr(ord("A") + lab - 10)
            if letter not in LETTERS:
                continue
            rec = imgs[i].as_py()
            yield (rec["path"], letter, pids[i], rec["bytes"])
            n += 1
            if limit and n >= limit:
                return
        del t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    rows = []
    with mp_.Pool(args.workers, initializer=_init) as pool:
        for k, r in enumerate(pool.imap_unordered(_work, _items(args.limit), chunksize=16)):
            rows.append(r)
            if k % 2000 == 0:
                print(f"{k} done, {time.time() - t0:.0f}s", flush=True)
    df = pd.DataFrame(rows).sort_values("path").reset_index(drop=True)
    df.to_parquet(OUT / "asl_hg_landmarks.parquet", index=False)
    det = {}
    for letter, g in df.groupby("letter"):
        det[letter] = {
            "n": int(len(g)),
            "detected": int((g.attempt >= 0).sum()),
            "rate": float((g.attempt >= 0).mean()),
            "by_attempt": {str(a): int((g.attempt == a).sum()) for a in (-1, 0, 1, 2)},
        }
    tot = {"n": int(len(df)), "detected": int((df.attempt >= 0).sum()),
           "rate": float((df.attempt >= 0).mean()),
           "by_attempt": {str(a): int((df.attempt == a).sum()) for a in (-1, 0, 1, 2)},
           "by_participant": {p: float((g.attempt >= 0).mean()) for p, g in df.groupby("participant")},
           "seconds": time.time() - t0}
    json.dump({"total": tot, "per_letter": det}, open(OUT / "asl_hg_detection.json", "w"), indent=1)
    print(json.dumps(tot, indent=1))


if __name__ == "__main__":
    main()
