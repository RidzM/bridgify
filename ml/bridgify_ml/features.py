"""Hand-landmark feature spec v1 ("featureSpec": "v1").

This file is the single source of truth. `web/src/engines/vision/features.ts`
must port it 1:1 and is checked against `__fixtures__/features.json`
(max abs diff < 1e-5). All maths is float64 in Python; JS numbers are float64
too, so a faithful port matches to ~1e-12.

INPUT (per hand, exactly what MediaPipe HandLandmarker returns)
    lm[21][3]   normalised image coords (x, y in [0,1] of width / height, y down;
                z relative to the wrist, roughly in units of image width)
    handedness  MediaPipe label "Left" | "Right" (first category)
    aspect      image width / height of the frame that was fed to MediaPipe

PER-HAND NORMALISATION  hand_block(lm, mirror, aspect) -> float[91]
    1. Aspect fix: x *= aspect, z *= aspect          (x, z now in units of image height,
                                                      so a hand is not stretched on 16:9)
    2. Translate:  P[i] = P[i] - P[0]                (wrist at origin)
    3. Mirror:     if mirror: P[i].x = -P[i].x
    4. Down-weight z: P[i].z *= 0.5
    5. Scale:      s = |P[9]| (3-D Euclidean, after steps 1-4); s = max(s, 1e-6);
                   P[i] = P[i] / s
    Steps 3 and 4 are per-axis sign/scale and commute with step 2.

PER-HAND FEATURE BLOCK (91 values, index ranges are within the block)
    [0..62]   P flattened landmark-major: P[0].x, P[0].y, P[0].z, P[1].x, ... P[20].z
              (indices 0,1,2 are always 0: the wrist)
    [63..77]  15 joint angles, radians, finger-major then joint:
                fingers (chain of landmark ids, root = wrist 0):
                  thumb  0-1-2-3-4,  index 0-5-6-7-8,  middle 0-9-10-11-12,
                  ring   0-13-14-15-16, pinky 0-17-18-19-20
                for chain [c0,c1,c2,c3,c4], bones b1=P[c1]-P[c0], b2=P[c2]-P[c1],
                b3=P[c3]-P[c2], b4=P[c4]-P[c3];
                  angle_MCP = ang(b1,b2), angle_PIP = ang(b2,b3), angle_DIP = ang(b3,b4)
                ang(u,v) = atan2(|u x v|, u . v)   (in [0, pi]; 0 = straight)
                so 63..65 thumb (at 1,2,3), 66..68 index (at 5,6,7), 69..71 middle,
                72..74 ring, 75..77 pinky
    [78..87]  10 fingertip distances |P[a]-P[b]| (3-D, normalised units), pairs in order
                (4,8) (4,12) (4,16) (4,20) (8,12) (8,16) (8,20) (12,16) (12,20) (16,20)
    [88..90]  palm normal n = (P[5]-P[0]) x (P[17]-P[0]); n / max(|n|, 1e-9)

ASL (F = 91)
    One hand (web runs numHands = 1; if more come back, use the first / highest score).
    mirror = (handedness == "Left"). MediaPipe's label is image-geometric and flips
    with the image, so this maps every hand to one chirality whether or not the
    camera frame is mirrored.
    features = hand_block(lm, mirror, aspect)

ISL (F = 184 = 91 * 2 + 2)
    Slot order is by geometry, not by the handedness label:
      two hands -> slot 0 = hand whose wrist x (lm[0].x) is smaller (image-left),
                   slot 1 = the other; ties keep detector order.
      one hand  -> slot 0 if handedness == "Left" else slot 1 (MediaPipe labels the
                   image-left hand "Left" when hands are not crossed, so this agrees
                   with the two-hand rule).
    mirror: slot 0 is mirrored (x -> -x), slot 1 is not.
    features = [block(slot0) (91, zeros if missing),
                block(slot1) (91, zeros if missing),
                mask0, mask1]   (1.0 = present, 0.0 = missing)
    Consequence: a horizontally flipped frame gives exactly the same two blocks
    swapped (and the mask swapped). Training uses that swap as augmentation, so the
    model does not depend on whether the source data was captured mirrored.

STANDARDISATION (not in this file): x = (x - mean) / std with the training-set
mean/std exported in the model JSON (std < 1e-8 replaced by 1).
"""

from __future__ import annotations

import numpy as np

FEATURE_SPEC = "v1"
N_LM = 21
HAND_F = 91
ASL_F = HAND_F
ISL_F = HAND_F * 2 + 2

FINGER_CHAINS = (
    (0, 1, 2, 3, 4),
    (0, 5, 6, 7, 8),
    (0, 9, 10, 11, 12),
    (0, 13, 14, 15, 16),
    (0, 17, 18, 19, 20),
)
TIPS = (4, 8, 12, 16, 20)
TIP_PAIRS = tuple((TIPS[i], TIPS[j]) for i in range(5) for j in range(i + 1, 5))
Z_WEIGHT = 0.5
SCALE_EPS = 1e-6
NORMAL_EPS = 1e-9


