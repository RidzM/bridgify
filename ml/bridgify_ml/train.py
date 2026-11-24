"""Train + evaluate letter classifiers (ML-PIPELINE §5-6).

uv run python -m bridgify_ml.train --lang asl --name base
uv run python -m bridgify_ml.train --lang isl --name base

Splits are by signer:
  ASL  train P1-P7, val P8, test P9-P10 (never used for any choice)
  ISL  Dwibon train file -> 85/15 stratified random train/val (no signer ids in the
       file), Dwibon held_out file (1 unseen signer) = test
Each run writes ml/runs/<date>-<lang>-<name>/report.json and model.pt / lr.npz.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import subprocess
import time
from pathlib import Path

import numpy as np
import torch
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix, f1_score, accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import SVC
from torch import nn

from . import features as F
from .data import ASL_LABELS, load_asl, load_isl, subset

ROOT = Path(__file__).resolve().parents[1]
RUNS = ROOT / "runs"

FINGER_LM = [list(c[1:]) for c in F.FINGER_CHAINS]
FINGER_TIP = list(F.TIPS)


def finger_feature_index(f: int) -> list[int]:
    """Indices inside a 91-block that belong to finger f (0 thumb .. 4 pinky)."""
    idx = [3 * l + a for l in FINGER_LM[f] for a in range(3)]
    idx += [63 + 3 * f + j for j in range(3)]
    tip = FINGER_TIP[f]
    idx += [78 + k for k, (a, b) in enumerate(F.TIP_PAIRS) if tip in (a, b)]
    return idx


FINGER_IDX = [np.array(finger_feature_index(f)) for f in range(5)]


# ------------------------------------------------------------------ augmentation

def augment_normalised(p: np.ndarray, rng: np.random.Generator, cfg: dict) -> np.ndarray:
    """p: (N,21,3) normalised landmarks (wrist at origin). Returns re-normalised copy."""
    n = len(p)
    q = p.copy()
    th = np.deg2rad(rng.uniform(-cfg["rot"], cfg["rot"], n))
    c, s = np.cos(th), np.sin(th)
    x, y = q[..., 0].copy(), q[..., 1].copy()
    q[..., 0] = c[:, None] * x - s[:, None] * y
    q[..., 1] = s[:, None] * x + c[:, None] * y
    q[..., 0] *= rng.uniform(*cfg["sx"], n)[:, None]
    q[..., 1] *= rng.uniform(*cfg["sy"], n)[:, None]
    q += rng.normal(0, cfg["jitter"], q.shape)
    q[..., 2] += rng.normal(0, cfg["znoise"], q.shape[:-1])
    q = q - q[:, :1]
    sc = np.maximum(np.linalg.norm(q[:, 9], axis=-1), F.SCALE_EPS)
    return q / sc[:, None, None]


def finger_dropout(x: np.ndarray, rng, p: float, n_blocks: int) -> np.ndarray:
    """In standardised space, set one random finger's features to 0 (= train mean)."""
    x = x.copy()
    for b in range(n_blocks):
        hit = np.where(rng.random(len(x)) < p)[0]
        fing = rng.integers(0, 5, len(hit))
        for f in range(5):
            rows = hit[fing == f]
            if len(rows):
                x[np.ix_(rows, FINGER_IDX[f] + 91 * b)] = 0.0
    return x


# ------------------------------------------------------------------ featurise

class Featuriser:
    def __init__(self, lang: str):
        self.lang = lang
        self.F = F.ASL_F if lang == "asl" else F.ISL_F
        self.n_blocks = 1 if lang == "asl" else 2

    def clean(self, d: dict) -> np.ndarray:
        if self.lang == "asl":
            return F.hand_block(d["lm0"], d["mirror0"], d["aspect"])
        return F.isl_features_from_slots(d["lm0"], d["lm1"], d["p0"], d["p1"], d["aspect"])

    def augmented(self, d: dict, rng, cfg) -> np.ndarray:
        if self.lang == "asl":
            p = F.normalise_hand(d["lm0"], d["mirror0"], d["aspect"])
            return F.block_from_normalised(augment_normalised(p, rng, cfg))
        p0 = F.normalise_hand(d["lm0"], True, d["aspect"])
        p1 = F.normalise_hand(d["lm1"], False, d["aspect"])
        b0 = F.block_from_normalised(augment_normalised(p0, rng, cfg))
        b1 = F.block_from_normalised(augment_normalised(p1, rng, cfg))
        b0 = np.where(d["p0"][:, None], b0, 0.0)
        b1 = np.where(d["p1"][:, None], b1, 0.0)
        x = np.concatenate([b0, b1, np.stack([d["p0"], d["p1"]], -1).astype(float)], -1)
        if cfg.get("swap", 0) > 0:
            sw = rng.random(len(x)) < cfg["swap"]
            x[sw] = F.isl_block_swap(x[sw])
        return x


