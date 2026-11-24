"""Emotion classifier: multinomial logistic regression on all 52 FaceLandmarker blendshapes.

Same people split as the rules (tune_emotion.split_people: 50 train / 20 held-out).
C is chosen by 5-fold person-grouped CV on the 50 training people only.
Input order = FaceLandmarker categories by index (0 = "_neutral" ... 51).
Standardise with train mean/std, then one dense layer (52 -> 7), softmax.

uv run python -m bridgify_ml.emotion_model
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from sklearn.model_selection import GroupKFold

from .emotion import EMOTIONS
from .tune_emotion import split_people

ROOT = Path(__file__).resolve().parents[1]
META = ("file", "session", "person", "emotion", "view", "detected")


def main():
    df = pd.read_parquet(ROOT / "data/processed/kdef_blendshapes.parquet")
    df = df[df.detected].reset_index(drop=True)
    names = [c for c in df.columns if c not in META]
    assert len(names) == 52 and names[0] == "_neutral"
    tr_p, te_p = split_people(df)
    tr, te = df[df.person.isin(tr_p)], df[df.person.isin(te_p)]
    lab = {e: i for i, e in enumerate(EMOTIONS)}
    Xtr, ytr = tr[names].to_numpy(np.float64), tr.emotion.map(lab).to_numpy()
    Xte, yte = te[names].to_numpy(np.float64), te.emotion.map(lab).to_numpy()
    cv = {}
    for C in [0.01, 0.03, 0.1, 0.3, 1.0, 3.0, 10.0]:
        scores = []
        for a, b in GroupKFold(5).split(Xtr, ytr, tr.person):
            m, s = Xtr[a].mean(0), Xtr[a].std(0)
            s = np.where(s < 1e-8, 1.0, s)
            clf = LogisticRegression(C=C, max_iter=5000).fit((Xtr[a] - m) / s, ytr[a])
            scores.append(f1_score(ytr[b], clf.predict((Xtr[b] - m) / s), average="macro"))
        cv[C] = float(np.mean(scores))
    C = max(cv, key=cv.get)
    mean, std = Xtr.mean(0), Xtr.std(0)
    std = np.where(std < 1e-8, 1.0, std)
    clf = LogisticRegression(C=C, max_iter=5000).fit((Xtr - mean) / std, ytr)
    assert list(clf.classes_) == list(range(7))
    p = clf.predict((Xte - mean) / std)
    res = dict(
        C=C, cv_macro_f1_by_C=cv, featureNames=names,
        test_macro_f1=float(f1_score(yte, p, average="macro")), test_acc=float(accuracy_score(yte, p)),
        test_per_class_f1={e: float(v) for e, v in zip(EMOTIONS, f1_score(yte, p, average=None, labels=range(7)))},
        test_per_view={v: dict(acc=float(accuracy_score(yte[te.view == v], p[te.view == v])),
                               macro_f1=float(f1_score(yte[te.view == v], p[te.view == v], average="macro")))
                       for v in ("S", "HL", "HR")},
        confusion_labels=EMOTIONS, confusion=confusion_matrix(yte, p, labels=range(7)).tolist(),
        n=dict(train=len(tr), test=len(te), people_train=len(tr_p), people_test=len(te_p)),
    )
    out = ROOT / "runs/emotion"
    out.mkdir(parents=True, exist_ok=True)
    json.dump(res, open(out / "model_report.json", "w"), indent=1)
    np.savez(out / "emotion_lr.npz", W=clf.coef_, b=clf.intercept_, mean=mean, std=std)
    print(json.dumps({k: v for k, v in res.items() if k not in ("featureNames", "confusion")}, indent=1))


if __name__ == "__main__":
    main()
