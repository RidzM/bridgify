"""Robustness of the shipped letter models to real-camera variation.

Held-out signers' landmarks are put through simulated view changes (the hand
rolled in the image plane, and turned left/right or up/down), and through
"in-between" poses (halfway between two different letters, as happens while a
hand moves or rests). We report accuracy, how often each wrong letter wins, and
how often a wrong letter would be *committed* (probability >= 0.8, the app's bar).

Usage:  uv run python -m bridgify_ml.robustness [--model-dir ../web/public/models]
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

import numpy as np

from . import features as F
from .data import load_asl, load_isl, subset
from .export import numpy_forward

ROOT = Path(__file__).resolve().parents[2]


def rot(yaw, pitch, roll):
    """Rotation matrices (N,3,3): roll about the camera axis (z), yaw about y, pitch about x."""
    cy, sy, cp, sp, cr, sr = np.cos(yaw), np.sin(yaw), np.cos(pitch), np.sin(pitch), np.cos(roll), np.sin(roll)
    o, z = np.ones_like(yaw), np.zeros_like(yaw)
    Rz = np.stack([np.stack([cr, -sr, z], -1), np.stack([sr, cr, z], -1), np.stack([z, z, o], -1)], -2)
    Ry = np.stack([np.stack([cy, z, sy], -1), np.stack([z, o, z], -1), np.stack([-sy, z, cy], -1)], -2)
    Rx = np.stack([np.stack([o, z, z], -1), np.stack([z, cp, -sp], -1), np.stack([z, sp, cp], -1)], -2)
    return Rz @ Ry @ Rx


def view_change(p: np.ndarray, R: np.ndarray) -> np.ndarray:
    """p: (N,21,3) normalised (wrist origin, z weighted). Rotate in true 3-D, re-normalise."""
    q = p.copy()
    q[..., 2] /= F.Z_WEIGHT
    q = np.einsum("nij,nkj->nki", R, q)
    q[..., 2] *= F.Z_WEIGHT
    q = q - q[:, :1]
    sc = np.maximum(np.linalg.norm(q[:, 9], axis=-1), F.SCALE_EPS)
    return q / sc[:, None, None]


def load_model(model_dir: Path, model_id: str):
    h = json.loads((model_dir / f"{model_id}.json").read_text())
    raw = np.frombuffer((model_dir / f"{model_id}.bin").read_bytes(), dtype="<f4")
    layers, o = [], 0
    for L in h["layers"]:
        n = L["in"] * L["out"]
        W = raw[o:o + n].reshape(L["out"], L["in"]); o += n
        b = raw[o:o + L["out"]]; o += L["out"]
        layers.append((W, b, L["activation"]))
    return h, layers


def blocks(lang, d, R=None):
    if lang == "asl":
        p = F.normalise_hand(d["lm0"], d["mirror0"], d["aspect"])
        return F.block_from_normalised(view_change(p, R) if R is not None else p)
    p0 = F.normalise_hand(d["lm0"], True, d["aspect"])
    p1 = F.normalise_hand(d["lm1"], False, d["aspect"])
    if R is not None:
        p0, p1 = view_change(p0, R), view_change(p1, R)
    b0 = np.where(d["p0"][:, None], F.block_from_normalised(p0), 0.0)
    b1 = np.where(d["p1"][:, None], F.block_from_normalised(p1), 0.0)
    return np.concatenate([b0, b1, np.stack([d["p0"], d["p1"]], -1).astype(float)], -1)


def report(lang: str, model_dir: Path, seed=0):
    rng = np.random.default_rng(seed)
    if lang == "asl":
        d = load_asl(); te = subset(d, np.isin(d["group"], ["P9", "P10"]))
    else:
        _, te = load_isl()
    h, layers = load_model(model_dir, f"{lang}-letters")
    labels = h["labels"]
    keep = np.isin(te["y"], labels)
    te = subset(te, keep)
    y = np.array([labels.index(v) for v in te["y"]])
    n = len(y)
    out = {"lang": lang, "n": int(n), "conditions": []}
    for name, roll, turn in [("as captured", 0, 0), ("roll ±15°", 15, 0), ("roll ±30°", 30, 0),
                             ("turn ±20°", 0, 20), ("turn ±35°", 0, 35), ("roll ±25° + turn ±30°", 25, 30)]:
        R = None
        if roll or turn:
            R = rot(np.deg2rad(rng.uniform(-turn, turn, n)), np.deg2rad(rng.uniform(-turn, turn, n)), np.deg2rad(rng.uniform(-roll, roll, n)))
        _, pr = numpy_forward(h, layers, blocks(lang, te, R))
        pred = pr.argmax(-1); conf = pr.max(-1)
        wrong = pred != y
        commit_wrong = wrong & (conf >= 0.8)
        top_wrong = Counter(labels[i] for i in pred[wrong]).most_common(3)
        out["conditions"].append(dict(name=name, acc=round(float((~wrong).mean()), 3),
                                      wrong_committed=round(float(commit_wrong.mean()), 3), top_wrong=top_wrong))
    # In-between poses: halfway between two samples of different letters.
    i = rng.integers(0, n, 4000); j = rng.integers(0, n, 4000)
    m = y[i] != y[j]; i, j = i[m], j[m]
    mid = {k: (v[i] if k not in ("lm0", "lm1") else (v[i] + v[j]) / 2) for k, v in te.items()}
    if lang == "isl":
        mid["p0"] = te["p0"][i] & te["p0"][j]; mid["p1"] = te["p1"][i] & te["p1"][j]
    _, pr = numpy_forward(h, layers, blocks(lang, mid))
    pred = pr.argmax(-1); conf = pr.max(-1)
    out["in_between"] = dict(n=int(len(pred)), committed=round(float((conf >= 0.8).mean()), 3),
                             committed_top=Counter(labels[k] for k in pred[conf >= 0.8]).most_common(4))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", default=str(ROOT / "web/public/models"))
    a = ap.parse_args()
    for lang in ("asl", "isl"):
        r = report(lang, Path(a.model_dir))
        print(f"\n{lang.upper()}  held-out samples: {r['n']}")
        for c in r["conditions"]:
            print(f"  {c['name']:<24} acc {c['acc']:.3f}   wrong & committed {c['wrong_committed']:.3f}   most common wrong: {c['top_wrong']}")
        ib = r["in_between"]
        print(f"  in-between poses: {ib['committed']:.3f} committed as a letter; top: {ib['committed_top']}")


if __name__ == "__main__":
    main()