def normalise_hand(lm: np.ndarray, mirror: np.ndarray | bool, aspect: np.ndarray | float = 1.0) -> np.ndarray:
    """Steps 1-5. lm: (..., 21, 3). mirror/aspect broadcast over the leading dims.

    Returns float64 (..., 21, 3) normalised landmarks P.
    """
    p = np.asarray(lm, dtype=np.float64).copy()
    lead = p.shape[:-2]
    aspect = np.broadcast_to(np.asarray(aspect, dtype=np.float64), lead)[..., None]
    mirror = np.broadcast_to(np.asarray(mirror, dtype=bool), lead)[..., None]
    p[..., 0] *= aspect
    p[..., 2] *= aspect
    p = p - p[..., :1, :]
    p[..., 0] = np.where(mirror, -p[..., 0], p[..., 0])
    p[..., 2] *= Z_WEIGHT
    s = np.linalg.norm(p[..., 9, :], axis=-1)
    s = np.maximum(s, SCALE_EPS)
    return p / s[..., None, None]


def _angle(u: np.ndarray, v: np.ndarray) -> np.ndarray:
    c = np.cross(u, v)
    return np.arctan2(np.linalg.norm(c, axis=-1), np.sum(u * v, axis=-1))


def block_from_normalised(p: np.ndarray) -> np.ndarray:
    """Engineered 91-value block from normalised landmarks P (..., 21, 3)."""
    lead = p.shape[:-2]
    out = np.empty(lead + (HAND_F,), dtype=np.float64)
    out[..., 0:63] = p.reshape(lead + (63,))
    k = 63
    for chain in FINGER_CHAINS:
        bones = [p[..., chain[i + 1], :] - p[..., chain[i], :] for i in range(4)]
        for j in range(3):
            out[..., k] = _angle(bones[j], bones[j + 1])
            k += 1
    for a, b in TIP_PAIRS:
        out[..., k] = np.linalg.norm(p[..., a, :] - p[..., b, :], axis=-1)
        k += 1
    n = np.cross(p[..., 5, :] - p[..., 0, :], p[..., 17, :] - p[..., 0, :])
    nn = np.maximum(np.linalg.norm(n, axis=-1), NORMAL_EPS)
    out[..., 88:91] = n / nn[..., None]
    return out


def hand_block(lm: np.ndarray, mirror, aspect=1.0) -> np.ndarray:
    return block_from_normalised(normalise_hand(lm, mirror, aspect))


# ---------------------------------------------------------------- ASL

def asl_features(lm: np.ndarray, handedness, aspect=1.0) -> np.ndarray:
    """lm (..., 21, 3); handedness str or array of str ("Left"/"Right")."""
    mirror = np.asarray(handedness) == "Left"
    return hand_block(lm, mirror, aspect)


# ---------------------------------------------------------------- ISL

def isl_slots(hands: list[dict]) -> list[dict | None]:
    """Order detected hands into [slot0, slot1] per the spec.

    hands: list of {"landmarks": (21,3), "handedness": "Left"|"Right"} (0, 1 or 2 items).
    """
    if len(hands) >= 2:
        a, b = hands[0], hands[1]
        if np.asarray(b["landmarks"])[0][0] < np.asarray(a["landmarks"])[0][0]:
            a, b = b, a
        return [a, b]
    if len(hands) == 1:
        h = hands[0]
        return [h, None] if h["handedness"] == "Left" else [None, h]
    return [None, None]


def isl_features_from_slots(lm0, lm1, present0, present1, aspect=1.0) -> np.ndarray:
    """Vectorised ISL features. lm0/lm1 (..., 21, 3); present* bool (...). Missing slot
    landmarks are ignored (block forced to zeros)."""
    lm0 = np.asarray(lm0, dtype=np.float64)
    lm1 = np.asarray(lm1, dtype=np.float64)
    present0 = np.asarray(present0, dtype=bool)
    present1 = np.asarray(present1, dtype=bool)
    b0 = hand_block(lm0, True, aspect)
    b1 = hand_block(lm1, False, aspect)
    b0 = np.where(present0[..., None], b0, 0.0)
    b1 = np.where(present1[..., None], b1, 0.0)
    m = np.stack([present0, present1], axis=-1).astype(np.float64)
    return np.concatenate([b0, b1, m], axis=-1)


def isl_features(hands: list[dict], aspect=1.0) -> np.ndarray:
    s0, s1 = isl_slots(hands)
    z = np.zeros((21, 3))
    return isl_features_from_slots(
        z if s0 is None else s0["landmarks"],
        z if s1 is None else s1["landmarks"],
        s0 is not None,
        s1 is not None,
        aspect,
    )


def isl_block_swap(x: np.ndarray) -> np.ndarray:
    """Feature vector of the horizontally flipped frame (see spec): swap blocks + mask."""
    return np.concatenate([x[..., 91:182], x[..., 0:91], x[..., 183:184], x[..., 182:183]], axis=-1)


FEATURE_NAMES_HAND = (
    [f"p{i}_{a}" for i in range(21) for a in "xyz"]
    + [f"ang_{f}_{j}" for f in ("thumb", "index", "middle", "ring", "pinky") for j in ("mcp", "pip", "dip")]
    + [f"dist_{a}_{b}" for a, b in TIP_PAIRS]
    + ["normal_x", "normal_y", "normal_z"]
)
assert len(FEATURE_NAMES_HAND) == HAND_F
