"""Export trained models to the web dense format + write manifest.json (ML-PIPELINE §7).

Dense format
  <id>.bin   little-endian float32: for each layer, W row-major [out][in], then b[out]
  <id>.json  {id, version, featureSpec, F, labels, layers:[{in,out,activation}], mean, std,
              sha256 (of the .bin), bytes, kind, metrics, ...}
Forward (what mlp.ts must do): x = (x - mean) / std; for each layer h = W h + b, then
relu if activation == "relu"; softmax at the end. mean/std are stored float32-rounded.

uv run python -m bridgify_ml.export --asl runs/<asl run> --isl runs/<isl run>
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
WEB_MODELS = REPO / "web/public/models"
VERSION = "1.0.0"


def f32(a) -> list[float]:
    return [float(v) for v in np.asarray(a, dtype=np.float32).reshape(-1)]


def sha256_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def layers_from_run(run: Path, chosen: str):
    """Returns list of (W [out,in] float32, b float32, activation)."""
    if chosen == "mlp":
        ck = torch.load(run / "model.pt", weights_only=False)
        assert len(ck["states"]) == 1, "export supports a single MLP"
        sd = ck["states"][0]
        lin = sorted({k.rsplit(".", 1)[0] for k in sd if k.endswith(".weight")}, key=lambda s: int(s.split(".")[1]))
        out = []
        for i, name in enumerate(lin):
            act = "relu" if i < len(lin) - 1 else "none"
            out.append((sd[name + ".weight"].numpy().astype(np.float32), sd[name + ".bias"].numpy().astype(np.float32), act))
        return out
    lr = np.load(run / "lr.npz")
    return [(lr["W"].astype(np.float32), lr["b"].astype(np.float32), "none")]


def write_dense(model_id: str, layers, mean, std, header: dict) -> dict:
    WEB_MODELS.mkdir(parents=True, exist_ok=True)
    buf = b"".join(np.ascontiguousarray(W, dtype="<f4").tobytes() + np.ascontiguousarray(b, dtype="<f4").tobytes()
                   for W, b, _ in layers)
    bin_path = WEB_MODELS / f"{model_id}.bin"
    bin_path.write_bytes(buf)
    h = dict(
        id=model_id, version=VERSION, **header,
        layers=[dict(**{"in": int(W.shape[1]), "out": int(W.shape[0])}, activation=a) for W, b, a in layers],
        mean=f32(mean), std=f32(std),
        sha256=sha256_file(bin_path), bytes=len(buf),
    )
    assert h["layers"][0]["in"] == h["F"] and h["layers"][-1]["out"] == len(h["labels"])
    (WEB_MODELS / f"{model_id}.json").write_text(json.dumps(h, indent=1))
    return h


def read_dense(model_id: str):
    """Load an exported model back from disk (what the web sees)."""
    h = json.loads((WEB_MODELS / f"{model_id}.json").read_text())
    raw = np.frombuffer((WEB_MODELS / f"{model_id}.bin").read_bytes(), dtype="<f4")
    assert hashlib.sha256(raw.tobytes()).hexdigest() == h["sha256"]
    layers, o = [], 0
    for L in h["layers"]:
        n = L["in"] * L["out"]
        W = raw[o:o + n].reshape(L["out"], L["in"]); o += n
        b = raw[o:o + L["out"]]; o += L["out"]
        layers.append((W, b, L["activation"]))
    assert o == len(raw)
    return h, layers


def numpy_forward(h: dict, layers, x: np.ndarray):
    """Reference forward pass in float64 arithmetic over float32 parameters. Returns (logits, probs)."""
    x = (np.asarray(x, dtype=np.float64) - np.asarray(h["mean"], np.float64)) / np.asarray(h["std"], np.float64)
    for W, b, act in layers:
        x = x @ W.astype(np.float64).T + b.astype(np.float64)
        if act == "relu":
            x = np.maximum(x, 0.0)
    z = x - x.max(-1, keepdims=True)
    e = np.exp(z)
    return x, e / e.sum(-1, keepdims=True)


def letter_header(run: Path, lang: str, licence: str, source: str) -> tuple[dict, list, np.ndarray, np.ndarray]:
    rep = json.loads((run / "report.json").read_text())
    chosen = "mlp" if rep["chosen"] == "mlp" else "logreg"
    layers = layers_from_run(run, "mlp" if chosen == "mlp" else "lr")
    norm = np.load(run / "norm.npz")
    header = dict(
        featureSpec="v1", F=int(layers[0][0].shape[1]), labels=rep["labels"], kind=chosen,
        metrics=dict(heldOutMacroF1=rep["held_out_macro_f1"], heldOutAccuracy=rep["held_out_acc"],
                     perClassF1=rep["per_class_f1"], nTest=rep["n"]["test"], signersTest=rep["signers_test"],
                     split=rep["split"], run=run.name),
        licence=licence, trainingData=source,
    )
    return header, layers, norm["mean"], norm["std"]


def manifest(entries: list[dict]):
    (WEB_MODELS / "manifest.json").write_text(json.dumps(dict(version=VERSION, models=entries), indent=1))


def file_entry(name: str) -> dict:
    p = WEB_MODELS / name
    return dict(url=f"/models/{name}", bytes=p.stat().st_size, sha256=sha256_file(p))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--asl", required=True)
    ap.add_argument("--isl", required=True)
    a = ap.parse_args()
    entries = []
    for mid, src in [("hand_landmarker", "hand_landmarker.task"), ("face_landmarker", "face_landmarker.task")]:
        f = file_entry(src)
        entries.append(dict(id=mid, kind="mediapipe-task", **f, files=dict(task=f),
                            licence="Apache-2.0",
                            source=f"https://storage.googleapis.com/mediapipe-models/{mid}/{mid}/float16/latest/{mid}.task"))

    specs = [
        ("asl-letters", Path(a.asl), "asl", "Weights: Bridgify. Training data ASL-HG (CC-BY-4.0, attribution required).",
         "HF juanjodurillo/asl-hg (landmarks extracted with hand_landmarker.task)"),
        ("isl-letters", Path(a.isl), "isl", "CC-BY-SA-4.0 (derived from the Dwibon ISL landmark dataset; share-alike).",
         "Kaggle dwibonbhargabdeka/isl-dataset-mediapipe-hand-landmarks"),
    ]
    for mid, run, lang, lic, src in specs:
        run = run if run.is_absolute() else ROOT / run
        header, layers, mean, std = letter_header(run, lang, lic, src)
        h = write_dense(mid, layers, mean, std, header)
        entries.append(dict(id=mid, kind=f"dense-{h['kind']}", version=VERSION, featureSpec="v1",
                            **file_entry(f"{mid}.json"),
                            files=dict(json=file_entry(f"{mid}.json"), bin=file_entry(f"{mid}.bin")),
                            licence=lic, source=src, metrics=dict(heldOutMacroF1=h["metrics"]["heldOutMacroF1"])))
        print(mid, h["kind"], h["F"], len(h["labels"]), h["bytes"], "heldOut", round(h["metrics"]["heldOutMacroF1"], 4))

    # emotion (logistic regression on 52 blendshapes)
    em = np.load(ROOT / "runs/emotion/emotion_lr.npz")
    rep = json.loads((ROOT / "runs/emotion/model_report.json").read_text())
    from .emotion import EMOTIONS
    lic = "Non-commercial research use only (trained on KDEF; KDEF terms apply)."
    src = "KDEF via Kaggle muhammadnafian/kdef-dataset (views S, HL, HR), blendshapes from face_landmarker.task"
    h = write_dense("emotion", [(em["W"].astype(np.float32), em["b"].astype(np.float32), "none")], em["mean"], em["std"], dict(
        featureSpec="blendshapes52-v1", F=52, labels=EMOTIONS, kind="logreg", featureNames=rep["featureNames"],
        metrics=dict(heldOutMacroF1=rep["test_macro_f1"], heldOutAccuracy=rep["test_acc"], perClassF1=rep["test_per_class_f1"],
                     nTest=rep["n"]["test"], peopleTest=rep["n"]["people_test"], perView=rep["test_per_view"], C=rep["C"]),
        licence=lic, trainingData=src))
    entries.append(dict(id="emotion", kind="dense-logreg", version=VERSION, featureSpec="blendshapes52-v1",
                        **file_entry("emotion.json"),
                        files=dict(json=file_entry("emotion.json"), bin=file_entry("emotion.bin")),
                        licence=lic, source=src, metrics=dict(heldOutMacroF1=h["metrics"]["heldOutMacroF1"])))
    print("emotion", h["bytes"], round(h["metrics"]["heldOutMacroF1"], 4))
    manifest(entries)


if __name__ == "__main__":
    main()
