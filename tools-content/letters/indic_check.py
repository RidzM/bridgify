"""Checks content/scripts/indic-22.json.

Always (stdlib only):
  * 22 languages, each with all 26 letters A-Z, NFC-normalised, non-empty
  * every code point is assigned, sits in the Unicode block of the language's script and
    carries that script's Unicode name prefix; no value starts with a combining mark
Optional:
  --npm    every fontsource package exists on npm (`npm view <pkg> version`)
  --fonts  every glyph is in the font's character map (downloads each package with
           `npm pack` into .cache/npm/ and reads the 400-weight .woff files; needs fontTools,
           e.g. run with the ml venv: cd ml && uv run python -I ../tools-content/letters/indic_check.py --fonts)

Run: python3 -I tools-content/letters/indic_check.py [--npm] [--fonts] [-v]
Exit code 1 on any failure.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tarfile
import unicodedata as ud
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DATA = ROOT / "content/scripts/indic-22.json"

BLOCKS = {
    "Devanagari": [(0x0900, 0x097F)],
    "Bengali-Assamese": [(0x0980, 0x09FF)],
    "Gurmukhi": [(0x0A00, 0x0A7F)],
    "Gujarati": [(0x0A80, 0x0AFF)],
    "Odia": [(0x0B00, 0x0B7F)],
    "Tamil": [(0x0B80, 0x0BFF)],
    "Telugu": [(0x0C00, 0x0C7F)],
    "Kannada": [(0x0C80, 0x0CFF)],
    "Malayalam": [(0x0D00, 0x0D7F)],
    "Perso-Arabic": [(0x0600, 0x06FF)],
    "Ol Chiki": [(0x1C50, 0x1C7F)],
    "Meitei Mayek": [(0xABC0, 0xABFF), (0xAAE0, 0xAAFF)],
}
NAME = {
    "Devanagari": "DEVANAGARI ", "Bengali-Assamese": "BENGALI ", "Gurmukhi": "GURMUKHI ",
    "Gujarati": "GUJARATI ", "Odia": "ORIYA ", "Tamil": "TAMIL ", "Telugu": "TELUGU ",
    "Kannada": "KANNADA ", "Malayalam": "MALAYALAM ", "Perso-Arabic": "ARABIC ",
    "Ol Chiki": "OL CHIKI ", "Meitei Mayek": "MEETEI MAYEK ",
}
EXPECTED = {
    "Assamese": "Bengali-Assamese", "Bengali": "Bengali-Assamese", "Bodo": "Devanagari",
    "Dogri": "Devanagari", "Gujarati": "Gujarati", "Hindi": "Devanagari", "Kannada": "Kannada",
    "Kashmiri": "Perso-Arabic", "Konkani": "Devanagari", "Maithili": "Devanagari",
    "Malayalam": "Malayalam", "Manipuri": "Meitei Mayek", "Marathi": "Devanagari",
    "Nepali": "Devanagari", "Odia": "Odia", "Punjabi": "Gurmukhi", "Sanskrit": "Devanagari",
    "Santali": "Ol Chiki", "Sindhi": "Perso-Arabic", "Tamil": "Tamil", "Telugu": "Telugu",
    "Urdu": "Perso-Arabic",
}


def check(data: dict, verbose: bool) -> list[str]:
    errs = []
    letters = data["letters"]
    if letters != "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        errs.append("letters must be A-Z")
    langs = {l["lang"]: l for l in data["languages"]}
    if set(langs) != set(EXPECTED) or len(data["languages"]) != 22:
        errs.append(f"language set differs: {sorted(set(langs) ^ set(EXPECTED))}")
    for name, l in langs.items():
        script = l["script"]
        if EXPECTED.get(name) != script:
            errs.append(f"{name}: script {script!r}, expected {EXPECTED.get(name)!r}")
            continue
        m = l["map"]
        if list(m) != list(letters):
            errs.append(f"{name}: map keys must be exactly A-Z in order")
        for k, v in m.items():
            if not v:
                errs.append(f"{name} {k}: empty")
                continue
            if ud.normalize("NFC", v) != v:
                errs.append(f"{name} {k}: {v!r} is not NFC")
            if ud.category(v[0]).startswith("M"):
                errs.append(f"{name} {k}: starts with a combining mark")
            for ch in v:
                cp = ord(ch)
                try:
                    n = ud.name(ch)
                except ValueError:
                    errs.append(f"{name} {k}: U+{cp:04X} unassigned")
                    continue
                if not any(a <= cp <= b for a, b in BLOCKS[script]):
                    errs.append(f"{name} {k}: U+{cp:04X} {n} outside the {script} block")
                if not n.startswith(NAME[script]):
                    errs.append(f"{name} {k}: U+{cp:04X} {n} is not {NAME[script].strip()}")
                if verbose:
                    print(f"  {name:9} {k} U+{cp:04X} {n}")
    return errs


def check_npm(data: dict) -> list[str]:
    errs = []
    for pkg in sorted({l["fontsource"] for l in data["languages"]}):
        r = subprocess.run(["npm", "view", pkg, "version"], capture_output=True, text=True)
        v = r.stdout.strip()
        print(f"  {pkg} {v or 'MISSING'}")
        if r.returncode or not v:
            errs.append(f"{pkg} not on npm")
    return errs


def check_fonts(data: dict) -> list[str]:
    from fontTools.ttLib import TTFont  # noqa: PLC0415 (optional dependency)

    cache = HERE / ".cache/npm"
    cache.mkdir(parents=True, exist_ok=True)
    errs = []
    for pkg in sorted({l["fontsource"] for l in data["languages"]}):
        slug = pkg.split("/")[1]
        dest = cache / slug
        if not dest.exists():
            dest.mkdir()
            r = subprocess.run(["npm", "pack", pkg, "--silent"], cwd=dest, capture_output=True, text=True)
            if r.returncode:
                errs.append(f"{pkg}: npm pack failed")
                continue
            tgz = next(dest.glob("*.tgz"))
            with tarfile.open(tgz) as t:
                members = [m for m in t.getmembers() if m.name.endswith("-400-normal.woff") and m.isfile()]
                t.extractall(dest, members=members, filter="data")
            tgz.unlink()
        cmap = set()
        for f in dest.rglob("*-400-normal.woff"):
            cmap |= set(TTFont(f).getBestCmap())
        need = {ord(ch) for l in data["languages"] if l["fontsource"] == pkg for v in l["map"].values() for ch in v}
        missing = sorted(need - cmap)
        print(f"  {pkg}: {len(need)} code points, {len(missing)} missing")
        if missing:
            errs.append(f"{pkg} lacks " + " ".join(f"U+{c:04X}" for c in missing))
    return errs


def main() -> int:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    errs = check(data, "-v" in sys.argv)
    if "--npm" in sys.argv:
        errs += check_npm(data)
    if "--fonts" in sys.argv:
        errs += check_fonts(data)
    for e in errs:
        print("FAIL", e)
    print("indic-22.json:", "OK" if not errs else f"{len(errs)} problem(s)")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
