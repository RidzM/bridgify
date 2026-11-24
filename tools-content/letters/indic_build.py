"""Writes content/scripts/indic-22.json: for each Latin letter A-Z, the nearest sound in
the script of each of the 22 scheduled languages of India (shown on ISL letter cards).

Method
  * Devanagari is the base map (below). The Brahmic scripts with the parallel ISCII
    layout (Bengali-Assamese, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada,
    Malayalam) are derived by code-point offset, every derived code point is checked
    to be assigned and to be the same letter (by Unicode name), and gaps / better
    local spellings are explicit overrides with a reason.
  * Perso-Arabic (Kashmiri, Sindhi, Urdu), Ol Chiki and Meitei Mayek are hand maps.
  * Everything is NFC; check with tools-content/letters/indic_check.py.

Run: python3 -I tools-content/letters/indic_build.py   (stdlib only)
"""

from __future__ import annotations

import json
import unicodedata as ud
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "content/scripts/indic-22.json"
LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

DEVANAGARI = {
    "A": "अ", "B": "ब", "C": "क", "D": "ड", "E": "ए", "F": "फ", "G": "ग", "H": "ह", "I": "इ",
    "J": "ज", "K": "क", "L": "ल", "M": "म", "N": "न", "O": "ओ", "P": "प", "Q": "क", "R": "र",
    "S": "स", "T": "ट", "U": "उ", "V": "व", "W": "व", "X": "क्स", "Y": "य", "Z": "ज़",
}

OFFSET = {"Bengali": 0x80, "Gurmukhi": 0x100, "Gujarati": 0x180, "Oriya": 0x200, "Tamil": 0x280,
          "Telugu": 0x300, "Kannada": 0x380, "Malayalam": 0x400}

# Unicode names differ for a few parallel letters (e.g. DEVANAGARI LETTER E = GURMUKHI LETTER EE)
SAME_LETTER = {("E", "EE"), ("O", "OO")}


def derive(block: str, overrides: dict[str, str]) -> dict[str, str]:
    out = {}
    for k, dev in DEVANAGARI.items():
        if k in overrides:
            out[k] = overrides[k]
            continue
        s = ""
        for ch in ud.normalize("NFD", dev):
            c = chr(ord(ch) + OFFSET[block])
            try:
                n_dev, n_new = ud.name(ch), ud.name(c)
            except ValueError:
                raise SystemExit(f"{block} {k}: U+{ord(c):04X} is unassigned; add an override")
            a = n_dev.split(" ", 1)[1].replace("LETTER ", "").replace("SIGN ", "")
            b = n_new.split(" ", 1)[1].replace("LETTER ", "").replace("SIGN ", "")
            if a != b and (a, b) not in SAME_LETTER:
                raise SystemExit(f"{block} {k}: {n_dev} -> {n_new}; add an override")
            s += c
        out[k] = ud.normalize("NFC", s)
    return out


def nfc(d: dict[str, str]) -> dict[str, str]:
    return {k: ud.normalize("NFC", v) for k, v in d.items()}


# -- Devanagari languages: one map, three documented local spellings of Z
DEV_Z = {
    "Marathi": ("झ", "Marathi writes English z with झ (e.g. झेब्रा)."),
    "Nepali": ("ज", "Nepali spelling does not use the nukta; z is written ज."),
    "Sanskrit": ("ज", "Sanskrit has no z sound or nukta letters; nearest is ज."),
    "Bodo": ("ज", "In Bodo the letter ज is itself pronounced /z/."),
}

