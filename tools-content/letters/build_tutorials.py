"""Writes content/tutorials/fingerspelling/<lang>.json (asl isl lsf dgs lsm lis) and
content/credits/letters.json from what the other scripts produced.

Needs: medoids.json (asl_build.py, isl_build.py), .cache/commons_<lang>.json
(commons_fetch.py), the files in web/public/signs/. Stdlib only.
Run: python3 -I tools-content/letters/build_tutorials.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import CACHE, CONTENT, PROVENANCE, SIGNS  # noqa: E402
import wmc  # noqa: E402  (stdlib only)

AZ = [chr(65 + i) for i in range(26)]
DIGITS = [str(d) for d in range(10)]
MAX_TIP = 90

ASL_TIPS = {
    "A": "Fist with the thumb resting against the side of the index finger.",
    "B": "Flat hand, fingers together pointing up, thumb folded across the palm.",
    "C": "Fingers and thumb curved into the shape of a C.",
    "D": "Index finger up; the other fingertips touch the thumb in a circle.",
    "E": "Fingertips bent down to rest on the thumb, which is tucked across the palm.",
    "F": "Thumb and index fingertips touch in a circle; other three fingers up and apart.",
    "G": "Index finger and thumb point sideways, parallel; other fingers folded.",
    "H": "Index and middle fingers together, pointing sideways; other fingers folded.",
    "I": "Little finger up; other fingers folded with the thumb across them.",
    "J": "Make the I hand, then draw a J in the air with the little finger.",
    "K": "Index and middle fingers up in a V, thumb touching the middle finger.",
    "L": "Index finger up and thumb out to the side, making an L.",
    "M": "Thumb tucked under the first three fingers.",
    "N": "Thumb tucked under the first two fingers.",
    "O": "All fingertips curve round to meet the thumb, making an O.",
    "P": "Like K, but the hand is turned so the fingers point down.",
    "Q": "Like G, but the thumb and index finger point down.",
    "R": "Index and middle fingers up and crossed.",
    "S": "Fist with the thumb across the front of the fingers.",
    "T": "Fist with the thumb tucked between the index and middle fingers.",
    "U": "Index and middle fingers up, held together.",
    "V": "Index and middle fingers up and apart.",
    "W": "Index, middle and ring fingers up and apart.",
    "X": "Index finger bent into a hook; other fingers folded.",
    "Y": "Thumb and little finger stretched out; other fingers folded.",
    "Z": "Index finger draws a Z in the air (it looks reversed to the viewer).",
}
ASL_NUM_TIPS = {
    "0": "All fingertips curve round to meet the thumb, making an O.",
    "1": "Index finger up; other fingers folded.",
    "2": "Index and middle fingers up and apart.",
    "3": "Thumb, index and middle fingers up.",
    "4": "Four fingers up and apart, thumb folded in.",
    "5": "Open hand, all five fingers spread.",
    "6": "Thumb touches the little finger; other three fingers up.",
    "7": "Thumb touches the ring finger; other fingers up.",
    "8": "Thumb touches the middle finger; other fingers up.",
    "9": "Thumb touches the index finger; other fingers up.",
}
# ISL: two-handed alphabet as in the ISLRTC chart; wording avoids naming left/right
# because signers differ in which hand does what.
ISL_TIPS = {
    "A": "Both fists with thumbs up, thumb tips touching like a peak.",
    "B": "Both hands make a ring with thumb and index; the rings touch, other fingers up.",
    "C": "One hand curves thumb and index finger into a C.",
    "D": "One index points up; the other thumb and index curve against it to make a D.",
    "E": "One hand makes a C with thumb and index; the other index points into it.",
    "F": "Index and middle fingers of one hand lie across those of the other hand.",
    "G": "Both hands in fists, one fist stacked on top of the other.",
    "H": "Flat hand brushes across the palm of the other, open hand.",
    "I": "Index finger points to and touches your own chin.",
    "J": "One hand makes an L, thumb up; the other index traces along it up to the thumb tip.",
    "K": "One index points up; the other hand's bent fingers touch its middle, like a K.",
    "L": "Index finger up and thumb out to the side, making an L.",
    "M": "Three fingers of one hand rest on the palm of the other, open hand.",
    "N": "Two fingers of one hand rest on the palm of the other, open hand.",
    "O": "Thumb and index fingertip touch to make a ring, like an O.",
    "P": "One index points up; the other thumb and index make a loop at its tip, like a P.",
    "Q": "One thumb and index make a ring; the other index points into it like a tail.",
    "R": "Bent index finger of one hand rests on the palm of the other hand.",
    "S": "Both hands in fists, little fingers hooked together.",
    "T": "One index points up to touch the other, sideways index, making a T.",
    "U": "Thumb and index finger point up, curved apart like a U.",
    "V": "Index and middle fingers up and apart in a V.",
    "W": "Fingers of both hands interlocked, crossing like a W.",
    "X": "Both index fingers crossed to make an X.",
    "Y": "One thumb and index spread in a V; the other index touches the fork and moves down.",
    "Z": "One flat hand stands upright; the other flat hand's fingertips touch it sideways.",
}
ISL_NUM_TIPS = {
    "0": "All fingertips curve round to meet the thumb, making an O.",
    "1": "Index finger up; other fingers folded under the thumb.",
    "2": "Index and middle fingers up in a V.",
    "3": "Index, middle and ring fingers up; thumb holds the little finger.",
    "4": "Four fingers up, thumb folded across the palm.",
    "5": "Open hand, all five fingers spread.",
    "6": "Little finger up; thumb across the other folded fingers.",
    "7": "Index finger up and bent over at the top; other fingers in a fist.",
    "8": "Thumb, index and middle fingers out; ring and little fingers folded.",
    "9": "Fist turned sideways with the thumb pointing down.",
}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def svg_item(key: str, value: str, lang: str, kind: str, credit: str, tip: str | None,
             motion: bool = False, **extra) -> dict:
    src = f"/signs/{lang}/{kind}/{value}.svg"
    assert (SIGNS / lang / kind / f"{value}.svg").exists(), src
    item = {key: value, "media": {"type": "svg", "src": src}, "motion": motion}
    if tip:
        assert len(tip) <= MAX_TIP, (lang, value, len(tip), tip)
        item["tip"] = tip
    item["credit"] = credit
    item.update(extra)
    return item


def null_item(key: str, value: str, motion: bool = False, credit: str | None = None) -> dict:
    item = {key: value, "media": None, "motion": motion}
    if credit:
        item["credit"] = credit
    return item


def asl() -> dict:
    letters = [svg_item("letter", c, "asl", "letters", "asl-hg", ASL_TIPS[c], c in "JZ") for c in AZ]
    numbers = [svg_item("value", d, "asl", "numbers", "asl-hg", ASL_NUM_TIPS[d]) for d in DIGITS]
    return {"lang": "asl", "code": "ASL", "handed": "one", "source": "asl-hg", "chart": None,
            "view": "As the viewer sees a right-handed signer. Diagrams are drawn from the "
                    "MediaPipe hand landmarks of a real signer's photo (the class medoid).",
            "letters": letters, "numbers": numbers}


def isl() -> dict:
    prov = load(PROVENANCE)["isl"]
    cls, motion = prov["classes"], set(prov["motion"])
    credit = {"dwibon": "isl-dwibon", "isl-kaggle": "isl-kaggle", "asl-hg": "asl-hg"}
    letters = [svg_item("letter", c, "isl", "letters", credit[cls[c]["source"]], ISL_TIPS[c], c in motion)
               for c in AZ]
    numbers = []
    for d in DIGITS:
        extra = {}
        if cls[d]["source"] == "asl-hg":
            extra["note"] = "Same O handshape as ASL 0 (ISLRTC numbers chart); drawn from ASL-HG."
        numbers.append(svg_item("value", d, "isl", "numbers", credit[cls[d]["source"]], ISL_NUM_TIPS[d], **extra))
    return {"lang": "isl", "code": "ISL", "handed": "two", "source": "isl-dwibon", "chart": None,
            "view": "As the viewer sees a right-handed signer: right hand on the viewer's left.",
            "note": "Dwibon data stores each hand relative to its own wrist, so in two-handed "
                    "letters from that set (all but H, J, Y) the hands are placed side by side "
                    "with a fixed gap: their relative position is schematic, the tip says how "
                    "they touch. H, J and Y come from photos and keep the real placement.",
            "letters": letters, "numbers": numbers}


def commons_files(lang: str) -> dict:
    """letter -> credit record for every WebP that exists. Uses commons_fetch.py's summary when
    the set is complete, else its metadata cache, so a half-finished download still yields
    a usable file (missing letters get media: null)."""
    done = load(CACHE / f"commons_{lang}.json")
    if done and "files" in done:
        return done["files"]
    meta = load(CACHE / f"commons_meta_{lang}.json")
    if not meta:
        return {}
    out = {}
    for k, t in meta["titles"].items():
        if (SIGNS / lang / "letters" / f"{k}.webp").exists():
            out[k] = {"file": t[5:], "src": f"/signs/{lang}/letters/{k}.webp", **wmc.credit(meta["infos"][t])}
    return out


def commons_letters(lang: str, keys: list[str], motion: set[str]) -> list[dict]:
    files = commons_files(lang)
    out = []
    for k in keys:
        if k in files and (SIGNS / lang / "letters" / f"{k}.webp").exists():
            out.append({"letter": k, "media": {"type": "image", "src": files[k]["src"]},
                        "motion": k in motion, "credit": f"commons-{lang}"})
        else:
            out.append(null_item("letter", k, k in motion))
    return out


def lsf() -> dict:
    return {"lang": "lsf", "code": "FSL", "handed": "one", "source": "commons-lsf", "chart": None,
            "letters": commons_letters("lsf", AZ, {"J", "P", "Z"}),  # the photos draw these paths
            "numbers": [null_item("value", d) for d in DIGITS],
            "note": "Photos by Clairette (Wikimedia Commons). No licence-clean number images "
                    "were found, so numbers have no media (the app animates them)."}


def dgs() -> dict:
    return {"lang": "dgs", "code": "DGS", "handed": "one", "source": "commons-dgs", "chart": None,
            "letters": commons_letters("dgs", AZ + ["Ä", "Ö", "Ü", "SCH"], {"J", "Z", "Ä", "Ö", "Ü"}),  # drawn arrows
            "numbers": [null_item("value", d) for d in DIGITS],
            "note": "Includes Ä, Ö, Ü and SCH. No licence-clean number images were found, so "
                    "numbers have no media (the app animates them)."}


def lsm() -> dict:
    keys = AZ[:14] + ["Ñ"] + AZ[14:]
    files = commons_files("lsm")
    return {"lang": "lsm", "code": "LSM", "handed": "one", "source": "commons-lsm" if files else None,
            "chart": None,
            "letters": commons_letters("lsm", keys, {"J", "Z", "Ñ"}),
            "numbers": [null_item("value", d) for d in DIGITS],
            "note": "No licence-clean LSM alphabet exists on Wikimedia Commons or elsewhere we could "
                    "verify. The only free source, the CC BY-SA photo 'Deletreo de LSM.png', spells "
                    "L-S-M, so L, S and M have photos and the other letters and all numbers have no "
                    "media (the app animates them)."}


def lis() -> dict:
    return {"lang": "lis", "code": "LIS", "handed": "one", "source": None, "chart": None,
            "letters": [null_item("letter", k, k in {"G", "J", "S", "Z"}) for k in AZ],
            "numbers": [null_item("value", d) for d in DIGITS],
            "note": "No licence-clean LIS alphabet images were found: Wikimedia Commons has none, "
                    "and the one public photo set (Kaggle LIS-dataset) is under the RAIL licence, "
                    "which is not an open licence. Letters and numbers have no media (the app "
                    "animates them). G, J, S and Z are moving letters."}


def commons_items(lsf_f: dict, dgs_f: dict, lsm_f: dict, adapted: str) -> list[dict]:
    """Credit entries for the Commons sets that are (at least partly) downloaded."""

    def files(fs: dict) -> list[dict]:
        return [{"letter": k, "file": v["file"], "page": v["page"], "author": v["author"],
                 "license": v["license"], "licenseUrl": v["licenseUrl"]} for k, v in fs.items()]

    def authors(fs: dict) -> str:
        return "; ".join(dict.fromkeys(v["author"] for v in fs.values()))

    def licences(fs: dict) -> str:
        return "; ".join(dict.fromkeys(v["license"] for v in fs.values()))

    out = []
    if lsf_f:
        out.append({"id": "commons-lsf", "name": "French manual alphabet (LSF) photos, Wikimedia Commons",
                    "author": authors(lsf_f), "license": licences(lsf_f),
                    "licenseUrl": next(iter(lsf_f.values()))["licenseUrl"],
                    "url": "https://commons.wikimedia.org/wiki/Category:French_manual_alphabet",
                    "usedFor": "LSF (FSL) letters A-Z", "changes": adapted, "files": files(lsf_f)})
    if dgs_f:
        out.append({"id": "commons-dgs", "name": "German manual alphabet (DGS) drawings, Wikimedia Commons",
                    "author": authors(dgs_f), "license": licences(dgs_f),
                    "licenseUrl": next(iter(dgs_f.values()))["licenseUrl"],
                    "url": "https://commons.wikimedia.org/wiki/Category:German_manual_alphabet",
                    "usedFor": "DGS letters A-Z, Ä, Ö, Ü, SCH", "changes": adapted, "files": files(dgs_f)})
    if lsm_f:
        first = next(iter(lsm_f.values()))
        out.append({"id": "commons-lsm",
                    "name": f"{first['file']} (Mexican Sign Language: the letters L, S, M), Wikimedia Commons",
                    "author": authors(lsm_f), "license": licences(lsm_f), "licenseUrl": first["licenseUrl"],
                    "url": first["page"], "usedFor": "LSM letters L, S and M",
                    "changes": "the three photos cut apart, each resized to 240 px tall and converted to WebP",
                    "files": files(lsm_f)})
    return out


def credits() -> dict:
    lsf_f = commons_files("lsf")
    dgs_f = commons_files("dgs")
    lsm_f = commons_files("lsm")
    adapted = "resized to 240 px tall and converted to WebP"
    return {"items": [
        {"id": "asl-hg", "name": "ASL-HG: American Sign Language Hand Gesture Image Dataset "
                                 "(participant-separated split, juanjodurillo/asl-hg)",
         "author": "Md. Famidul Islam Pranto, Md. Rifatul Islam, Md. Ali Akbor, Nabonita Ghosh, "
                   "Md. Rahatun Alam, Sudipto Chaki, Md Masudul Islam",
         "license": "CC-BY-4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
         "url": "https://huggingface.co/datasets/juanjodurillo/asl-hg",
         "usedFor": "ASL letter and number diagrams (and the ISL 0 diagram): line drawings of the "
                    "MediaPipe hand landmarks of one real photo per class (the class medoid)",
         "changes": "photos reduced to 21 hand landmarks and redrawn as line art"},
        {"id": "isl-dwibon", "name": "ISL dataset: MediaPipe hand landmarks (Kaggle dwibonbhargabdeka)",
         "author": "Dwibon Bhargab Deka (Kaggle)", "license": "CC-BY-SA-4.0",
         "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
         "url": "https://www.kaggle.com/datasets/dwibonbhargabdeka/isl-dataset-mediapipe-hand-landmarks",
         "usedFor": "ISL letter diagrams (all letters except H, J, Y); the diagrams are shared "
                    "under CC BY-SA 4.0",
         "changes": "landmark rows redrawn as line art; hands mirrored to the viewer's view"},
        {"id": "isl-kaggle", "name": "Indian Sign Language (ISL) image dataset (Kaggle prathumarikeri)",
         "author": "prathumarikeri (Kaggle)", "license": "CC-BY-SA-4.0",
         "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
         "url": "https://www.kaggle.com/datasets/prathumarikeri/indian-sign-language-isl",
         "usedFor": "ISL diagrams for H, J, Y and the numbers 1-9; the diagrams are shared under "
                    "CC BY-SA 4.0",
         "changes": "photos reduced to MediaPipe hand landmarks and redrawn as line art; "
                    "numbers mirrored to a right hand"},
        *commons_items(lsf_f, dgs_f, lsm_f, adapted),
        {"id": "mediapipe-hand", "name": "MediaPipe Hand Landmarker", "author": "Google",
         "license": "Apache-2.0", "url": "https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker",
         "usedFor": "extracting hand landmarks from the ASL-HG and ISL photos for the diagrams"},
        {"id": "liblouis", "name": "liblouis 3.39 with the UEB tables (en-ueb-g1.ctb, en-ueb-g2.ctb)",
         "author": "liblouis contributors", "license": "LGPL-2.1-or-later", "url": "https://liblouis.io",
         "usedFor": "generating every braille cell in the braille grade 1 and grade 2 tutorials"},
        {"id": "noto-fonts", "name": "Noto Sans / Noto Naskh Arabic / Noto Nastaliq Urdu (via @fontsource)",
         "author": "Google and the Noto project authors", "license": "OFL-1.1",
         "url": "https://fonts.google.com/noto",
         "usedFor": "rendering the 12 Indian scripts on ISL letter cards (content/scripts/indic-22.json)"},
    ]}


def main() -> None:
    out_dir = CONTENT / "tutorials/fingerspelling"
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, fn in (("asl", asl), ("isl", isl), ("lsf", lsf), ("dgs", dgs), ("lsm", lsm), ("lis", lis)):
        data = fn()
        (out_dir / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        with_media = sum(1 for x in data["letters"] if x["media"]), sum(1 for x in data["numbers"] if x["media"])
        print(f"{name}: letters {with_media[0]}/{len(data['letters'])} with media, "
              f"numbers {with_media[1]}/{len(data['numbers'])}, chart {data['chart']}")
    cred = CONTENT / "credits/letters.json"
    cred.parent.mkdir(parents=True, exist_ok=True)
    cred.write_text(json.dumps(credits(), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {cred}")


if __name__ == "__main__":
    main()
