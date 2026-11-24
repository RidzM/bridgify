"""Confusion-matrix PNGs for docs/eval/ from the run reports."""
import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ML = Path(sys.argv[1])
OUT = ML.parent / "docs/eval"
OUT.mkdir(parents=True, exist_ok=True)


def plot(cm, labels, title, path, ylabels=None):
    cm = np.asarray(cm, dtype=float)
    norm = cm / np.maximum(cm.sum(1, keepdims=True), 1)
    n = len(labels)
    fig, ax = plt.subplots(figsize=(max(5, 0.42 * n + 2), max(4.5, 0.42 * len(ylabels or labels) + 1.5)), dpi=130)
    ax.imshow(norm, cmap="Blues", vmin=0, vmax=1)
    ax.set_xticks(range(n), labels, rotation=90 if n > 8 else 30, fontsize=8)
    yl = ylabels or labels
    ax.set_yticks(range(len(yl)), yl, fontsize=8)
    for i in range(norm.shape[0]):
        for j in range(norm.shape[1]):
            if cm[i, j]:
                ax.text(j, i, int(cm[i, j]), ha="center", va="center", fontsize=6 if n > 12 else 8,
                        color="white" if norm[i, j] > 0.5 else "#222")
    ax.set_xlabel("predicted"); ax.set_ylabel("true"); ax.set_title(title, fontsize=10)
    fig.tight_layout(); fig.savefig(path); plt.close(fig)
    print("wrote", path)


for lang in ("asl", "isl"):
    r = json.loads((ML / f"runs/2026-11-25-{lang}-robust2/report.json").read_text())
    plot(r["confusion"], r["labels"], f"{lang.upper()} held-out ({r['chosen']}), macro-F1 {r['held_out_macro_f1']:.3f}",
         OUT / f"confusion-{lang}.png")
g = json.loads((ML / "runs/gestures/report.json").read_text())
rows = list(g["test_confusion"])
cols = list(next(iter(g["test_confusion"].values())))
plot([[g["test_confusion"][t][p] for p in cols] for t in rows], cols, "Gesture rules, HaGRID held-out users",
     OUT / "confusion-gestures.png", ylabels=rows)
e = json.loads((ML / "runs/emotion/report.json").read_text())
plot(e["confusion"], e["confusion_labels"], f"Emotion rules, KDEF 20 held-out people, macro-F1 {e['test_macro_f1']:.3f}",
     OUT / "confusion-emotion-rules.png")
m = json.loads((ML / "runs/emotion/model_report.json").read_text())
plot(m["confusion"], m["confusion_labels"], f"Emotion logreg (52 blendshapes), macro-F1 {m['test_macro_f1']:.3f}",
     OUT / "confusion-emotion-model.png")
