"""Tune gesture-rule thresholds on HaGRID 2-D landmarks, split by user_id.

Data: HaGRID `ann_test/*.json` (its own users, disjoint from HaGRID train). For each
image we take the hand box whose label is the gesture and that has 21 landmarks.
Mapping: like->thumbs_up, dislike->thumbs_down, palm/stop->open_palm, one->pointing,
peace->peace, fist->fist. Negatives that must come out as `none`: call, ok, rock,
three. (`four` is left out: the open_palm rule ignores the thumb by design.) Users are split 70/30 (seeded shuffle of sorted user ids).
Objective on the train users: mean per-class recall over the 7 expected labels.

uv run python -m bridgify_ml.tune_gestures
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from .gestures import DEFAULT_PARAMS, LABELS, classify

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw/hagrid"
MAP = {"like": "thumbs_up", "dislike": "thumbs_down", "palm": "open_palm", "stop": "open_palm",
       "one": "pointing", "peace": "peace", "fist": "fist",
       "call": "none", "ok": "none", "rock": "none", "three": "none"}
EXPECTED = ["thumbs_up", "thumbs_down", "open_palm", "pointing", "peace", "fist", "none"]
GRID = dict(
    finger_ratio=[1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.4],
    thumb_ratio=[1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6],
    thumb_away=[0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4],
    thumb_ip_max_deg=[30.0, 45.0, 60.0, 90.0, 120.0, 180.0],
    dir_margin=[0.0, 0.05, 0.1, 0.2, 0.3],
    dir_vertical=[0.25, 0.5, 0.75, 1.0, 1.5],
    palm_needs_thumb=[True, False],
)


def load():
    lms, ys, src, users = [], [], [], []
    for cls, lab in MAP.items():
        d = json.load(open(RAW / f"{cls}.json"))
        for v in d.values():
            for bl, lm in zip(v["labels"], v["landmarks"]):
                if bl == cls and lm is not None and len(lm) == 21:
                    lms.append(np.asarray(lm, dtype=np.float64))
                    ys.append(lab)
                    src.append(cls)
                    users.append(v["user_id"])
                    break
    return np.stack(lms), np.array(ys), np.array(src), np.array(users)


def per_class_recall(y, p, classes=EXPECTED):
    return {c: float((p[y == c] == c).mean()) for c in classes if (y == c).any()}


def objective(y, p):
    return float(np.mean(list(per_class_recall(y, p).values())))


def search(lm, y, seed=0, n_random=3000):
    rng = np.random.default_rng(seed)
    keys = list(GRID)
    best, best_p = -1, None
    cands = [dict(DEFAULT_PARAMS)] + [{k: GRID[k][rng.integers(len(GRID[k]))] for k in keys} for _ in range(n_random)]
    for c in cands:
        s = objective(y, classify(lm, c))
        if s > best:
            best, best_p = s, c
    # coordinate refinement
    improved = True
    while improved:
        improved = False
        for k in keys:
            for v in GRID[k]:
                c = dict(best_p, **{k: v})
                s = objective(y, classify(lm, c))
                if s > best + 1e-9:
                    best, best_p, improved = s, c, True
    return best_p, best


def main():
    lm, y, src, users = load()
    uniq = np.array(sorted(set(users)))
    rng = np.random.default_rng(0)
    rng.shuffle(uniq)
    test_users = set(uniq[: int(round(0.3 * len(uniq)))])
    te = np.array([u in test_users for u in users])
    params, tr_score = search(lm[~te], y[~te])
    p_te = classify(lm[te], params)
    p_tr = classify(lm[~te], params)
    p_def = classify(lm[te], DEFAULT_PARAMS)
    labels_all = EXPECTED + ["ily"]
    conf = {t: {p: int(((y[te] == t) & (p_te == p)).sum()) for p in labels_all} for t in EXPECTED}
    by_src = {s: {"n": int((src[te] == s).sum()), "acc": float((p_te[src[te] == s] == MAP[s]).mean())}
              for s in MAP}
    pos = y[te] != "none"
    res = dict(
        params=params,
        n=dict(total=int(len(y)), train=int((~te).sum()), test=int(te.sum()),
               users_total=int(len(uniq)), users_test=len(test_users)),
        train_mean_recall=tr_score,
        test_mean_recall=objective(y[te], p_te),
        test_acc_positive=float((p_te[pos] == y[te][pos]).mean()),
        test_acc_all=float((p_te == y[te]).mean()),
        test_per_class=per_class_recall(y[te], p_te),
        test_per_source=by_src,
        test_confusion=conf,
        default_params_test_mean_recall=objective(y[te], p_def),
        train_per_class=per_class_recall(y[~te], p_tr),
    )
    out = ROOT / "runs/gestures"
    out.mkdir(parents=True, exist_ok=True)
    json.dump(res, open(out / "report.json", "w"), indent=1)
    np.savez(out / "split.npz", te=te)
    print(json.dumps({k: v for k, v in res.items() if k not in ("test_confusion",)}, indent=1))


if __name__ == "__main__":
    main()
