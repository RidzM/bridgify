"""Checks every output of this folder. Stdlib only (Pillow optional, for WebP sizes).

  * SVG diagrams: parse as XML, <= 3 KB, <title> "<CODE> letter|number <X>", viewBox 0 0 200 200,
    no <text>, motion letters carry a marker arrow
  * WebP photos: <= 25 KB and 240 px tall (a chart.webp, if a language has one: no budget)
  * fingerspelling JSON: shape, every media src exists, every credit id is in credits/letters.json,
    tips <= 90 characters
  * braille JSON: every cell is a braille pattern and its dots match the code point
  * indic-22.json: delegates to indic_check.py

Run: python3 -I tools-content/letters/validate.py   (exit 1 on any problem)
"""

from __future__ import annotations

import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import CONTENT, HERE, ROOT, SIGNS  # noqa: E402

PUBLIC = ROOT / "web/public"
NS = "{http://www.w3.org/2000/svg}"
LANGS = {"asl": "ASL", "isl": "ISL", "lsf": "FSL", "dgs": "DGS", "lsm": "LSM", "lis": "LIS"}
errs: list[str] = []


def err(msg: str) -> None:
    errs.append(msg)


def check_svg(path: Path, title: str, motion: bool) -> None:
    data = path.read_bytes()
    if len(data) > 3072:
        err(f"{path.name}: {len(data)} B > 3 KB")
    try:
        root = ET.fromstring(data)
    except ET.ParseError as e:
        err(f"{path}: invalid XML {e}")
        return
    if root.get("viewBox") != "0 0 200 200":
        err(f"{path}: viewBox {root.get('viewBox')}")
    t = root.find(f"{NS}title")
    if t is None or t.text != title:
        err(f"{path}: title {t.text if t is not None else None!r} != {title!r}")
    if root.find(f".//{NS}text") is not None:
        err(f"{path}: has <text>")
    has_arrow = any(e.get("marker-end") for e in root.iter(f"{NS}path"))
    # every ASL motion letter and ISL J draw their path; ISL H and Y are marked as moving
    # but only described in the tip
    if motion and (path.parts[-3] == "asl" or path.stem == "J") and not has_arrow:
        err(f"{path}: motion letter without arrow")
    if has_arrow and not motion:
        err(f"{path}: arrow on a letter not marked as moving")


def check_webp(path: Path, chart: bool) -> None:
    size = path.stat().st_size
    if not chart and size > 25_000:
        err(f"{path}: {size} B > 25 KB")
    try:
        from PIL import Image
    except ImportError:
        return
    with Image.open(path) as im:
        if im.format != "WEBP":
            err(f"{path}: not WebP")
        if not chart and im.height != 240:
            err(f"{path}: height {im.height} != 240")


def check_fingerspelling(credit_ids: set[str]) -> dict:
    summary = {}
    for lang, code in LANGS.items():
        p = CONTENT / f"tutorials/fingerspelling/{lang}.json"
        d = json.loads(p.read_text(encoding="utf-8"))
        for k in ("lang", "code", "handed", "source", "chart", "letters", "numbers"):
            if k not in d:
                err(f"{lang}.json: missing {k}")
        if d["lang"] != lang or d["code"] != code:
            err(f"{lang}.json: lang/code {d['lang']}/{d['code']}")
        if d["source"] is not None and d["source"] not in credit_ids:
            err(f"{lang}.json: source {d['source']} not in credits")
        if d["chart"]:
            f = PUBLIC / d["chart"].lstrip("/")
            if not f.exists():
                err(f"{lang}.json: chart {d['chart']} missing")
            else:
                check_webp(f, chart=True)
        n_media = {"letters": 0, "numbers": 0}
        for kind, key in (("letters", "letter"), ("numbers", "value")):
            for it in d[kind]:
                if key not in it or "media" not in it or "motion" not in it:
                    err(f"{lang}.json {kind}: bad item {it}")
                    continue
                if it.get("tip") and len(it["tip"]) > 90:
                    err(f"{lang}.json {it[key]}: tip > 90 chars")
                if it.get("credit") and it["credit"] not in credit_ids:
                    err(f"{lang}.json {it[key]}: credit {it['credit']} not in credits")
                m = it["media"]
                if m is None:
                    continue
                n_media[kind] += 1
                f = PUBLIC / m["src"].lstrip("/")
                if not f.exists():
                    err(f"{lang}.json {it[key]}: {m['src']} missing")
                    continue
                if not it.get("credit"):
                    err(f"{lang}.json {it[key]}: media without credit")
                if m["type"] == "svg":
                    word = "letter" if kind == "letters" else "number"
                    check_svg(f, f"{code} {word} {it[key]}", it["motion"])
                elif m["type"] == "image":
                    check_webp(f, chart=False)
                else:
                    err(f"{lang}.json {it[key]}: media type {m['type']}")
        summary[lang] = (n_media["letters"], len(d["letters"]), n_media["numbers"], len(d["numbers"]))
    return summary


def check_braille() -> None:
    for name in ("braille-g1.json", "braille-g2.json"):
        d = json.loads((CONTENT / "tutorials" / name).read_text(encoding="utf-8"))
        items = []
        for k in ("letters", "numbers", "indicators", "punctuation", "entries"):
            items += d.get(k, [])
        for it in items:
            for b, dots in ((it["braille"], it["dots"]), *(((it["example"]["braille"], it["example"]["dots"]),)
                                                          if "dots" in it.get("example", {}) else ())):
                exp = ["".join(str(i + 1) for i in range(8) if (ord(c) - 0x2800) >> i & 1) for c in b]
                if any(not 0x2800 <= ord(c) <= 0x28FF for c in b) or exp != dots:
                    err(f"{name}: {it.get('word') or it.get('char')}: dots {dots} != {exp}")


def main() -> int:
    credits = json.loads((CONTENT / "credits/letters.json").read_text(encoding="utf-8"))
    ids = {c["id"] for c in credits["items"]}
    summary = check_fingerspelling(ids)
    check_braille()
    r = subprocess.run([sys.executable, "-I", str(HERE / "indic_check.py")], capture_output=True, text=True)
    if r.returncode:
        err("indic_check.py failed:\n" + r.stdout)
    svgs = sorted(SIGNS.glob("*/*/*.svg"))
    webps = sorted(SIGNS.glob("*/letters/*.webp"))
    print("media with letters / numbers:")
    for lang, (lm, lt, nm, nt) in summary.items():
        print(f"  {lang}: letters {lm}/{lt}, numbers {nm}/{nt}")
    if svgs:
        print(f"SVG: {len(svgs)} files, max {max(p.stat().st_size for p in svgs)} B")
    if webps:
        print(f"WebP: {len(webps)} files, max {max(p.stat().st_size for p in webps)} B")
    for e in errs:
        print("FAIL", e)
    print("OK" if not errs else f"{len(errs)} problem(s)")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
