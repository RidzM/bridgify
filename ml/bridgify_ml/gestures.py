"""Rule-based static gesture classifier (2-D landmarks only). Port 1:1 to gestures.ts.

INPUT  lm[21] with x, y in normalised image coords (y DOWN). z is ignored, so the
       same rules run on HaGRID (2-D only) and on MediaPipe output. Before the rules
       x is multiplied by `aspect` (W/H of the frame; HaGRID: 1.0 because the image
       size is not in the annotations).
PARAMS from content/gesture-thresholds.json:
       finger_ratio, thumb_ratio, thumb_away, thumb_ip_max_deg, dir_margin, dir_vertical,
       palm_needs_thumb (bool)

d(a,b)  = 2-D Euclidean distance between landmarks a and b
S       = d(0, 9)                                   (palm length, the hand scale)
angle(a,b,c) = angle at b between vectors b->a and b->c, degrees (180 = straight)

1. Four fingers (index, middle, ring, pinky) with (pip, tip) = (6,8) (10,12) (14,16) (18,20):
       extended[f] = d(tip, 0) > finger_ratio * d(pip, 0)
2. Thumb (2 = MCP, 3 = IP, 4 = tip):
       thumb_ext = d(4, 2) > thumb_ratio * d(3, 2)          (tip runs past the IP)
               and angle(2, 3, 4) >= 180 - thumb_ip_max_deg  (thumb roughly straight)
               and d(4, 17) > thumb_away * d(2, 17)          (tip farther from the pinky MCP
                                                              than the thumb MCP is, i.e. the
                                                              thumb is not folded across the palm)
3. Count E4 = number of extended among the four fingers. Decide in this order:
       E4 == 4 and (thumb_ext or not palm_needs_thumb) -> open_palm
       E4 == 0 and thumb_ext:
           dy = y[4] - y[2], dx = x[4] - x[2]
           if |dy| >= dir_vertical * |dx| and |dy| >= dir_margin * S:
               dy < 0 -> thumbs_up   (tip above MCP; y grows downward)
               dy > 0 -> thumbs_down
           else -> none (thumb sideways)
       E4 == 0 and not thumb_ext                     -> fist
       only index extended and not thumb_ext         -> pointing
       only index + middle extended, not thumb_ext   -> peace
       only index + pinky extended and thumb_ext     -> ily
       anything else                                 -> none
The function returns {"name": label, "extended": [thumb, index, middle, ring, pinky]}.
"""

from __future__ import annotations

import numpy as np

LABELS = ["thumbs_up", "thumbs_down", "open_palm", "pointing", "peace", "fist", "ily", "none"]
DEFAULT_PARAMS = dict(finger_ratio=1.1, thumb_ratio=1.5, thumb_away=1.0, thumb_ip_max_deg=40.0,
                      dir_margin=0.3, dir_vertical=1.0, palm_needs_thumb=True)
FINGERS = ((6, 8), (10, 12), (14, 16), (18, 20))


def _d(p, a, b):
    return np.linalg.norm(p[..., a, :] - p[..., b, :], axis=-1)


def _angle_deg(p, a, b, c):
    u = p[..., a, :] - p[..., b, :]
    v = p[..., c, :] - p[..., b, :]
    cross = u[..., 0] * v[..., 1] - u[..., 1] * v[..., 0]
    dot = (u * v).sum(-1)
    return np.degrees(np.arctan2(np.abs(cross), dot))


def extended(lm, params=DEFAULT_PARAMS, aspect=1.0):
    """lm (..., 21, >=2). Returns bool (..., 5) [thumb, index, middle, ring, pinky]."""
    p = np.asarray(lm, dtype=np.float64)[..., :2].copy()
    p[..., 0] *= aspect
    S = _d(p, 0, 9)
    fing = [_d(p, tip, 0) > params["finger_ratio"] * _d(p, pip, 0) for pip, tip in FINGERS]
    thumb = ((_d(p, 4, 2) > params["thumb_ratio"] * _d(p, 3, 2))
             & (_angle_deg(p, 2, 3, 4) >= 180.0 - params["thumb_ip_max_deg"])
             & (_d(p, 4, 17) > params["thumb_away"] * _d(p, 2, 17)))
    return np.stack([thumb] + fing, axis=-1), p, S


def classify(lm, params=DEFAULT_PARAMS, aspect=1.0):
    """Vectorised. Returns array of label strings (...,)."""
    e, p, S = extended(lm, params, aspect)
    t, i, m, r, k = (e[..., j] for j in range(5))
    E4 = i.astype(int) + m + r + k
    dy = p[..., 4, 1] - p[..., 2, 1]
    dx = p[..., 4, 0] - p[..., 2, 0]
    vertical = (np.abs(dy) >= params["dir_vertical"] * np.abs(dx)) & (np.abs(dy) >= params["dir_margin"] * S)
    out = np.full(E4.shape, "none", dtype=object)
    # assign in reverse priority so earlier rules win
    out[np.where(i & ~m & ~r & k & t)] = "ily"
    out[np.where(i & m & ~r & ~k & ~t)] = "peace"
    out[np.where(i & ~m & ~r & ~k & ~t)] = "pointing"
    out[np.where((E4 == 0) & ~t)] = "fist"
    out[np.where((E4 == 0) & t & vertical & (dy > 0))] = "thumbs_down"
    out[np.where((E4 == 0) & t & vertical & (dy < 0))] = "thumbs_up"
    out[np.where((E4 == 4) & (t | (not params["palm_needs_thumb"])))] = "open_palm"
    return out


def classify_one(lm, params=DEFAULT_PARAMS, aspect=1.0) -> dict:
    lm = np.asarray(lm, dtype=np.float64)
    e, _, _ = extended(lm[None], params, aspect)
    return {"name": str(classify(lm[None], params, aspect)[0]), "extended": [bool(v) for v in e[0]]}
