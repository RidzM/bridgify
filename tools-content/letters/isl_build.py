"""ISL letter + number diagrams from real signer data.

Sources
  * Dwibon ISL landmarks (Kaggle dwibonbhargabdeka, CC-BY-SA-4.0), training file only:
    23 letters (no H, J, Y). Rows hold each hand's 21 landmarks relative to its own wrist.
  * Kaggle prathumarikeri/indian-sign-language-isl (CC-BY-SA-4.0) photos for H, J, Y and
    1-9, run through MediaPipe with num_hands=2 (isl_extract.py).
  * 0: ISL zero is the same O handshape as ASL zero (ISLRTC numbers chart; the Kaggle
    dataset notes say the same), so it reuses the ASL-HG letter-O diagram.

Medoid: per class, the sample closest to the class mean in normalised-landmark space
(features.normalise_hand per hand, both hands concatenated for two-handed letters; for a
letter whose rows mix one- and two-hand detections, the majority pattern is used).

Viewer's view (right-handed signer, right hand on the viewer's left)
  * Dwibon: "right_*" is the hand used for the one-handed letters, but its geometry is
    left-handed in the stored coordinates (the frames were selfie-mirrored), so every
    Dwibon hand is mirrored (x -> -x). Wrist positions were not recorded, so the two hands
    are placed side by side with a fixed gap: right hand on the viewer's left. The
    relative placement of the two hands is schematic.
  * Kaggle letters (H, J, Y): photos are taken from the viewer's side, so both hands are
    drawn where they are in the photo (real relative placement, no mirroring).
  * Kaggle numbers: one hand; when MediaPipe sees a left hand it is mirrored so every
    number is shown as a right hand.

Outputs: web/public/signs/isl/letters/<A-Z>.svg, web/public/signs/isl/numbers/<0-9>.svg,
         medoids.json ("isl" section)
Run:     cd ml && uv run python -I ../tools-content/letters/isl_build.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from bridgify_ml.features import normalise_hand  # noqa: E402
from common import CACHE, ML, SIGNS, aspect_fix, medoid, mirror, update_provenance  # noqa: E402
import handsvg  # noqa: E402

DWIBON = ML / "data/raw/dwibon/combined_train_dataset.csv"
DWIBON_ASPECT = 4 / 3  # capture size not recorded; same assumption as ml/bridgify_ml/data.py
GAP = 0.45  # schematic gap between the two hands, in hand sizes
MOTION = {"H", "J", "Y"}  # dynamic letters (ISLRTC chart arrows); only J gets a drawn path


def _hands(d: pd.DataFrame, side: str) -> np.ndarray:
    cols = [f"{side}_lm{i}_{c}" for i in range(21) for c in "xyz"]
    return d[cols].to_numpy(np.float64).reshape(-1, 21, 3)


def side_by_side(dominant: np.ndarray, other: np.ndarray) -> list[np.ndarray]:
    """Dominant hand on the viewer's left, other hand on the right, bounding boxes a fixed
    gap apart and vertically centred on each other."""
    s = (handsvg.hand_size(dominant) + handsvg.hand_size(other)) / 2
    out = []
    for p, sign in ((dominant, -1), (other, 1)):
        q = p.copy()
        lo, hi = q[:, :2].min(0), q[:, :2].max(0)
        edge = hi[0] if sign < 0 else lo[0]
        q[:, 0] += sign * GAP * s / 2 - edge
        q[:, 1] -= (lo[1] + hi[1]) / 2
        out.append(q)
    return out


def write(c: str, svg: str) -> int:
    out = SIGNS / "isl" / ("letters" if c.isalpha() else "numbers") / f"{c}.svg"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(svg)
    return len(svg.encode())


def title(c: str) -> str:
    return f"ISL {'letter' if c.isalpha() else 'number'} {c}"


def build_dwibon(prov: dict, sizes: dict) -> None:
    d = pd.read_csv(DWIBON)
    d["label"] = d["label"].astype(str)
    L, R = _hands(d, "left"), _hands(d, "right")
    pl, pr = np.abs(L).sum((1, 2)) > 0, np.abs(R).sum((1, 2)) > 0
    for c in sorted(d.label.unique()):
        rows = (d.label == c).to_numpy()
        pats = pd.Series(list(zip(pl[rows], pr[rows]))).value_counts()
        two = pats.index[0] == (True, True)
        if not two:
            assert pats.index[0] == (False, True), (c, pats)
        sel = rows & pr & (pl if two else ~pl)
        feats = [normalise_hand(R[sel], False, DWIBON_ASPECT).reshape(sel.sum(), -1)]
        if two:
            feats.append(normalise_hand(L[sel], False, DWIBON_ASPECT).reshape(sel.sum(), -1))
        i, dist = medoid(np.concatenate(feats, 1))
        idx = np.flatnonzero(sel)[i]
        right = mirror(aspect_fix(R[idx], DWIBON_ASPECT))
        hands = [right]
        if two:
            hands = side_by_side(right, mirror(aspect_fix(L[idx], DWIBON_ASPECT)))
        sizes[c] = write(c, handsvg.render(title(c), hands))
        prov[c] = {"source": "dwibon", "file": f"combined_train_dataset.csv row {idx + 2}",
                   "hands": 2 if two else 1, "n": int(sel.sum()), "distToMean": round(dist, 4),
                   "mirrored": True, "placement": "schematic" if two else "single"}


def j_arrow(jhand: np.ndarray) -> tuple[np.ndarray, bool]:
    """ISLRTC chart J: the other index runs along the L-shaped hand from the index tip
    toward the thumb, then up the thumb (arrowhead at the thumb tip)."""
    s = handsvg.hand_size(jhand)
    tip, base, thumb_tip, thumb_base = jhand[8, :2], jhand[5, :2], jhand[4, :2], jhand[2, :2]
    lift = np.array([0.0, -0.22 * s])
    a = tip + lift
    side = np.array([0.22 * s, 0.0]) * np.sign(tip[0] - thumb_base[0])
    b = np.array([thumb_base[0], base[1]]) + side + lift
    e = thumb_tip + side + np.array([0.0, -0.05 * s])
    return np.array([a, (a + b) / 2, b + (a - b) * 0.15, b, b, e + (b - e) * 0.3, e]), True


def build_kaggle(prov: dict, sizes: dict) -> None:
    k = pd.read_parquet(CACHE / "isl_kaggle_landmarks.parquet")
    k = k[k.hand >= 0]
    for c in ["H", "J", "Y"]:
        g = k[(k.label == c) & (k.n_hands == 2)]
        pairs = []
        for f, h in g.groupby("file"):
            hs = sorted(h.itertuples(), key=lambda r: r.lm[0])  # image-left wrist first
            pairs.append((f, hs[0], hs[1]))
        lab = pd.Series([(a.handedness, b.handedness) for _, a, b in pairs]).value_counts()
        A = np.stack([np.asarray(a.lm).reshape(21, 3) for _, a, _ in pairs])
        B = np.stack([np.asarray(b.lm).reshape(21, 3) for _, _, b in pairs])
        asp = np.array([a.aspect for _, a, _ in pairs])
        X = np.concatenate([normalise_hand(A, False, asp).reshape(len(A), -1),
                            normalise_hand(B, False, asp).reshape(len(B), -1)], 1)
        i, dist = medoid(X)
        f, a, b = pairs[i]
        hands = [aspect_fix(a.lm, a.aspect), aspect_fix(b.lm, b.aspect)]
        arrow = None
        if c == "J":
            # the L-shaped hand is the one whose thumb tip is highest above its wrist
            jh = min(hands, key=lambda p: p[4, 1] - p[0, 1])
            arrow = j_arrow(jh)
        sizes[c] = write(c, handsvg.render(title(c), hands, arrow))
        prov[c] = {"source": "isl-kaggle", "file": f, "hands": 2, "n": len(pairs),
                   "distToMean": round(dist, 4), "mirrored": False, "placement": "photo",
                   "labels": f"{a.handedness} (viewer's left), {b.handedness} (viewer's right)",
                   "labelCounts": {f"{x}/{y}": int(v) for (x, y), v in lab.items()}}
    for c in [str(n) for n in range(1, 10)]:
        g = k[k.label == c].sort_values("hand_score", ascending=False).drop_duplicates("file")
        lm = np.stack([np.asarray(v).reshape(21, 3) for v in g.lm])
        mir = (g.handedness == "Left").to_numpy()
        P = normalise_hand(lm, mir, g.aspect.to_numpy())
        i, dist = medoid(P)
        row = g.iloc[i]
        p = aspect_fix(row.lm, row.aspect)
        if row.handedness == "Left":
            p = mirror(p)
        sizes[c] = write(c, handsvg.render(title(c), [p]))
        prov[c] = {"source": "isl-kaggle", "file": row.file, "hands": 1, "n": int(len(g)),
                   "distToMean": round(dist, 4), "mirrored": bool(row.handedness == "Left"),
                   "leftShare": round(float(mir.mean()), 3)}


def build_zero(prov: dict, sizes: dict) -> None:
    src = (SIGNS / "asl/letters/O.svg").read_text()
    svg = src.replace("<title>ASL letter O</title>", f"<title>{title('0')}</title>")
    assert svg != src
    sizes["0"] = write("0", svg)
    prov["0"] = {"source": "asl-hg", "sameAs": "ASL letter O",
                 "note": "ISL 0 is the O handshape (ISLRTC numbers chart)"}


def main() -> None:
    prov, sizes = {}, {}
    build_dwibon(prov, sizes)
    build_kaggle(prov, sizes)
    build_zero(prov, sizes)
    for c in sorted(prov, key=lambda c: (c.isdigit(), c)):
        print(c, prov[c].get("file", prov[c].get("sameAs")), f"{sizes[c]} B",
              prov[c].get("labelCounts", ""), prov[c].get("leftShare", ""))
    update_provenance("isl", {"motion": sorted(MOTION), "classes": prov})
    print(f"max size {max(sizes.values())} B")


if __name__ == "__main__":
    main()
