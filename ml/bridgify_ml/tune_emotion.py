"""Tune emotion-rule weights on KDEF blendshapes: 50 people train, 20 held-out people test.

People = sex+id (F01..F35, M01..M35); both photo sessions (A, B) of a person stay on the
same side. Views S, HL, HR. Coordinate search over each weight/bias on a fixed grid,
objective = macro-F1 on the 50 training people, with random restarts.
Reference only (not shipped): multinomial logistic regression on all 52 blendshapes.

uv run python -m bridgify_ml.tune_emotion
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix, f1_score, accuracy_score

from .emotion import EMOTIONS, SHAPE, default_weights, predict

ROOT = Path(__file__).resolve().parents[1]
W_GRID = [0.0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0, 12.0, 16.0]
B_GRID = list(np.round(np.linspace(-2.0, 2.0, 81), 3))


def split_people(df, seed=0):
    people = np.array(sorted(df.person.unique()))
    rng = np.random.default_rng(seed)
    rng.shuffle(people)
    return set(people[:50]), set(people[50:])


def mf1(y, p):
    return float(f1_score(y, p, average="macro", labels=EMOTIONS))


def params(w):
    keys = [(e, t) for e in SHAPE for t in SHAPE[e]] + [("bias", e) for e in EMOTIONS]
    return keys


def coord_search(df, w0, rng, passes=6):
    w = copy.deepcopy(w0)
    y = df.emotion.to_numpy()
    best = mf1(y, predict(df, w))
    for _ in range(passes):
        improved = False
        keys = params(w)
        rng.shuffle(keys)
        for e, t in keys:
            if e == "bias":
                grid = B_GRID
            elif SHAPE[e][t] < 0:
                grid = [-v for v in W_GRID]
            else:
                grid = W_GRID
            cur = w[e][t]
            for v in grid:
                w[e][t] = float(v)
                s = mf1(y, predict(df, w))
                if s > best + 1e-9:
                    best, cur, improved = s, float(v), True
            w[e][t] = cur
        if not improved:
            break
    return w, best


def main():
    df = pd.read_parquet(ROOT / "data/processed/kdef_blendshapes.parquet")
    df = df[df.detected].reset_index(drop=True)
    tr_p, te_p = split_people(df)
    tr, te = df[df.person.isin(tr_p)].reset_index(drop=True), df[df.person.isin(te_p)].reset_index(drop=True)
    rng = np.random.default_rng(0)
    w_def = default_weights()
    best_w, best_s = coord_search(tr, w_def, rng)
    for r in range(5):  # random restarts
        w0 = default_weights()
        for e in SHAPE:
            for t in SHAPE[e]:
                w0[e][t] = float(np.sign(SHAPE[e][t]) * rng.choice(W_GRID[1:]))
        w, s = coord_search(tr, w0, rng)
        print(f"restart {r}: train macro-F1 {s:.4f}", flush=True)
        if s > best_s:
            best_w, best_s = w, s
    yte = te.emotion.to_numpy()
    pte = predict(te, best_w)
    p_def = predict(te, w_def)
    cm = confusion_matrix(yte, pte, labels=EMOTIONS)
    per = f1_score(yte, pte, average=None, labels=EMOTIONS)
    per_view = {v: dict(acc=float(accuracy_score(yte[te.view == v], pte[te.view == v])),
                        macro_f1=mf1(yte[te.view == v], pte[te.view == v])) for v in ("S", "HL", "HR")}
    bs_cols = [c for c in df.columns if c not in ("file", "session", "person", "emotion", "view", "detected")]
    lr = LogisticRegression(C=1.0, max_iter=5000).fit(tr[bs_cols].to_numpy(), tr.emotion)
    plr = lr.predict(te[bs_cols].to_numpy())
    res = dict(
        n=dict(train=len(tr), test=len(te), people_train=len(tr_p), people_test=len(te_p),
               dropped_no_face=int((~pd.read_parquet(ROOT / "data/processed/kdef_blendshapes.parquet").detected).sum())),
        test_people=sorted(te_p),
        weights=best_w,
        train_macro_f1=best_s,
        test_macro_f1=mf1(yte, pte), test_acc=float(accuracy_score(yte, pte)),
        test_per_class_f1={e: float(v) for e, v in zip(EMOTIONS, per)},
        test_per_view=per_view,
        confusion_labels=EMOTIONS, confusion=cm.tolist(),
        untuned_shape_test_macro_f1=mf1(yte, p_def), untuned_shape_test_acc=float(accuracy_score(yte, p_def)),
        reference_logreg_52_test_macro_f1=mf1(yte, plr), reference_logreg_52_test_acc=float(accuracy_score(yte, plr)),
    )
    out = ROOT / "runs/emotion"
    out.mkdir(parents=True, exist_ok=True)
    json.dump(res, open(out / "report.json", "w"), indent=1)
    print(json.dumps({k: v for k, v in res.items() if k not in ("confusion", "test_people")}, indent=1))


if __name__ == "__main__":
    main()
