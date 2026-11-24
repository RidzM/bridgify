"""Out-of-distribution check: the shipped letter models on photos from *other* datasets.

ASL: "ASL Alphabet Test" (danrasband, Kaggle) — webcam-style photos, varied backgrounds.
ISL: "Indian Sign Language (ISL)" (prathumarikeri, Kaggle) — other signers and cameras.
Both are used for evaluation only (never for training, never shipped).

Landmarks come from the same hand_landmarker.task the web app uses (IMAGE mode, the
extract_asl padding ladder), features from bridgify_ml.features, predictions from the
exported web model (numpy forward). Results are cached in data/processed/ood_*.parquet.

Usage: uv run python -m bridgify_ml.eval_ood [--per-class 60] [--model-dir ../web/public/models]
"""
from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

from . import features as F
from .export import numpy_forward
from .robustness import load_model

ROOT = Path(__file__).resolve().parents[2]
EVAL = ROOT / "ml/data/raw/eval"
PROC = ROOT / "ml/data/processed"
TASK = ROOT / "ml/models_src/hand_landmarker.task"
_lm = {}


def landmarker(n: int):
    if n not in _lm:
        import mediapipe as mp
        from mediapipe.tasks.python import BaseOptions, vision
        opts = vision.HandLandmarkerOptions(base_options=BaseOptions(model_asset_path=str(TASK)), running_mode=vision.RunningMode.IMAGE,
                                            num_hands=n, min_hand_detection_confidence=0.3, min_hand_presence_confidence=0.3, min_tracking_confidence=0.3)
        _lm[n] = (mp, vision.HandLandmarker.create_from_options(opts))
    return _lm[n]


def pad(im: Image.Image, frac: float, up: float) -> Image.Image:
    a = np.asarray(im)
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    col = tuple(int(v) for v in np.median(edge, 0))
    w, h = im.size
    pw, ph = int(w * frac), int(h * frac)
    out = Image.new("RGB", (w + 2 * pw, h + 2 * ph), col)
    out.paste(im, (pw, ph))
    return out.resize((int(out.width * up), int(out.height * up)))


def detect(path: Path, n: int):
    mp, det = landmarker(n)
    im0 = Image.open(path).convert("RGB")
    for im in (im0, pad(im0, 0.15, 1.5), pad(im0, 0.5, 2.0)):
        res = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(im)))
        if res.hand_landmarks:
            hands = [dict(lm=np.array([[p.x, p.y, p.z] for p in h], np.float64), hd=res.handedness[i][0].category_name)
                     for i, h in enumerate(res.hand_landmarks)]
            return hands, im.width / im.height
    return [], None


def collect(lang: str, per_class: int, seed=0) -> pd.DataFrame:
    cache = PROC / f"ood_{lang}.parquet"
    if cache.exists():
        return pd.read_parquet(cache)
    rng = np.random.default_rng(seed)
    base = EVAL / ("asl-test" if lang == "asl" else "isl-kaggle/Indian")
    rows = []
    for d in sorted(p for p in base.iterdir() if p.is_dir() and len(p.name) == 1 and p.name.isalpha()):
        files = sorted(d.glob("*.jp*g")) + sorted(d.glob("*.png"))
        if len(files) > per_class:
            files = [files[i] for i in rng.choice(len(files), per_class, replace=False)]
        for f in files:
            hands, aspect = detect(f, 1 if lang == "asl" else 2)
            rows.append(dict(letter=d.name.upper(), path=str(f.relative_to(EVAL)), n=len(hands), aspect=aspect or 1.0,
                             lm=[h["lm"].ravel().tolist() for h in hands], hd=[h["hd"] for h in hands]))
        print(f"  {lang} {d.name}: {len(files)} images", flush=True)
    df = pd.DataFrame(rows)
    df.to_parquet(cache)
    return df


def featurise(lang: str, df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    X, keep = [], []
    for i, r in df.iterrows():
        if r.n == 0:
            continue
        lms = [np.asarray(v, np.float64).reshape(21, 3) for v in r.lm]
        if lang == "asl":
            X.append(F.hand_block(lms[0], r.hd[0] == "Left", r.aspect))
        else:
            hands = [{"landmarks": l, "handedness": h} for l, h in zip(lms, r.hd)]
            X.append(F.isl_features(hands, r.aspect))
        keep.append(i)
    return np.array(X), np.array(keep)


def evaluate(lang: str, per_class: int, model_dir: Path, quiet=False):
    df = collect(lang, per_class)
    h, layers = load_model(model_dir, f"{lang}-letters")
    labels = h["labels"]
    df = df[df.letter.isin(labels)].reset_index(drop=True)
    X, keep = featurise(lang, df)
    y = np.array([labels.index(v) for v in df.letter.iloc[keep]])
    _, pr = numpy_forward(h, layers, X)
    pred = pr.argmax(-1); conf = pr.max(-1)
    acc = float((pred == y).mean())
    f1 = []
    for c in range(len(labels)):
        tp = ((pred == c) & (y == c)).sum(); fp = ((pred == c) & (y != c)).sum(); fn = ((pred != c) & (y == c)).sum()
        f1.append(2 * tp / max(2 * tp + fp + fn, 1))
    res = dict(lang=lang, images=len(df), detected=len(keep), acc=round(acc, 3), macro_f1=round(float(np.mean(f1)), 3),
               committed=round(float((conf >= 0.8).mean()), 3), committed_correct=round(float(((conf >= 0.8) & (pred == y)).sum() / max((conf >= 0.8).sum(), 1)), 3),
               top_predictions=Counter(labels[i] for i in pred).most_common(5),
               per_class={labels[c]: round(float((pred[y == c] == c).mean()), 2) for c in range(len(labels)) if (y == c).any()})
    if not quiet:
        print(f"\n{lang.upper()} out-of-distribution: {res['detected']}/{res['images']} hands found")
        print(f"  accuracy {res['acc']}  macro-F1 {res['macro_f1']}  committed (p>=0.8) {res['committed']}, of which correct {res['committed_correct']}")
        print(f"  most predicted: {res['top_predictions']}")
        print(f"  per letter: {res['per_class']}")
    return res, X, y, pr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-class", type=int, default=60)
    ap.add_argument("--model-dir", default=str(ROOT / "web/public/models"))
    a = ap.parse_args()
    for lang in ("asl", "isl"):
        evaluate(lang, a.per_class, Path(a.model_dir))


if __name__ == "__main__":
    main()
