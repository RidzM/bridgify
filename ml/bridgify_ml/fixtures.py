"""Write parity fixtures for the TypeScript port (web/src/engines/vision/__fixtures__/).

  features.json       20 raw MediaPipe-style frames -> expected feature vectors (features.py)
  mlp-asl.json        10 feature vectors -> expected logits/probs (numpy forward of exported files)
  mlp-isl.json        same for ISL
  gestures.json       30 landmark samples -> expected gesture label (gestures.py)
  emotion.json        20 blendshape vectors -> expected rule scores + label (emotion.py)
  emotion-model.json  10 blendshape vectors -> expected probabilities (numpy forward)

uv run python -m bridgify_ml.fixtures
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from . import emotion as EM
from . import features as F
from . import gestures as G
from .data import DWIBON_ASPECT, load_asl, load_isl
from .export import numpy_forward, read_dense

ROOT = Path(__file__).resolve().parents[1]
FIX = ROOT.parent / "web/src/engines/vision/__fixtures__"


def r(a):
    return [float(v) for v in np.asarray(a, dtype=np.float64).reshape(-1)]


def lmlist(a):
    return [[float(v) for v in p] for p in np.asarray(a, dtype=np.float64)]


def features_fixture(rng):
    frames = []
    asl = load_asl()
    te = np.where(np.isin(asl["group"], ["P9", "P10"]))[0]
    left = te[asl["handedness"][te] == "Left"]
    right = te[asl["handedness"][te] == "Right"]
    pick = list(rng.choice(left, min(3, len(left)), replace=False)) + list(rng.choice(right, 9 - min(3, len(left)), replace=False))
    for i in pick:
        lm = asl["lm0"][i]
        hands = [dict(landmarks=lmlist(lm), handedness=str(asl["handedness"][i]))]
        exp = F.asl_features(lm, asl["handedness"][i], asl["aspect"][i])
        frames.append(dict(id=f"asl-{asl['path'][i]}", lang="asl", label=str(asl["y"][i]), aspect=float(asl["aspect"][i]),
                           hands=hands, expected=r(exp)))
    _, isl = load_isl()
    two = np.where(isl["p0"] & isl["p1"])[0]
    one_r = np.where(~isl["p0"] & isl["p1"])[0]
    one_l = np.where(isl["p0"] & ~isl["p1"])[0]
    chosen = [(i, "two") for i in rng.choice(two, 9, replace=False)]
    chosen += [(rng.choice(one_r), "right-only")]
    chosen += [(rng.choice(one_l), "left-only")] if len(one_l) else [(rng.choice(one_r), "right-only")]
    for k, (i, kind) in enumerate(chosen):
        # Dwibon rows are wrist-relative; place the wrists in the frame to make raw image
        # coords. Features must equal those of the wrist-relative row (translation invariance).
        w0 = np.array([0.30 + 0.05 * rng.random(), 0.55 + 0.1 * rng.random(), 0.0])
        w1 = np.array([0.65 + 0.05 * rng.random(), 0.55 + 0.1 * rng.random(), 0.0])
        hands = []
        if isl["p0"][i]:
            hands.append(dict(landmarks=lmlist(isl["lm0"][i] + w0), handedness="Left"))
        if isl["p1"][i]:
            hands.append(dict(landmarks=lmlist(isl["lm1"][i] + w1), handedness="Right"))
        if kind == "two" and k % 2 == 1:
            hands = hands[::-1]  # detector order reversed: port must sort by wrist x
        exp = F.isl_features([dict(landmarks=np.array(h["landmarks"]), handedness=h["handedness"]) for h in hands], DWIBON_ASPECT)
        ref = F.isl_features_from_slots(isl["lm0"][i], isl["lm1"][i], isl["p0"][i], isl["p1"][i], DWIBON_ASPECT)
        assert np.allclose(exp, ref, atol=1e-9), "translation invariance broken"
        frames.append(dict(id=f"isl-{kind}-{i}", lang="isl", label=str(isl["y"][i]), aspect=DWIBON_ASPECT,
                           hands=hands, expected=r(exp)))
    return dict(
        featureSpec=F.FEATURE_SPEC, tolerance=1e-5,
        notes=("hands[] are in detector order. landmarks = MediaPipe normalised image coords [x,y,z]. "
               "ASL: F=91, mirror if handedness=='Left'. ISL: F=184, two hands sorted by wrist x (slot0 = smaller x, "
               "mirrored), one hand -> slot0 if 'Left' else slot1; missing slot = 91 zeros; last 2 = presence mask. "
               "ISL frames were built from Dwibon wrist-relative rows by adding a wrist position."),
        featureNames=F.FEATURE_NAMES_HAND,
        frames=frames,
    )


def mlp_fixture(model_id, X, rng):
    h, layers = read_dense(model_id)
    idx = rng.choice(len(X), 10, replace=False)
    logits, probs = numpy_forward(h, layers, X[idx])
    return dict(model=f"/models/{model_id}.json", sha256=h["sha256"], kind=h["kind"], tolerance=dict(logits=1e-4, probs=1e-5),
                notes="input = raw feature vector (before standardisation). Expected computed in numpy float64 over the float32 params.",
                labels=h["labels"],
                cases=[dict(input=r(X[i]), logits=r(lg), probs=r(p), argmax=h["labels"][int(p.argmax())])
                       for i, lg, p in zip(idx, logits, probs)])


def gestures_fixture(rng, params):
    from .tune_gestures import load, MAP
    lm, y, src, users = load()
    te = np.load(ROOT / "runs/gestures/split.npz")["te"]
    samples = []
    for s in MAP:
        cand = np.where(te & (src == s))[0]
        for i in rng.choice(cand, 2, replace=False):
            samples.append((lm[i], s, 1.0))
    # Synthetic ILY (HaGRID has no I-love-you class): take a held-out open palm, fold
    # middle and ring fingers onto the palm (tip/DIP/PIP pulled to their MCP), keep
    # thumb, index, pinky.
    palms = np.where(te & (src == "palm"))[0]
    made = 0
    for i in rng.permutation(palms):
        q = lm[i].copy()
        for mcp, chain in ((9, (10, 11, 12)), (13, (14, 15, 16))):
            for k, j in enumerate(chain):
                q[j] = q[mcp] + (q[0] - q[mcp]) * 0.15 * (k + 1)
        if G.classify_one(q, params)["name"] == "ily":
            samples.append((q, "synthetic_ily", 1.0))
            made += 1
            if made == 3:
                break
    # Same HaGRID hand, frame declared 16:9 (x scaled by aspect inside the rules)
    i = rng.choice(np.where(te & (src == "like"))[0])
    samples.append((lm[i], "like_aspect_16_9", 16 / 9))
    # top up to 30 with random held-out samples (any class, right or wrong)
    for i in rng.choice(np.where(te)[0], 30 - len(samples), replace=False):
        samples.append((lm[i], str(src[i]), 1.0))
    samples = samples[:30]
    out = []
    for q, s, asp in samples:
        res = G.classify_one(q, params, asp)
        out.append(dict(source=s, aspect=asp, landmarks=[[float(a), float(b)] for a, b in q[:, :2]],
                        expected=res["name"], extended=res["extended"]))
    return dict(params=params, notes="landmarks are 2-D [x,y] normalised image coords (y down). expected = gestures.py output.",
                samples=out)


def emotion_fixtures(rng, weights):
    df = pd.read_parquet(ROOT / "data/processed/kdef_blendshapes.parquet")
    df = df[df.detected].reset_index(drop=True)
    names = [c for c in df.columns if c not in ("file", "session", "person", "emotion", "view", "detected")]
    idx = []
    for e in EM.EMOTIONS:
        idx += list(rng.choice(np.where(df.emotion == e)[0], 3, replace=False))
    idx = idx[:20]
    rows = []
    for i in idx:
        bs = {n: float(df.loc[i, n]) for n in names}
        sc = EM.score(bs, weights)
        rows.append(dict(file=df.loc[i, "file"], truth=df.loc[i, "emotion"], blendshapes=bs,
                         scores={k: float(v) for k, v in sc.items()},
                         expected=str(EM.predict(bs, weights))))
    rules = dict(weights=weights, emotions=EM.EMOTIONS, tolerance=1e-9,
                 notes="raw rule scores before UI normalisation/EMA; expected = argmax (ties -> first in emotions order)",
                 cases=rows)
    h, layers = read_dense("emotion")
    assert h["featureNames"] == names
    sel = rng.choice(len(df), 10, replace=False)
    X = df.loc[sel, names].to_numpy(np.float64)
    logits, probs = numpy_forward(h, layers, X)
    model = dict(model="/models/emotion.json", sha256=h["sha256"], labels=h["labels"], tolerance=dict(logits=1e-4, probs=1e-5),
                 notes="input keyed by blendshape name; build the vector in featureNames order",
                 cases=[dict(file=df.loc[i, "file"], truth=df.loc[i, "emotion"],
                             input={n: float(v) for n, v in zip(names, x)}, logits=r(lg), probs=r(p),
                             argmax=h["labels"][int(p.argmax())])
                        for i, x, lg, p in zip(sel, X, logits, probs)])
    return rules, model


def main():
    FIX.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(7)
    (FIX / "features.json").write_text(json.dumps(features_fixture(rng)))
    asl = load_asl()
    from .train import Featuriser
    te = {k: v[np.isin(asl["group"], ["P9", "P10"])] for k, v in asl.items()}
    (FIX / "mlp-asl.json").write_text(json.dumps(mlp_fixture("asl-letters", Featuriser("asl").clean(te), rng)))
    _, isl = load_isl()
    (FIX / "mlp-isl.json").write_text(json.dumps(mlp_fixture("isl-letters", Featuriser("isl").clean(isl), rng)))
    gparams = json.loads((ROOT.parent / "content/gesture-thresholds.json").read_text())["params"]
    (FIX / "gestures.json").write_text(json.dumps(gestures_fixture(rng, gparams)))
    w = json.loads((ROOT.parent / "content/emotion-weights.json").read_text())
    w = {k: v for k, v in w.items() if not k.startswith("_")}
    rules, model = emotion_fixtures(rng, w)
    (FIX / "emotion.json").write_text(json.dumps(rules))
    (FIX / "emotion-model.json").write_text(json.dumps(model))
    for p in sorted(FIX.glob("*.json")):
        print(p.name, p.stat().st_size)


if __name__ == "__main__":
    main()