# ------------------------------------------------------------------ model

class MLP(nn.Module):
    def __init__(self, f_in: int, n_out: int, hidden=(128, 64), dropout=0.2):
        super().__init__()
        layers, prev = [], f_in
        for h in hidden:
            layers += [nn.Linear(prev, h), nn.ReLU(), nn.Dropout(dropout)]
            prev = h
        layers.append(nn.Linear(prev, n_out))
        self.net = nn.Sequential(*layers)

    def forward(self, x):
        return self.net(x)


def macro_f1(y, p):
    return float(f1_score(y, p, average="macro"))


def train_mlp(tr: dict, Xva, yva, feat: Featuriser, mean, std, n_cls, cfg, seed, log):
    torch.manual_seed(seed)
    rng = np.random.default_rng(seed)
    model = MLP(feat.F, n_cls, tuple(cfg["hidden"]), cfg["dropout"])
    opt = torch.optim.AdamW(model.parameters(), lr=cfg["lr"], weight_decay=cfg["wd"])
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=cfg["epochs"])
    w = None
    if cfg.get("class_weights"):
        cnt = np.bincount(tr["yi"], minlength=n_cls).astype(float)
        w = torch.tensor(cnt.sum() / (n_cls * np.maximum(cnt, 1)), dtype=torch.float32)
    lossf = nn.CrossEntropyLoss(weight=w, label_smoothing=cfg["label_smoothing"])
    xva = torch.tensor((Xva - mean) / std, dtype=torch.float32)
    best, best_state, best_ep, bad = -1.0, None, -1, 0
    for ep in range(cfg["epochs"]):
        model.train()
        X = feat.augmented(tr, rng, cfg["aug"]) if cfg["aug"] else feat.clean(tr)
        X = (X - mean) / std
        if cfg["aug"] and cfg["aug"].get("finger_dropout", 0) > 0:
            X = finger_dropout(X, rng, cfg["aug"]["finger_dropout"], feat.n_blocks)
        Xt = torch.tensor(X, dtype=torch.float32)
        yt = torch.tensor(tr["yi"])
        perm = torch.randperm(len(Xt))
        for i in range(0, len(Xt), cfg["batch"]):
            b = perm[i:i + cfg["batch"]]
            opt.zero_grad()
            loss = lossf(model(Xt[b]), yt[b])
            loss.backward()
            opt.step()
        sched.step()
        model.eval()
        with torch.no_grad():
            pv = model(xva).argmax(1).numpy()
        f1 = macro_f1(yva, pv)
        if f1 > best + 1e-6:
            best, best_state, best_ep, bad = f1, copy.deepcopy(model.state_dict()), ep, 0
        else:
            bad += 1
        if ep % 10 == 0 or ep == cfg["epochs"] - 1:
            log(f"  ep {ep:3d} loss {loss.item():.4f} val macroF1 {f1:.4f}")
        if bad >= cfg["patience"]:
            log(f"  early stop at ep {ep}")
            break
    model.load_state_dict(best_state)
    model.eval()
    return model, best, best_ep


def mlp_predict_proba(model, X, mean, std):
    with torch.no_grad():
        return torch.softmax(model(torch.tensor((X - mean) / std, dtype=torch.float32)), 1).numpy()


DEFAULT = dict(
    hidden=[128, 64], dropout=0.2, lr=3e-3, wd=1e-4, epochs=60, batch=256,
    label_smoothing=0.05, patience=20, class_weights=False,
    aug=dict(rot=15, sx=[0.9, 1.1], sy=[0.9, 1.1], jitter=0.01, znoise=0.01, finger_dropout=0.1, swap=0.0),
    lr_C=1.0, seeds=[0], ensemble_lr=False, feature_subset="all",
)


