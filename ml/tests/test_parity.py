"""Parity checks between the exported web models, numpy, torch and sklearn, and fixtures."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest
import torch

from bridgify_ml import emotion as EM
from bridgify_ml import features as F
from bridgify_ml import gestures as G
from bridgify_ml.export import numpy_forward, read_dense
from bridgify_ml.train import MLP

ROOT = Path(__file__).resolve().parents[1]
FIX = ROOT.parent / "web/src/engines/vision/__fixtures__"
RUNS = ROOT / "runs"


def _run_for(model_id):
    h, _ = read_dense(model_id)
    run = RUNS / h["metrics"]["run"]
    if not run.exists():
        pytest.skip(f"training run {run.name} not present (ml/runs is not committed)")
    return run, h


def _fix(name):
    return json.loads((FIX / name).read_text())


@pytest.mark.parametrize("model_id", ["asl-letters", "isl-letters"])
def test_numpy_forward_matches_torch_or_sklearn(model_id):
    run, h = _run_for(model_id)
    _, layers = read_dense(model_id)
    rng = np.random.default_rng(0)
    norm = np.load(run / "norm.npz")
    x = norm["mean"] + rng.normal(size=(64, h["F"])) * norm["std"]
    _, p_np = numpy_forward(h, layers, x)
    z = (x - np.asarray(h["mean"])) / np.asarray(h["std"])
    if h["kind"] == "mlp":
        ck = torch.load(run / "model.pt", weights_only=False)
        m = MLP(ck["F"], ck["C"], tuple(ck["hidden"]))
        m.load_state_dict(ck["states"][0])
        m.eval()
        with torch.no_grad():
            p_ref = torch.softmax(m(torch.tensor(z, dtype=torch.float32)), 1).double().numpy()
    else:
        lr = np.load(run / "lr.npz")
        lg = z @ lr["W"].T + lr["b"]
        e = np.exp(lg - lg.max(1, keepdims=True))
        p_ref = e / e.sum(1, keepdims=True)
    np.testing.assert_allclose(p_np, p_ref, atol=1e-5)


def test_emotion_model_matches_sklearn_formula():
    h, layers = read_dense("emotion")
    if not (RUNS / "emotion/emotion_lr.npz").exists():
        pytest.skip("emotion run not present")
    em = np.load(RUNS / "emotion/emotion_lr.npz")
    x = np.random.default_rng(1).random((32, 52))
    _, p = numpy_forward(h, layers, x)
    lg = ((x - em["mean"]) / em["std"]) @ em["W"].T + em["b"]
    e = np.exp(lg - lg.max(1, keepdims=True))
    np.testing.assert_allclose(p, e / e.sum(1, keepdims=True), atol=1e-5)


def test_features_fixture_reproduces():
    fx = _fix("features.json")
    assert len(fx["frames"]) == 20
    for fr in fx["frames"]:
        hands = [dict(landmarks=np.array(h["landmarks"]), handedness=h["handedness"]) for h in fr["hands"]]
        if fr["lang"] == "asl":
            got = F.asl_features(hands[0]["landmarks"], hands[0]["handedness"], fr["aspect"])
        else:
            got = F.isl_features(hands, fr["aspect"])
        np.testing.assert_allclose(got, fr["expected"], atol=1e-12)


def test_feature_invariances():
    rng = np.random.default_rng(3)
    lm = rng.random((21, 3)) * 0.2 + 0.4
    base = F.hand_block(lm, False, 4 / 3)
    shifted = lm + np.array([0.1, -0.05, 0.02])
    np.testing.assert_allclose(F.hand_block(shifted, False, 4 / 3), base, atol=1e-12)
    scaled = (lm - lm[0]) * 1.7 + lm[0]
    np.testing.assert_allclose(F.hand_block(scaled, False, 4 / 3), base, atol=1e-12)
    # horizontal frame flip == ISL block swap
    a = dict(landmarks=lm, handedness="Left")
    b = dict(landmarks=lm + np.array([0.3, 0.0, 0.0]), handedness="Right")
    x = F.isl_features([a, b])
    flip = lambda h, lab: dict(landmarks=h["landmarks"] * np.array([-1, 1, 1]) + np.array([1, 0, 0]), handedness=lab)
    xf = F.isl_features([flip(a, "Right"), flip(b, "Left")])
    np.testing.assert_allclose(xf, F.isl_block_swap(x), atol=1e-12)


@pytest.mark.parametrize("name,model_id", [("mlp-asl.json", "asl-letters"), ("mlp-isl.json", "isl-letters"),
                                           ("emotion-model.json", "emotion")])
def test_model_fixtures(name, model_id):
    fx = _fix(name)
    h, layers = read_dense(model_id)
    assert fx["sha256"] == h["sha256"]
    for c in fx["cases"]:
        x = c["input"] if isinstance(c["input"], list) else [c["input"][n] for n in h["featureNames"]]
        lg, p = numpy_forward(h, layers, np.array(x)[None])
        np.testing.assert_allclose(p[0], c["probs"], atol=1e-9)


def test_gesture_fixture():
    fx = _fix("gestures.json")
    assert len(fx["samples"]) == 30
    for s in fx["samples"]:
        assert G.classify_one(np.array(s["landmarks"]), fx["params"], s["aspect"])["name"] == s["expected"]
    assert any(s["expected"] == "ily" for s in fx["samples"])


def test_emotion_rule_fixture():
    fx = _fix("emotion.json")
    for c in fx["cases"]:
        sc = EM.score(c["blendshapes"], fx["weights"])
        for k, v in c["scores"].items():
            assert abs(float(sc[k]) - v) < 1e-12
        assert str(EM.predict(c["blendshapes"], fx["weights"])) == c["expected"]
