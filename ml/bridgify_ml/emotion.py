"""Emotion scorer on MediaPipe FaceLandmarker blendshapes (SYSTEM-ARCHITECTURE §6.6 shape).

Port 1:1 to emotion.ts. Weights come from content/emotion-weights.json:
    { "<emotion>": { "<term>": weight, ... }, ..., "bias": { "<emotion>": b, ... } }

TERMS. A term is one blendshape or the mean of a Left/Right pair (MediaPipe names):
    mouthSmile    = (mouthSmileLeft + mouthSmileRight) / 2
    mouthFrown    = (mouthFrownLeft + mouthFrownRight) / 2
    eyeWide       = (eyeWideLeft + eyeWideRight) / 2
    browDown      = (browDownLeft + browDownRight) / 2
    mouthPress    = (mouthPressLeft + mouthPressRight) / 2
    noseSneer     = (noseSneerLeft + noseSneerRight) / 2
    mouthUpperUp  = (mouthUpperUpLeft + mouthUpperUpRight) / 2
    mouthStretch  = (mouthStretchLeft + mouthStretchRight) / 2
    browInnerUp, jawOpen  = the single blendshape

SCORES (raw, before the UI's normalisation and EMA):
    for e in [happy, surprised, sad, angry, disgusted, fearful]:
        score[e] = bias[e] + sum_t weights[e][t] * term[t]
    (sad's mouthSmile weight is negative: sad = mouthFrown + browInnerUp - mouthSmile)
    score[neutral] = 1 - max(score of the six above) + bias[neutral]
PREDICTION: argmax over the 7 scores; ties -> first in EMOTIONS order.
"""

from __future__ import annotations

import numpy as np

EMOTIONS = ["neutral", "happy", "surprised", "sad", "angry", "disgusted", "fearful"]
PAIRS = ["mouthSmile", "mouthFrown", "eyeWide", "browDown", "mouthPress", "noseSneer", "mouthUpperUp", "mouthStretch"]
SINGLE = ["browInnerUp", "jawOpen"]
TERMS = PAIRS + SINGLE
SHAPE = {
    "happy": {"mouthSmile": 1},
    "surprised": {"browInnerUp": 1, "eyeWide": 1, "jawOpen": 1},
    "sad": {"mouthFrown": 1, "browInnerUp": 1, "mouthSmile": -1},
    "angry": {"browDown": 1, "mouthPress": 1},
    "disgusted": {"noseSneer": 1, "mouthUpperUp": 1},
    "fearful": {"eyeWide": 1, "browInnerUp": 1, "mouthStretch": 1},
}


def terms_from_blendshapes(bs: dict | "pd.DataFrame") -> dict:
    """bs: mapping blendshape name -> value (scalars or arrays)."""
    t = {p: (np.asarray(bs[p + "Left"], dtype=np.float64) + np.asarray(bs[p + "Right"], dtype=np.float64)) / 2 for p in PAIRS}
    for s in SINGLE:
        t[s] = np.asarray(bs[s], dtype=np.float64)
    return t


def score(bs, weights: dict) -> dict:
    t = terms_from_blendshapes(bs)
    out = {}
    for e in EMOTIONS[1:]:
        v = weights["bias"].get(e, 0.0)
        for name, w in weights[e].items():
            v = v + w * t[name]
        out[e] = np.asarray(v, dtype=np.float64)
    mx = np.max(np.stack([out[e] for e in EMOTIONS[1:]]), axis=0)
    out["neutral"] = 1.0 - mx + weights["bias"].get("neutral", 0.0)
    return {e: out[e] for e in EMOTIONS}


def predict(bs, weights) -> np.ndarray:
    s = score(bs, weights)
    m = np.stack([s[e] for e in EMOTIONS], axis=-1)
    return np.array(EMOTIONS)[m.argmax(-1)]


def default_weights() -> dict:
    w = {e: dict(v) for e, v in SHAPE.items()}
    w["bias"] = {e: 0.0 for e in EMOTIONS}
    return w