def subset_mask(name: str, lang: str) -> np.ndarray:
    """Feature subsets for honest ablations (mask over F)."""
    hand = np.ones(91, bool)
    if name == "no_coords":
        hand[:63] = False
    elif name == "eng_only_plus_tips":
        hand[:63] = False
        for l in F.TIPS:
            hand[3 * l:3 * l + 3] = True
    if lang == "asl":
        return hand
    return np.concatenate([hand, hand, [True, True]])


def git_sha():
    try:
        return subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", "HEAD"], text=True).strip()
    except Exception:
        return None


def run(lang: str, name: str, cfg: dict):
    t0 = time.time()
    stamp = dt.date.today().isoformat()
    out = RUNS / f"{stamp}-{lang}-{name}"
    out.mkdir(parents=True, exist_ok=True)
    lines = []

    def log(s):
        print(s, flush=True)
        lines.append(s)

    feat = Featuriser(lang)
    if lang == "asl":
        d = load_asl()
        labels = ASL_LABELS
        g = d["group"]
        tr = subset(d, np.isin(g, [f"P{i}" for i in range(1, 8)]))
        va = subset(d, g == "P8")
        te = subset(d, np.isin(g, ["P9", "P10"]))
        split = dict(train="P1-P7", val="P8", test="P9-P10")
        signers_test = ["P9", "P10"]
    else:
        dtrain, te = load_isl()
        labels = sorted(set(dtrain["y"]))
        idx = np.arange(len(dtrain["y"]))
        itr, iva = train_test_split(idx, test_size=0.15, random_state=0, stratify=dtrain["y"])
        tr, va = subset(dtrain, itr), subset(dtrain, iva)
        split = dict(train="Dwibon combined_train 85% (stratified, seed 0)",
                     val="Dwibon combined_train 15%", test="Dwibon held_out_dataset.csv (1 unseen signer)")
        signers_test = ["dwibon_heldout_signer"]
    lab2i = {l: i for i, l in enumerate(labels)}
    for s in (tr, va, te):
        s["yi"] = np.array([lab2i[v] for v in s["y"]])
    n_cls = len(labels)

    Xtr, Xva, Xte = feat.clean(tr), feat.clean(va), feat.clean(te)
    mask = subset_mask(cfg["feature_subset"], lang)
    mean = Xtr.mean(0)
    std = Xtr.std(0)
    std = np.where(std < 1e-8, 1.0, std)
    if not mask.all():
        # Masked features become constant 0 after standardisation (mean, std=1 trick):
        # we keep F unchanged so the exported format and TS port stay identical.
        std = np.where(mask, std, 1e12)
    Ztr, Zva, Zte = [(X - mean) / std for X in (Xtr, Xva, Xte)]
    log(f"[{lang}/{name}] n train {len(Xtr)} val {len(Xva)} test {len(Xte)} F {feat.F} C {n_cls}")

    results = {}
    # ---- baselines (no augmentation)
    knn = KNeighborsClassifier(5).fit(Ztr, tr["yi"])
    best_lr, best_lr_f1 = None, -1
    for C in [0.1, 1.0, 10.0]:
        m = LogisticRegression(C=C, max_iter=3000).fit(Ztr, tr["yi"])
        f = macro_f1(va["yi"], m.predict(Zva))
        log(f"  LR C={C} val {f:.4f}")
        if f > best_lr_f1:
            best_lr, best_lr_f1, best_C = m, f, C
    best_svm, best_svm_f1 = None, -1
    for C in [1.0, 10.0]:
        m = SVC(C=C, gamma="scale").fit(Ztr, tr["yi"])
        f = macro_f1(va["yi"], m.predict(Zva))
        if f > best_svm_f1:
            best_svm, best_svm_f1, svm_C = m, f, C
    for nm, m in [("knn5", knn), (f"logreg_C{best_C}", best_lr), (f"svm_rbf_C{svm_C}", best_svm)]:
        results[nm] = dict(val=macro_f1(va["yi"], m.predict(Zva)), test=macro_f1(te["yi"], m.predict(Zte)),
                           test_acc=float(accuracy_score(te["yi"], m.predict(Zte))))
        log(f"  {nm}: val {results[nm]['val']:.4f} test {results[nm]['test']:.4f}")

    # ---- MLP (one or more seeds)
    models = []
    for seed in cfg["seeds"]:
        model, vf1, ep = train_mlp(tr, Xva, va["yi"], feat, mean, std, n_cls, cfg, seed, log)
        models.append(model)
        log(f"  MLP seed {seed}: best val {vf1:.4f} @ep {ep}")
    pva = np.mean([mlp_predict_proba(m, Xva, mean, std) for m in models], 0)
    pte = np.mean([mlp_predict_proba(m, Xte, mean, std) for m in models], 0)
    results["mlp"] = dict(val=macro_f1(va["yi"], pva.argmax(1)), test=macro_f1(te["yi"], pte.argmax(1)),
                          test_acc=float(accuracy_score(te["yi"], pte.argmax(1))), best_epoch=ep)
    log(f"  mlp: val {results['mlp']['val']:.4f} test {results['mlp']['test']:.4f}")
    if cfg.get("ensemble_lr"):
        pe = (pte + best_lr.predict_proba(Zte)) / 2
        pev = (pva + best_lr.predict_proba(Zva)) / 2
        results["mlp+lr"] = dict(val=macro_f1(va["yi"], pev.argmax(1)), test=macro_f1(te["yi"], pe.argmax(1)))
        log(f"  mlp+lr: val {results['mlp+lr']['val']:.4f} test {results['mlp+lr']['test']:.4f}")

    # ---- choice: by VAL macro-F1 only (MLP must beat LR by >= 0.03 on val, else LR)
    lr_key = f"logreg_C{best_C}"
    choose_mlp = results["mlp"]["val"] >= results[lr_key]["val"] + 0.03 or cfg.get("force") == "mlp"
    if cfg.get("force") == "lr":
        choose_mlp = False
    chosen = "mlp" if choose_mlp else lr_key
    if chosen == "mlp":
        ptest = pte
    else:
        ptest = best_lr.predict_proba(Zte)
    ypred = ptest.argmax(1)
    per_class = f1_score(te["yi"], ypred, average=None, labels=range(n_cls))
    cm = confusion_matrix(te["yi"], ypred, labels=range(n_cls))
    report = dict(
        lang=lang, name=name, date=stamp, git_sha=git_sha(), config=cfg, split=split,
        n=dict(train=len(Xtr), val=len(Xva), test=len(Xte)), labels=labels, results=results,
        chosen=chosen, held_out_macro_f1=macro_f1(te["yi"], ypred),
        held_out_acc=float(accuracy_score(te["yi"], ypred)),
        per_class_f1={l: float(v) for l, v in zip(labels, per_class)}, confusion=cm.tolist(),
        signers_test=signers_test, seconds=time.time() - t0,
    )
    json.dump(report, open(out / "report.json", "w"), indent=1)
    torch.save(dict(states=[m.state_dict() for m in models], hidden=cfg["hidden"], F=feat.F, C=n_cls), out / "model.pt")
    np.savez(out / "lr.npz", W=best_lr.coef_, b=best_lr.intercept_)
    np.savez(out / "norm.npz", mean=mean, std=std)
    (out / "log.txt").write_text("\n".join(lines))
    log(f"  chosen {chosen}: held-out macro-F1 {report['held_out_macro_f1']:.4f} ({time.time() - t0:.0f}s) -> {out}")
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", required=True, choices=["asl", "isl"])
    ap.add_argument("--name", default="base")
    ap.add_argument("--cfg", default="{}", help="JSON overrides of DEFAULT")
    a = ap.parse_args()
    cfg = copy.deepcopy(DEFAULT)
    over = json.loads(a.cfg)
    if a.lang == "isl":
        cfg["aug"]["swap"] = 0.5
        cfg["aug"]["sx"] = [0.85, 1.2]
    for k, v in over.items():
        if k == "aug" and isinstance(v, dict) and cfg["aug"]:
            cfg["aug"].update(v)
        else:
            cfg[k] = v
    run(a.lang, a.name, cfg)


if __name__ == "__main__":
    main()
