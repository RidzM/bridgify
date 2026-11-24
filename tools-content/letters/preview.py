"""Contact sheet for eyeballing the diagrams next to the photo each one was drawn from.

Usage (from ml/): uv run python -I ../tools-content/letters/preview.py asl|isl [classes]
Writes .cache/preview/<lang>.png (diagram rendered with rsvg-convert, black on white;
photo = the medoid source image when there is one, i.e. ASL-HG and Kaggle ISL; for
Dwibon letters, which have no photos, a Kaggle photo of the same letter as a reference).
"""

from __future__ import annotations

import io
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pyarrow.parquet as pq  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

from common import CACHE, ML, PROVENANCE, SIGNS  # noqa: E402

S = 220


def svg_png(path: Path) -> Image.Image:
    png = subprocess.run(["rsvg-convert", "-w", str(S), "-h", str(S), "-b", "white", str(path)],
                         capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(png)).convert("RGB")


def asl_photos(paths: set[str]) -> dict[str, Image.Image]:
    out = {}
    t = pq.read_table(ML / "data/raw/asl-hg/data/train-00000-of-00001.parquet", columns=["image"])
    for rec in t.column("image").to_pylist():
        if rec["path"] in paths:
            out[rec["path"]] = Image.open(io.BytesIO(rec["bytes"])).convert("RGB")
    return out


def main() -> None:
    lang = sys.argv[1]
    only = sys.argv[2] if len(sys.argv) > 2 else None
    prov = json.loads(PROVENANCE.read_text()).get(lang, {}).get("classes", {})
    items = [c for c in prov if not only or c in only]
    photos = {}
    if lang == "asl":
        photos = asl_photos({prov[c]["file"] for c in items})
    font = ImageFont.load_default(size=22)
    cols = 4
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 2 * S, rows * S), "white")
    d = ImageDraw.Draw(sheet)
    for k, c in enumerate(items):
        x, y = (k % cols) * 2 * S, (k // cols) * S
        info = prov[c]
        kind = "letters" if c.isalpha() else "numbers"
        sheet.paste(svg_png(SIGNS / lang / kind / f"{c}.svg"), (x + S, y))
        ph = None
        if lang == "asl":
            ph = photos.get(info["file"])
        elif info.get("file", "").startswith("Indian/"):
            ph = Image.open(CACHE / "isl-kaggle" / info["file"]).convert("RGB")
        elif lang == "isl" and (CACHE / f"isl-kaggle/Indian/{c}/600.jpg").exists():
            # Dwibon rows have no photo: show a Kaggle photo of the same letter for reference
            ph = Image.open(CACHE / f"isl-kaggle/Indian/{c}/600.jpg").convert("RGB")
        if ph is not None:
            ph.thumbnail((S, S))
            sheet.paste(ph, (x, y))
        d.text((x + 4, y + 2), c, fill="red", font=font)
        d.rectangle([x, y, x + 2 * S - 1, y + S - 1], outline="#ccc")
    out = CACHE / "preview" / f"{lang}{'-' + only if only else ''}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print(out)


if __name__ == "__main__":
    main()
