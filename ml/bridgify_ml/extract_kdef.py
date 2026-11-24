"""Run MediaPipe FaceLandmarker (blendshapes on) over KDEF straight + half-profile views.

KDEF file name: <session A|B><sex F|M><id 01-35><emotion AF|AN|DI|HA|NE|SA|SU><view S|HL|HR|FL|FR>.JPG
Person = sex+id (70 people, each photographed in two sessions A and B).
Only views S, HL, HR are used.

Usage: uv run python -m bridgify_ml.extract_kdef [--workers 2]
Output: data/processed/kdef_blendshapes.parquet (one row per image, 52 blendshape columns)
"""

from __future__ import annotations

import argparse
import json
import multiprocessing as mp_
import re
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw/kdef/KDEF"
OUT = ROOT / "data/processed"
MODEL = ROOT / "models_src/face_landmarker.task"
EMO = {"AF": "fearful", "AN": "angry", "DI": "disgusted", "HA": "happy", "NE": "neutral", "SA": "sad", "SU": "surprised"}
PAT = re.compile(r"^([AB])([FM])(\d\d)(AF|AN|DI|HA|NE|SA|SU)(S|HL|HR)\.JPG$", re.I)
_fl = None


def _init():
    global _fl
    from mediapipe.tasks.python import BaseOptions, vision

    _fl = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL)),
        running_mode=vision.RunningMode.IMAGE,
        num_faces=1,
        output_face_blendshapes=True,
        min_face_detection_confidence=0.3,
        min_face_presence_confidence=0.3,
    ))


def _work(path: str):
    import mediapipe as mp

    m = PAT.match(Path(path).name)
    session, sex, pid, emo, view = m.groups()
    im = Image.open(path).convert("RGB")
    res = _fl.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(np.asarray(im))))
    row = dict(file=Path(path).name, session=session.upper(), person=(sex + pid).upper(),
               emotion=EMO[emo.upper()], view=view.upper(), detected=bool(res.face_blendshapes))
    if res.face_blendshapes:
        for c in res.face_blendshapes[0]:
            row[c.category_name] = float(c.score)
    return row


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=2)
    args = ap.parse_args()
    files = sorted(str(p) for p in RAW.rglob("*") if PAT.match(p.name))
    with mp_.Pool(args.workers, initializer=_init) as pool:
        rows = pool.map(_work, files, chunksize=8)
    df = pd.DataFrame(rows)
    OUT.mkdir(parents=True, exist_ok=True)
    df.to_parquet(OUT / "kdef_blendshapes.parquet", index=False)
    summary = {"n": len(df), "detected": int(df.detected.sum()),
               "by_view": {v: float(g.detected.mean()) for v, g in df.groupby("view")},
               "people": int(df.person.nunique())}
    json.dump(summary, open(OUT / "kdef_detection.json", "w"), indent=1)
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
