"""Generate web/src/engines/braille/__fixtures__/golden.json from NATIVE liblouis.

Run inside the bridgify-api image (python3-louis, liblouis 3.39.0):

  docker run --rm -v ~/bridgify/tools-wasm:/tools \
    -v ~/bridgify/web/src/engines/braille/__fixtures__:/fixtures \
    bridgify-api /venv/bin/python -I /tools/gen-golden.py /fixtures/golden.json
"""
import json
import sys

import louis

TABLES = {
    "en-ueb-g1": "unicode.dis,en-ueb-g1.ctb",
    "en-ueb-g2": "unicode.dis,en-ueb-g2.ctb",
    "hi-in-g1": "unicode.dis,hi-in-g1.utb",
}

G1 = [
    "HELLO, HOW ARE YOU?",
    "Hello world",
    "The quick brown fox jumps over the lazy dog.",
    "Room 42 is on the 3rd floor.",
    "I need HELP now",
    "Call me at 9:30 tomorrow.",
    "Is it 25% off? Yes!",
    "Mumbai, Delhi and Chennai",
    "Price: 1,250 rupees",
    "She said \"wait\" and left.",
    "Don't stop; keep going.",
    "UNESCO and NASA are acronyms",
    "McDonald's opens at 7am",
    "3a and 5b",
    "The year 2026 ends soon.",
    "email: info@example.com",
    "Chapter 1 (Introduction)",
    "x-ray, e-mail, re-enter",
    "WAIT for the GREEN light, then cross.",
]

G2 = [
    "THE RED FORT",
    "the and for of with",
    "knowledge is power",
    "people like to read",
    "The children went to the market.",
    "Bridgify helps blind students learn.",
    "Thank you for your help.",
    "We will meet again tomorrow.",
    "Knowledge and wisdom go together.",
    "This is the house that Jack built.",
    "Every child should have the right to read.",
    "Out of sight, out of mind.",
    "Where there is a will, there is a way.",
    "Mother and father were there.",
    "She could not understand the question.",
    "Little by little, one travels far.",
    "Ought we to go through the forest?",
    "Today is Monday, 24 November.",
    "The ship sailed with the wind.",
]

HI = [
    "नमस्ते",
    "भारत",
    "हिन्दी",
    "मेरा नाम राम है",
    "आप कैसे हैं?",
    "पानी",
    "विद्यालय",
    "धन्यवाद",
    "किताब पढ़ो",
    "भारत एक महान देश है।",
]

BACK = {
    "en-ueb-g1": [
        "Hello world",
        "HELLO, HOW ARE YOU?",
        "Room 42",
        "yes! no?",
        "Is it 25% off?",
    ],
    "en-ueb-g2": [
        "THE RED FORT",
        "the and for of with",
        "knowledge is power",
        "people like to read",
        "Thank you for your help.",
        "The children went to the market.",
    ],
}


def main(out: str) -> None:
    cases = []

    def fwd(table: str, text: str) -> None:
        cases.append({
            "kind": "translate",
            "table": table,
            "input": text,
            "expected": louis.translateString([TABLES[table]], text, mode=0),
        })

    for s in G1:
        fwd("en-ueb-g1", s)
    for s in G2:
        fwd("en-ueb-g2", s)
    for s in HI:
        fwd("hi-in-g1", s)
    for table, texts in BACK.items():
        for s in texts:
            braille = louis.translateString([TABLES[table]], s, mode=0)
            cases.append({
                "kind": "back",
                "table": table,
                "input": braille,
                "expected": louis.backTranslateString([TABLES[table]], braille, mode=0),
            })

    doc = {
        "generator": "tools-wasm/gen-golden.py (native python3-louis)",
        "liblouis": louis.version(),
        "tables": TABLES,
        "cases": cases,
    }
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"wrote {len(cases)} cases to {out}")


if __name__ == "__main__":
    main(sys.argv[1])
