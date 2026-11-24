"""Fetch the Kaggle ISL image dataset and keep only the class folders the diagrams need.

Dataset: prathumarikeri/indian-sign-language-isl (CC-BY-SA-4.0), Indian/<class>/<0..1199>.jpg.
Per-file downloads were tried first, but the Kaggle API rate-limits them (HTTP 429 after
~60 files), so the archive (~294 MB) is downloaded once and only these members are kept:
  * H, J, Y and 1-9 (not in the Dwibon landmark set): every image, for landmark
    extraction + medoid diagrams;
  * every other letter: 3 images, only for checking the handshape descriptions by eye.
The archive is deleted afterwards (pass --keep-zip to keep it).

Runs with the Kaggle CLI's own Python (the CLI is a uv tool):
  ~/.local/share/uv/tools/kaggle/bin/python -I tools-content/letters/isl_fetch.py
Output: tools-content/letters/.cache/isl-kaggle/Indian/<class>/<n>.jpg (git-ignored)
"""

from __future__ import annotations

import re
import sys
import zipfile
from pathlib import Path

from kaggle.api.kaggle_api_extended import KaggleApi

DATASET = "prathumarikeri/indian-sign-language-isl"
CACHE = Path(__file__).resolve().parent / ".cache"
ZIPDIR = CACHE / "isl-kaggle-zip"
OUT = CACHE / "isl-kaggle"
NEEDED = set("HJY") | {str(d) for d in range(1, 10)}
PEEK = {0, 600, 1100}
MEMBER = re.compile(r"^Indian/([0-9A-Z])/(\d+)\.jpg$")


def main() -> None:
    ZIPDIR.mkdir(parents=True, exist_ok=True)
    zips = list(ZIPDIR.glob("*.zip"))
    if not zips:
        api = KaggleApi()
        api.authenticate()
        api.dataset_download_files(DATASET, path=str(ZIPDIR), quiet=True, unzip=False)
        zips = list(ZIPDIR.glob("*.zip"))
    kept = 0
    with zipfile.ZipFile(zips[0]) as z:
        for info in z.infolist():
            m = MEMBER.match(info.filename)
            if not m:
                continue
            cls, n = m.group(1), int(m.group(2))
            if cls in NEEDED or n in PEEK:
                dest = OUT / "Indian" / cls / f"{n}.jpg"
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(z.read(info))
                kept += 1
    print(f"kept {kept} images in {OUT}")
    if "--keep-zip" not in sys.argv:
        for f in zips:
            f.unlink()


if __name__ == "__main__":
    main()
