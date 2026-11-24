"""Sanity checks on the Dwibon ISL CSV for EVAL.md.

1. Rows are wrist-relative: lm0 == 0 for every present hand.
2. Re-computing features after adding an arbitrary wrist position (i.e. turning the row
   back into absolute image coords) gives identical features -> our pipeline is valid
   on wrist-relative input.
3. Chirality after our slot mirroring: mean palm-normal z of slot0 (mirrored) vs slot1.
"""
import sys
import numpy as np
sys.path.insert(0, sys.argv[1])
from bridgify_ml import features as F
from bridgify_ml.data import load_isl, DWIBON_ASPECT

tr, te = load_isl()
for name, d in (("train", tr), ("held_out", te)):
    w0 = np.abs(d["lm0"][d["p0"]][:, 0]).max(); w1 = np.abs(d["lm1"][d["p1"]][:, 0]).max()
    print(name, "rows", len(d["y"]), "both", int((d["p0"] & d["p1"]).sum()), "slot1 only", int((~d["p0"] & d["p1"]).sum()),
          "slot0 only", int((d["p0"] & ~d["p1"]).sum()), "max|wrist|", w0, w1)
rng = np.random.default_rng(0)
idx = rng.choice(len(tr["y"]), 5, replace=False)
for i in idx:
    a = F.isl_features_from_slots(tr["lm0"][i], tr["lm1"][i], tr["p0"][i], tr["p1"][i], DWIBON_ASPECT)
    off0, off1 = rng.random(3) * [0.5, 0.5, 0], rng.random(3) * [0.5, 0.5, 0] + [0.4, 0, 0]
    b = F.isl_features_from_slots(tr["lm0"][i] + off0, tr["lm1"][i] + off1, tr["p0"][i], tr["p1"][i], DWIBON_ASPECT)
    print("row", i, tr["y"][i], "max |diff| after re-adding a wrist position:", float(np.abs(a - b).max()))
X = F.isl_features_from_slots(tr["lm0"], tr["lm1"], tr["p0"], tr["p1"], DWIBON_ASPECT)
both = tr["p0"] & tr["p1"]
print("palm normal z mean: slot0(mirrored)", X[both, 90].mean().round(3), "slot1", X[both, 91 + 90].mean().round(3))