BENGALI = derive("Bengali", {
    "V": "ভ",  # no separate va letter; loanwords use ভ (ভিডিও video)
    "W": "ও",  # w sound is written with ও (ওয়েব web)
    "Y": "য়",  # য is pronounced j; the y sound is য় (ya with nukta)
    "Z": "জ",  # z in loanwords is জ (জেব্রা zebra)
})
ASSAMESE = derive("Bengali", {
    "R": "ৰ",  # Assamese ra (U+09F0)
    "S": "চ",  # Assamese স is pronounced /x/; চ is the s sound (চাহ tea)
    "V": "ভ",
    "W": "ৱ",  # Assamese wa (U+09F1)
    "Y": "য়",  # য is /z/ in Assamese; the y sound is য়
    "Z": "জ",  # জ is /z/ in Assamese
})
GURMUKHI = derive("Gurmukhi", {
    "X": "ਕਸ",  # Gurmukhi does not join k+s with a virama
    "Z": "ਜ਼",  # ja with nukta (ਜ਼ਰੂਰ)
})
GUJARATI = derive("Gujarati", {
    "Z": "ઝ",  # Gujarati writes z with ઝ (ઝીરો zero)
})
ODIA = derive("Oriya", {
    "V": "ଭ",  # loanwords use ଭ (ଭିଡିଓ video)
    "W": "ୱ",  # Odia wa (U+0B71)
    "Y": "ୟ",  # ଯ is pronounced ja; the y sound is ୟ (U+0B5F)
    "Z": "ଜ",
})
TAMIL = derive("Tamil", {
    "B": "ப",  # no voiced stops in Tamil: b is written ப (பஸ் bus)
    "D": "ட",  # d is written ட (டாக்டர் doctor)
    "F": "ஃப",  # aytham + pa is the standard f (ஃபோன் phone)
    "G": "க",  # g is written க
    "Z": "ஜ",  # z is written ஜ (ஜீரோ zero)
})
TELUGU = derive("Telugu", {"Z": "జ"})  # జీరో zero
KANNADA = derive("Kannada", {"Z": "ಜ"})  # ಜೀರೋ zero
MALAYALAM = derive("Malayalam", {
    "R": "റ",  # English r is written റ (റേഡിയോ radio)
    "Z": "സ",  # English z is written സ (സീറോ zero)
})

URDU = nfc({
    "A": "اَ", "B": "ب", "C": "ک", "D": "ڈ", "E": "اے", "F": "ف", "G": "گ", "H": "ہ", "I": "اِ",
    "J": "ج", "K": "ک", "L": "ل", "M": "م", "N": "ن", "O": "او", "P": "پ", "Q": "ق", "R": "ر",
    "S": "س", "T": "ٹ", "U": "اُ", "V": "و", "W": "و", "X": "کس", "Y": "ی", "Z": "ز",
})
KASHMIRI = dict(URDU)  # Kashmiri Perso-Arabic uses the Urdu letters for all of these sounds
SINDHI = nfc({
    "A": "اَ", "B": "ب", "C": "ڪ", "D": "ڊ", "E": "اي", "F": "ف", "G": "گ", "H": "ه", "I": "اِ",
    "J": "ج", "K": "ڪ", "L": "ل", "M": "م", "N": "ن", "O": "او", "P": "پ", "Q": "ق", "R": "ر",
    "S": "س", "T": "ٽ", "U": "اُ", "V": "و", "W": "و", "X": "ڪس", "Y": "ي", "Z": "ز",
})
OL_CHIKI = {
    "A": "ᱟ", "B": "ᱵ", "C": "ᱠ", "D": "ᱰ", "E": "ᱮ", "F": "ᱯᱷ", "G": "ᱜ", "H": "ᱦ", "I": "ᱤ",
    "J": "ᱡ", "K": "ᱠ", "L": "ᱞ", "M": "ᱢ", "N": "ᱱ", "O": "ᱳ", "P": "ᱯ", "Q": "ᱠ", "R": "ᱨ",
    "S": "ᱥ", "T": "ᱴ", "U": "ᱩ", "V": "ᱣ", "W": "ᱣ", "X": "ᱠᱥ", "Y": "ᱭ", "Z": "ᱡ",
}
MEETEI = {
    "A": "ꯑ", "B": "ꯕ", "C": "ꯀ", "D": "ꯗ", "E": "ꯑꯦ", "F": "ꯐ", "G": "ꯒ", "H": "ꯍ", "I": "ꯏ",
    "J": "ꯖ", "K": "ꯀ", "L": "ꯂ", "M": "ꯃ", "N": "ꯅ", "O": "ꯑꯣ", "P": "ꯄ", "Q": "ꯀ", "R": "ꯔ",
    "S": "ꯁ", "T": "ꯇ", "U": "ꯎ", "V": "ꯋ", "W": "ꯋ", "X": "ꯛꯁ", "Y": "ꯌ", "Z": "ꯖ",
}

