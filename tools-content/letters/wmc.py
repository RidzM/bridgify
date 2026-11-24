"""Tiny, polite Wikimedia Commons client (stdlib only): API queries and file downloads
with a fixed pause between requests and back-off on HTTP 429."""

from __future__ import annotations

import html
import json
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "bridgify-letters/1.0 (content build script)"
PAUSE = 4.0  # seconds between requests; faster gets HTTP 429 from upload.wikimedia.org
PATIENCE = 3600  # upload.wikimedia.org can answer 429 with Retry-After 120-600 s for a while
_last = 0.0


def _get(url: str) -> bytes:
    global _last
    start, attempt = time.time(), 0
    while True:
        wait = PAUSE - (time.time() - _last)
        if wait > 0:
            time.sleep(wait)
        _last = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or time.time() - start > PATIENCE:
                raise
            attempt += 1
            retry = min(int(e.headers.get("Retry-After") or 0), 900) or 15 * attempt
            print(f"  HTTP {e.code}, waiting {retry} s", flush=True)
            time.sleep(retry)


def api(**params) -> dict:
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    return json.loads(_get(API + "?" + urllib.parse.urlencode(params)))


def download(url: str) -> bytes:
    """File bytes from upload.wikimedia.org. Uses curl when present: in testing the CDN kept
    answering HTTP 429 to Python's client while curl, same User-Agent, got the file."""
    if not shutil.which("curl"):
        return _get(url)
    global _last
    wait = PAUSE - (time.time() - _last)
    if wait > 0:
        time.sleep(wait)
    _last = time.time()
    # --retry honours Retry-After on 429 (the CDN asks for 600 s once a burst of uncached
    # originals has been served), so a full set downloads in bursts; one hour budget per file
    r = subprocess.run(["curl", "-sS", "--fail", "--retry", "30", "--retry-max-time", str(PATIENCE),
                        "--max-time", "120", "-A", UA, url], capture_output=True, check=True)
    return r.stdout


def text(v) -> str:
    """extmetadata HTML value -> plain text."""
    s = re.sub(r"<[^>]+>", "", html.unescape(str(v or "")))
    return " ".join(s.split())


def category_files(cat: str) -> list[str]:
    out, cont = [], {}
    while True:
        d = api(action="query", list="categorymembers", cmtitle=cat, cmtype="file", cmlimit=500, **cont)
        out += [m["title"] for m in d["query"]["categorymembers"]]
        if "continue" not in d:
            return out
        cont = d["continue"]


def file_info(titles: list[str], thumb_width: int | None = None) -> dict[str, dict]:
    """title -> {url, thumb (when thumb_width), width, height, mime, meta (extmetadata),
    page, uploader (first upload)}"""
    out = {}
    for i in range(0, len(titles), 25):
        batch = titles[i:i + 25]
        extra = {"iiurlwidth": thumb_width} if thumb_width else {}
        d = api(action="query", titles="|".join(batch), prop="imageinfo",
                iiprop="url|size|mime|extmetadata", **extra)
        for p in d["query"]["pages"]:
            ii = p["imageinfo"][0]
            out[p["title"]] = {"url": ii["url"].split("?")[0], "thumb": (ii.get("thumburl") or "").split("?")[0] or None,
                               "width": ii["width"], "height": ii["height"],
                               "mime": ii["mime"], "meta": {k: v.get("value") for k, v in ii["extmetadata"].items()},
                               "page": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(p["title"].replace(" ", "_"))}
    for t in titles:  # original uploader (oldest file version), only needed when no Artist is recorded
        out[t]["uploader"] = None
        if not text(out[t]["meta"].get("Artist")):
            d = api(action="query", titles=t, prop="imageinfo", iiprop="user", iilimit=50)
            versions = d["query"]["pages"][0]["imageinfo"]
            out[t]["uploader"] = versions[-1]["user"].replace("~commonswiki", "")
    return out


FREE = re.compile(r"^(CC0|Public domain|CC BY(-SA)? \d\.\d( [a-z]{2})?)$", re.I)


def credit(info: dict) -> dict:
    """Author / licence / page for one file_info() entry; refuses anything not free."""
    m = info["meta"]
    lic = text(m.get("LicenseShortName"))
    if not FREE.match(lic):
        raise SystemExit(f"non-free or unknown licence {lic!r}: {info['page']}")
    return {"author": text(m.get("Artist")) or info["uploader"], "license": lic,
            "licenseUrl": text(m.get("LicenseUrl")) or None, "page": info["page"],
            "original": info["url"], "credit": text(m.get("Credit")) or None}
