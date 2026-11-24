"""Line-art hand diagrams (SVG) from MediaPipe hand landmarks.

Style (fixed colours; the app shows these as images):
  * 200 x 200 viewBox, drawing fitted with padding, no text inside
  * a solid hand: white palm and finger capsules with a dark outline (sign-dictionary style),
    painted far to near by MediaPipe z so nearer fingers cover the ones behind them
  * the outline is thick enough to read at 44 px
  * optional motion arrow (dashed path + marker arrowhead)

Coordinates in: per hand an array (21, 3) of x right, y down, z depth, all in the same
units (image-height units after the aspect fix). Mirroring for the viewer's view is the
caller's job: these functions draw exactly what they are given.
"""

from __future__ import annotations

import numpy as np

CONNECTIONS = (
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (0, 17), (17, 18), (18, 19), (19, 20),
)
TIPS = (4, 8, 12, 16, 20)
PALM = (0, 1, 5, 9, 13, 17)
VIEW = 200.0
PAD = 13.0
# band -> (bone width, group opacity); joint dot = width + 2, fingertip dot = width + 4.4
BANDS = {0: (3.1, 0.42), 1: (4.0, 0.72), 2: (5.0, 1.0)}
NEAR, FAR = -0.16, 0.16  # depth thresholds in hand-size units (|wrist -> middle MCP|)


def fmt(v: float) -> str:
    s = f"{v:.1f}"
    s = s.rstrip("0").rstrip(".") if "." in s else s
    return "0" if s in ("-0", "") else s


def hand_size(p: np.ndarray) -> float:
    return float(np.linalg.norm(p[9, :2] - p[0, :2])) or 1e-6


def bands(p: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Depth band (0 far, 1 mid, 2 near) per joint and per connection."""
    s = float(np.linalg.norm(p[9] - p[0])) or 1e-6
    z = (p[:, 2] - np.median(p[:, 2])) / s
    def band(v):
        return 2 if v < NEAR else (0 if v > FAR else 1)
    jb = np.array([band(v) for v in z])
    cb = np.array([band((z[a] + z[b]) / 2) for a, b in CONNECTIONS])
    return jb, cb


class Fit:
    """Uniform scale + translate of drawing coords into the viewBox."""

    def __init__(self, pts: np.ndarray, margin: float = 0.0):
        lo, hi = pts.min(0), pts.max(0)
        span = max(hi[0] - lo[0], hi[1] - lo[1], 1e-6)
        self.k = (VIEW - 2 * PAD - 2 * margin) / span
        c = (lo + hi) / 2
        self.off = np.array([VIEW / 2, VIEW / 2]) - c * self.k

    def __call__(self, xy) -> np.ndarray:
        return np.asarray(xy, dtype=float) * self.k + self.off


def _xy(q) -> str:
    return f"{fmt(q[0])} {fmt(q[1])}"


INK = "#2a2235"   # outline
SKIN = "#ffffff"  # hand fill (classic sign-dictionary style: white hand, dark outline)
OUTLINE = 3.4     # outline width in viewBox units (stays visible at 44 px)
# Finger chains drawn as capsules (thumb from its base joint, fingers from the knuckle).
FINGERS = ((1, 2, 3, 4), (5, 6, 7, 8), (9, 10, 11, 12), (13, 14, 15, 16), (17, 18, 19, 20))
WIDTH = (0.27, 0.23, 0.235, 0.22, 0.19)  # finger widths in hand-size units (wrist -> middle knuckle)


def hand_svg(p: np.ndarray, fit: Fit) -> str:
    """One hand as a solid illustration: white palm and fingers with a dark outline.

    Parts are painted far to near using MediaPipe z (smaller = nearer), each part as an
    outline pass then a fill pass, so a nearer finger cleanly covers what is behind it.
    """
    q = fit(p[:, :2])
    s_view = hand_size(p) * fit.k
    z = p[:, 2]
    parts = []  # (depth, svg)
    # Palm: rounded polygon wrist - thumb base - knuckles, widened by a thick round-joined stroke.
    palm_pts = [0, 1, 5, 9, 13, 17]
    d = "M" + "L".join(_xy(q[i]) for i in palm_pts) + "z"
    edge = 0.16 * s_view
    palm = (f'<path d="{d}" fill="{INK}" stroke="{INK}" stroke-width="{fmt(edge + 2 * OUTLINE)}"/>'
            f'<path d="{d}" fill="{SKIN}" stroke="{SKIN}" stroke-width="{fmt(edge)}"/>')
    parts.append((float(np.mean(z[palm_pts])), palm))
    for chain, wf in zip(FINGERS, WIDTH):
        w = wf * s_view
        d = "M" + "L".join(_xy(q[i]) for i in chain)
        svg = (f'<path d="{d}" stroke="{INK}" stroke-width="{fmt(w + 2 * OUTLINE)}"/>'
               f'<path d="{d}" stroke="{SKIN}" stroke-width="{fmt(w)}"/>')
        # A finger curled behind the palm sits further away than the palm, so it is painted first.
        parts.append((float(np.mean(z[list(chain[1:])])), svg))
    parts.sort(key=lambda t: -t[0])
    return "".join(svg for _, svg in parts)


ARROW_DEFS = ('<defs><marker id="a" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3.6" '
              'markerHeight="3.6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#2a2235" '
              'stroke="none"/></marker></defs>')


def arrow_svg(points: np.ndarray, fit: Fit, curve: bool) -> str:
    """Dashed motion path through `points` (drawing coords) with an arrowhead at the end.

    curve=True: points are cubic Bezier control points P0 C1 C2 P1 [C1 C2 P2 ...]."""
    q = fit(points)
    if curve:
        d = f"M{_xy(q[0])}C" + " ".join(_xy(v) for v in q[1:])
    else:
        d = f"M{_xy(q[0])}" + "".join(f"L{_xy(v)}" for v in q[1:])
    return (f'<path d="{d}" stroke="{INK}" stroke-width="3.4" stroke-dasharray="7 5" stroke-linecap="butt" '
            f'marker-end="url(#a)"/>')


def svg_doc(title: str, body: str, arrow: bool = False) -> str:
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none" '
            'stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">'
            f"<title>{title}</title>" + (ARROW_DEFS if arrow else "") + body + "</svg>\n")


def render(title: str, hands: list[np.ndarray], arrow: tuple[np.ndarray, bool] | None = None) -> str:
    """hands: list of (21, 3) arrays already placed in one drawing frame (x right, y down)."""
    pts = [h[:, :2] for h in hands]
    if arrow is not None:
        pts.append(arrow[0])
    fit = Fit(np.concatenate(pts), margin=16.0)  # room for finger width and outline
    # MediaPipe z is relative to each hand's own wrist, so hands cannot be depth-sorted
    # against each other: they are drawn in the order given.
    body = "".join(hand_svg(h, fit) for h in hands)
    if arrow is not None:
        body += arrow_svg(arrow[0], fit, arrow[1])
    return svg_doc(title, body, arrow is not None)