FONT = {
    "Devanagari": "@fontsource/noto-sans-devanagari",
    "Bengali-Assamese": "@fontsource/noto-sans-bengali",
    "Gurmukhi": "@fontsource/noto-sans-gurmukhi",
    "Gujarati": "@fontsource/noto-sans-gujarati",
    "Odia": "@fontsource/noto-sans-oriya",
    "Tamil": "@fontsource/noto-sans-tamil",
    "Telugu": "@fontsource/noto-sans-telugu",
    "Kannada": "@fontsource/noto-sans-kannada",
    "Malayalam": "@fontsource/noto-sans-malayalam",
    "Ol Chiki": "@fontsource/noto-sans-ol-chiki",
    "Meitei Mayek": "@fontsource/noto-sans-meetei-mayek",
}
NASTALIQ = "@fontsource/noto-nastaliq-urdu"
NASKH = "@fontsource/noto-naskh-arabic"


def dev(lang: str) -> dict[str, str]:
    m = dict(DEVANAGARI)
    if lang in DEV_Z:
        m["Z"] = DEV_Z[lang][0]
    return nfc(m)


# (lang, ISO 639 code, script, map, font, note)
LANGS = [
    ("Assamese", "as", "Bengali-Assamese", ASSAMESE, None,
     "Assamese ৰ (r) and ৱ (w); স is /x/ in Assamese, so s is চ."),
    ("Bengali", "bn", "Bengali-Assamese", BENGALI, None, None),
    ("Bodo", "brx", "Devanagari", dev("Bodo"), None, DEV_Z["Bodo"][1]),
    ("Dogri", "doi", "Devanagari", dev("Dogri"), None, None),
    ("Gujarati", "gu", "Gujarati", GUJARATI, None, None),
    ("Hindi", "hi", "Devanagari", dev("Hindi"), None, None),
    ("Kannada", "kn", "Kannada", KANNADA, None, None),
    ("Kashmiri", "ks", "Perso-Arabic", KASHMIRI, NASTALIQ, None),
    ("Konkani", "kok", "Devanagari", dev("Konkani"), None, None),
    ("Maithili", "mai", "Devanagari", dev("Maithili"), None, None),
    ("Malayalam", "ml", "Malayalam", MALAYALAM, None, None),
    ("Manipuri", "mni", "Meitei Mayek", MEETEI, None,
     "Vowels other than a, i, u are written on the carrier ꯑ; final k uses ꯛ (lonsum)."),
    ("Marathi", "mr", "Devanagari", dev("Marathi"), None, DEV_Z["Marathi"][1]),
    ("Nepali", "ne", "Devanagari", dev("Nepali"), None, DEV_Z["Nepali"][1]),
    ("Odia", "or", "Odia", ODIA, None, None),
    ("Punjabi", "pa", "Gurmukhi", GURMUKHI, None, None),
    ("Sanskrit", "sa", "Devanagari", dev("Sanskrit"), None, DEV_Z["Sanskrit"][1]),
    ("Santali", "sat", "Ol Chiki", OL_CHIKI, None, "No f or z in Santali: f is ph (ᱯᱷ), z is j (ᱡ)."),
    ("Sindhi", "sd", "Perso-Arabic", SINDHI, NASKH,
     "Sindhi k is ڪ (ک is kh), retroflex t ٽ and d ڊ, h ه, y ي; usually printed in Naskh."),
    ("Tamil", "ta", "Tamil", TAMIL, None,
     "Tamil has no separate voiced or aspirated letters: b→ப, d→ட, g→க; f is ஃப; Grantha ஜ ஸ ஹ."),
    ("Telugu", "te", "Telugu", TELUGU, None, None),
    ("Urdu", "ur", "Perso-Arabic", URDU, NASTALIQ, None),
]


def main() -> None:
    langs = []
    for name, code, script, m, font, note in LANGS:
        assert list(m) == list(LETTERS), name
        entry = {"lang": name, "code": code, "script": script,
                 "fontsource": font or FONT[script], "map": m}
        if script == "Perso-Arabic":
            entry["dir"] = "rtl"
        if note:
            entry["note"] = note
        langs.append(entry)
    data = {
        "letters": LETTERS,
        "about": "Nearest sound of each Latin letter in the script of each of the 22 languages "
                 "of the Eighth Schedule of the Constitution of India. A phonetic guide, not a "
                 "transliteration standard. C and Q are read as k, X as ks.",
        "languages": langs,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(langs)} languages)")


if __name__ == "__main__":
    main()
