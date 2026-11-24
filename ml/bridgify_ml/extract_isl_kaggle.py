"""Extract hand landmarks from the Kaggle "Indian Sign Language (ISL)" photos (prathumarikeri, CC BY-SA 4.0).

Same hand_landmarker.task and padding ladder as the web app and extract_asl (IMAGE mode,
num_hands=2). Writes data/processed/isl_kaggle_landmarks.parquet with one row per image:
letter, path, n (hands found), aspect, lm (list of 63 floats per hand), hd (handedness per hand).

Download first:  kaggle datasets download -d prathumarikeri/indian-sign-language-isl -p data/raw/eval/isl-kaggle --unzip
Usage:           uv run python -m bridgify_ml.extract_isl_kaggle --workers 4
"""
from __future__ import annotations

import argparse
from multiprocessing import Pool
from pathlib import Path

import pandas as pd

from .eval_ood import EVAL, PROC, detect

BASE = EVAL / "isl-kaggle/Indian"
OUT = PROC / "isl_kaggle_landmarks.parquet"


def work(f: str):
    p = Path(f)
    hands, aspect = detect(p, 2)
    return dict(letter=p.parent.name.upper(), path=str(p.relative_to(EVAL)), n=len(hands), aspect=aspect or 1.0,
                lm=[h["lm"].ravel().tolist() for h in hands], hd=[h["hd"] for h in hands])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    files = [str(f) for d in sorted(BASE.iterdir()) if d.is_dir() and len(d.name) == 1 and d.name.isalpha()
             for f in sorted(d.glob("*.jp*g"))]
    print(f"{len(files)} images", flush=True)
    with Pool(a.workers) as pool:
        rows = []
        for i, r in enumerate(pool.imap(work, files, chunksize=64)):
            rows.append(r)
            if i % 2000 == 0:
                print(f"  {i}/{len(files)}", flush=True)
    df = pd.DataFrame(rows)
    df.to_parquet(OUT)
    print(f"wrote {OUT}: {len(df)} rows, hands found in {(df.n > 0).mean():.3f}, two hands in {(df.n == 2).mean():.3f}")


if __name__ == "__main__":
    main()
