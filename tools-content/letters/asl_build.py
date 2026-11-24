"""ASL letter + number diagrams from real signer data (ASL-HG, CC-BY-4.0).

For every class (A-Z, 0-9) the drawn hand is the medoid: the training-signer (P1-P8)
sample closest to the class mean in normalised-landmark space (ml/bridgify_ml/features.py
normalise_hand). Only samples MediaPipe labels "Right" are used: in this MediaPipe build
the label follows how the hand looks in the image, and ASL-HG photos are taken from the
viewer's side, so a "Right" sample already is the signer's right hand as the viewer sees
it (no mirroring needed). J and Z also get a motion arrow (traced from the signer's
point of view, so the viewer sees the J hook and the Z reversed).

Inputs:  ml/data/processed/asl_hg_landmarks.parquet (24 static letters, from ml/)
         .cache/asl_extra_landmarks.parquet (J, Z, 0-9; asl_extract.py)
Outputs: web/public/signs/asl/letters/<A-Z>.svg, web/public/signs/asl/numbers/<0-9>.svg,
         medoids.json ("asl" section: which photo each diagram comes from)
Run:     cd ml && uv run python -I ../tools-content/letters/asl_build.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from bridgify_ml.features import normalise_hand  # noqa: E402
from common import CACHE, ML, SIGNS, aspect_fix, medoid, update_provenance  # noqa: E402
import handsvg  # noqa: E402

TRAIN = {f"P{i}" for i in range(1, 9)}
CLASSES = [chr(65 + i) for i in range(26)] + [str(d) for d in range(10)]
# ASL-HG "0" photos show the O hand held sideways in front of the other, open hand: the
# one-hand detector often returns the open hand and the O-shaped detections are edge-on,
# so the number 0 is drawn from the letter-O medoid (ASL 0 and O share the handshape).
SAME_AS = {"0": "O"}


def load() -> pd.DataFrame:
    a = pd.read_parquet(ML / "data/processed/asl_hg_landmarks.parquet")
    b = pd.read_parquet(CACHE / "asl_extra_landmarks.parquet")
    df = pd.concat([a, b], ignore_index=True)
    df = df[(df.attempt >= 0) & df.participant.isin(TRAIN) & (df.handedness == "Right")]
    return df.reset_index(drop=True)


def j_arrow(p: np.ndarray) -> np.ndarray:
    """Pinky traces a J from the signer's side: down, then the hook toward the viewer's right.
    Drawn just outside the little-finger edge, starting level with the pinky tip."""
    s = handsvg.hand_size(p)
    tip = p[20, :2]
    x0, y0 = tip[0] - 0.32 * s, tip[1] + 0.02 * s
    return np.array([
        [x0, y0],
        [x0, y0 + 0.55 * s], [x0 - 0.05 * s, y0 + 1.05 * s], [x0 + 0.25 * s, y0 + 1.1 * s],
        [x0 + 0.5 * s, y0 + 1.15 * s], [x0 + 0.62 * s, y0 + 0.95 * s], [x0 + 0.62 * s, y0 + 0.78 * s],
    ])


def z_arrow(p: np.ndarray) -> np.ndarray:
    """Index traces a Z from the signer's side, so the viewer sees it reversed:
    top stroke right-to-left, diagonal down to the right, bottom stroke right-to-left."""
    s = handsvg.hand_size(p)
    tip = p[8, :2]
    w, h = 0.62 * s, 0.5 * s
    x0, y0 = tip[0] - w / 2 + 0.1 * s, tip[1] - h - 0.16 * s
    return np.array([[x0 + w, y0], [x0, y0], [x0 + w, y0 + h], [x0, y0 + h]])


def main() -> None:
    df = load()
    prov = {}
    sizes = []
    for c in CLASSES:
        src = SAME_AS.get(c, c)
        g = df[df.letter == src]
        lm = np.stack(g.lm.to_numpy()).reshape(-1, 21, 3)
        P = normalise_hand(lm, False, g.aspect.to_numpy())
        i, dist = medoid(P)
        row = g.iloc[i]
        p = aspect_fix(row.lm, row.aspect)
        arrow = None
        if c == "J":
            arrow = (j_arrow(p), True)
        elif c == "Z":
            arrow = (z_arrow(p), False)
        kind = "letter" if c.isalpha() else "number"
        svg = handsvg.render(f"ASL {kind} {c}", [p], arrow)
        out = SIGNS / "asl" / ("letters" if c.isalpha() else "numbers") / f"{c}.svg"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(svg)
        sizes.append(len(svg.encode()))
        prov[c] = {"file": row.path, "signer": row.participant, "n": int(len(g)),
                   "distToMean": round(dist, 4), "mirrored": False}
        if src != c:
            prov[c]["sameAs"] = src
        print(f"{c}: {row.path} (n={len(g)}, d={dist:.3f}) {len(svg.encode())} B")
    update_provenance("asl", {"source": "ASL-HG (juanjodurillo/asl-hg, train split P1-P8)",
                              "classes": prov})
    print(f"max size {max(sizes)} B")


if __name__ == "__main__":
    main()
