"""Fingerspelling photos and charts from Wikimedia Commons, with per-file credits.

  LSF (shown as FSL): Category:French_manual_alphabet, "LSF LettreA.jpg" ... (26 files)
  DGS: Category:German_manual_alphabet, "Fingeralphabet A.jpg" ... + Ä Ö Ü Sch (30 files)
  LSM: no alphabet on Commons; "Deletreo de LSM.png" (CC BY-SA 4.0) spells L-S-M in three
       photos, which are cut apart into L, S and M
  LIS: nothing licence-clean found (Commons has no LIS alphabet; the Kaggle LIS
       fingerspelling set is under RAIL, not an open licence) -> no media
  Numbers: none of the four have number files on Commons -> no media.

Each file: metadata via the Commons API (imageinfo + extmetadata: author, licence short name
and URL, file page), original downloaded once to .cache/commons/<lang>/ (git-ignored),
then resized to 240 px tall (the frames are already tight) and saved as WebP <= 25 KB in
web/public/signs/<lang>/letters/. Only free licences are accepted (CC0, public domain,
CC BY, CC BY-SA); anything else stops the build.

Run: cd ml && uv run python -I ../tools-content/letters/commons_fetch.py   (needs Pillow)
Writes .cache/commons_<lang>.json (credits + file map, read by build_tutorials.py).
"""

from __future__ import annotations

import io
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

import wmc  # noqa: E402
from common import CACHE, SIGNS  # noqa: E402

HEIGHT = 240
MAX_BYTES = 25_000
CHART_WIDTH = 1000  # requested rendition width for multi-photo files (Commons rounds it up)

# The source frames are already tight around the hand and carry the letter caption in a
# corner, so they are only resized (cropping would cut the caption).
SETS = {
    "lsf": {"category": "Category:French_manual_alphabet",
            "pattern": re.compile(r"^File:LSF Lettre([A-Z])\.jpg$")},
    "dgs": {"category": "Category:German_manual_alphabet",
            "pattern": re.compile(r"^File:Fingeralphabet ([A-Z]|Ä|Ö|Ü|Sch)\.jpg$")},
}
# "Deletreo de LSM.png" is not an alphabet chart: it is three photos side by side spelling
# L-S-M. Each panel (split on the white separator lines) becomes that letter's image.
PANELS = {"lsm": ("File:Deletreo de LSM.png", ["L", "S", "M"])}


def letter_key(s: str) -> str:
    return "SCH" if s == "Sch" else s


def to_webp(raw: bytes, out: Path, height: int = HEIGHT, max_bytes: int = MAX_BYTES) -> int:
    im = Image.open(io.BytesIO(raw))
    im = im.convert("RGBA").convert("RGB") if im.mode in ("P", "LA", "RGBA") else im.convert("RGB")
    w = max(1, round(im.width * height / im.height))
    im = im.resize((w, height), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    for q in (86, 80, 74, 68, 60, 52, 44):
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=q, method=6)
        if buf.tell() <= max_bytes:
            break
    out.write_bytes(buf.getvalue())
    return buf.tell()


def cached_meta(lang: str, fetch) -> dict:
    """Commons metadata is fetched once and kept in .cache (delete the file to refresh)."""
    path = CACHE / f"commons_meta_{lang}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    data = fetch()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    return data


def fetch_set(lang: str, cfg: dict) -> None:
    def fetch():
        titles = {}
        for t in wmc.category_files(cfg["category"]):
            m = cfg["pattern"].match(t)
            if m:
                titles[letter_key(m.group(1))] = t
        return {"titles": titles, "infos": wmc.file_info(list(titles.values()))}

    meta = cached_meta(lang, fetch)
    titles, infos = meta["titles"], meta["infos"]
    raw_dir = CACHE / "commons" / lang
    raw_dir.mkdir(parents=True, exist_ok=True)
    files = {}
    for letter, t in sorted(titles.items()):
        info = infos[t]
        raw_path = raw_dir / Path(info["url"]).name
        if not raw_path.exists():
            raw_path.write_bytes(wmc.download(info["url"]))
        out = SIGNS / lang / "letters" / f"{letter}.webp"
        size = to_webp(raw_path.read_bytes(), out)
        files[letter] = {"file": t[5:], "src": f"/signs/{lang}/letters/{letter}.webp", "bytes": size,
                         **wmc.credit(info)}
        print(f"{lang} {letter}: {t} -> {out.name} {size} B ({files[letter]['author']}, {files[letter]['license']})")
    (CACHE / f"commons_{lang}.json").write_text(json.dumps({"files": files}, ensure_ascii=False, indent=1))


def split_panels(im: Image.Image, n: int) -> list[Image.Image]:
    """Cut a strip of n photos apart at the near-white separator columns."""
    a = np.asarray(im.convert("L")).astype(np.int16)
    white = (a[: max(10, a.shape[0] // 12)] > 225).mean(0) > 0.9  # separators are white at the top
    cols = np.flatnonzero(white)
    cuts, start = [], 0
    for c in cols:
        if c - start > im.width * 0.15:
            cuts.append((start, c))
        start = c + 1
    if im.width - start > im.width * 0.15:
        cuts.append((start, im.width))
    if len(cuts) != n:
        raise SystemExit(f"expected {n} panels, found {len(cuts)}")
    return [im.crop((x0, 0, x1, im.height)) for x0, x1 in cuts]


def fetch_panels(lang: str, title: str, letters: list[str]) -> None:
    info = cached_meta(lang, lambda: wmc.file_info([title], thumb_width=CHART_WIDTH))[title]
    raw_dir = CACHE / "commons" / lang
    raw_dir.mkdir(parents=True, exist_ok=True)
    src = info["thumb"] or info["url"]  # a 1280 px rendition: the 3 MB original is not needed
    raw_path = raw_dir / Path(src).name
    if not raw_path.exists() or raw_path.stat().st_size == 0:
        raw_path.write_bytes(wmc.download(src))
    files = {}
    for letter, panel in zip(letters, split_panels(Image.open(raw_path), len(letters))):
        buf = io.BytesIO()
        panel.convert("RGB").save(buf, "PNG")
        out = SIGNS / lang / "letters" / f"{letter}.webp"
        size = to_webp(buf.getvalue(), out)
        files[letter] = {"file": title[5:], "src": f"/signs/{lang}/letters/{letter}.webp", "bytes": size,
                         **wmc.credit(info)}
        print(f"{lang} {letter}: panel of {title} -> {out.name} {size} B ({files[letter]['author']}, {files[letter]['license']})")
    (CACHE / f"commons_{lang}.json").write_text(json.dumps({"files": files}, ensure_ascii=False, indent=1))


def main() -> None:
    only = set(sys.argv[1:])
    for lang, cfg in SETS.items():
        if not only or lang in only:
            fetch_set(lang, cfg)
    for lang, (title, letters) in PANELS.items():
        if not only or lang in only:
            fetch_panels(lang, title, letters)


if __name__ == "__main__":
    main()
