"""Shared paths and helpers for the letter-content scripts.

Stdlib at import time (numpy is imported inside the landmark helpers), so the stdlib-only
scripts (build_tutorials.py, validate.py) can use the paths with a plain python3."""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CACHE = HERE / ".cache"
ML = ROOT / "ml"
SIGNS = ROOT / "web/public/signs"
CONTENT = ROOT / "content"
PROVENANCE = HERE / "medoids.json"


def medoid(x):
    """Index of the row closest (Euclidean) to the mean row, and that distance."""
    import numpy as np

    x = np.asarray(x).reshape(len(x), -1)
    d = np.linalg.norm(x - x.mean(0), axis=1)
    i = int(np.argmin(d))
    return i, float(d[i])


def aspect_fix(lm, aspect: float):
    """MediaPipe normalised coords -> x, y, z all in image-height units."""
    import numpy as np

    p = np.asarray(lm, dtype=np.float64).reshape(21, 3).copy()
    p[:, 0] *= aspect
    p[:, 2] *= aspect
    return p


def mirror(p):
    q = p.copy()
    q[:, 0] = -q[:, 0]
    return q


def update_provenance(section: str, data: dict) -> None:
    prov = json.loads(PROVENANCE.read_text()) if PROVENANCE.exists() else {}
    prov[section] = data
    PROVENANCE.write_text(json.dumps(prov, indent=1, sort_keys=True) + "\n")
