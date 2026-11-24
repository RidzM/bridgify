"""Leave-one-signer-out model selection for ASL on P1-P8 only (P9-P10 never touched).

For each signer s in P1..P8: train on the other 7, score macro-F1 on s.
Compares logistic regression (C=10, the val pick) and the MLP config (fixed epochs,
no early stopping, so no signer leaks into model choice), plus their average-prob ensemble.

uv run python -m bridgify_ml.loso --name base [--cfg '{...}']
"""

from __future__ import annotations

import argparse
import copy
import json

import numpy as np
from sklearn.linear_model import LogisticRegression

from .data import ASL_LABELS, load_asl, subset
from .train import DEFAULT, RUNS, Featuriser, macro_f1, mlp_predict_proba, train_mlp


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="base")
    ap.add_argument("--cfg", default="{}")
    ap.add_argument("--epochs", type=int, default=30)
    a = ap.parse_args()
    cfg = copy.deepcopy(DEFAULT)
    for k, v in json.loads(a.cfg).items():
        if k == "aug" and isinstance(v, dict):
            cfg["aug"].update(v)
        else:
            cfg[k] = v
    cfg["epochs"] = a.epochs
    cfg["patience"] = 10**9
    feat = Featuriser("asl")
    d = load_asl()
    lab2i = {l: i for i, l in enumerate(ASL_LABELS)}
    d["yi"] = np.array([lab2i[v] for v in d["y"]])
    dev = subset(d, np.isin(d["group"], [f"P{i}" for i in range(1, 9)]))
    X = feat.clean(dev)
    res = {}
    for s in [f"P{i}" for i in range(1, 9)]:
        tr, va = subset(dev, dev["group"] != s), subset(dev, dev["group"] == s)
        Xtr, Xva = X[dev["group"] != s], X[dev["group"] == s]
        mean, std = Xtr.mean(0), Xtr.std(0)
        std = np.where(std < 1e-8, 1.0, std)
        lr = LogisticRegression(C=cfg.get("lr_C_loso", 10.0), max_iter=3000).fit((Xtr - mean) / std, tr["yi"])
        plr = lr.predict_proba((Xva - mean) / std)
        pm = np.mean([mlp_predict_proba(train_mlp(tr, Xva, va["yi"], feat, mean, std, 24, cfg, seed, lambda *_: None)[0],
                                        Xva, mean, std) for seed in cfg["seeds"]], 0)
        res[s] = dict(lr=macro_f1(va["yi"], plr.argmax(1)), mlp=macro_f1(va["yi"], pm.argmax(1)),
                      ens=macro_f1(va["yi"], (pm + plr).argmax(1)))
        print(s, {k: round(v, 4) for k, v in res[s].items()}, flush=True)
    mean_ = {k: float(np.mean([r[k] for r in res.values()])) for k in ("lr", "mlp", "ens")}
    print("MEAN", mean_)
    out = RUNS / "loso"
    out.mkdir(parents=True, exist_ok=True)
    json.dump(dict(name=a.name, cfg=cfg, per_signer=res, mean=mean_), open(out / f"asl-{a.name}.json", "w"), indent=1)


if __name__ == "__main__":
    main()
