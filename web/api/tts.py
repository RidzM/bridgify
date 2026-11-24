"""Server voice fallback for browsers with no speech voices (report §3.3.1: Flask + gTTS)."""
import io
import threading
import time
from collections import OrderedDict

from flask import Flask, jsonify, request, send_file
from gtts import gTTS
from gtts.lang import tts_langs

app = Flask(__name__)
MAX_CHARS = 600
LANGS = set(tts_langs().keys())

# Best-effort abuse limit: 20 requests per minute per client IP, per warm function instance.
# Serverless instances don't share memory, so this slows scripted callers down rather than
# guaranteeing a global cap. Browser voices remain the default; this is only the fallback.
RATE = 20
WINDOW = 60.0
_hits: "OrderedDict[str, list[float]]" = OrderedDict()
_lock = threading.Lock()


def _client_ip() -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return (fwd.split(",")[0].strip() or request.remote_addr or "unknown")[:64]


def _allowed(ip: str) -> bool:
    now = time.monotonic()
    with _lock:
        recent = [t for t in _hits.pop(ip, []) if now - t < WINDOW]
        ok = len(recent) < RATE
        if ok:
            recent.append(now)
        _hits[ip] = recent
        while len(_hits) > 5000:  # bound memory
            _hits.popitem(last=False)
        return ok


@app.post("/api/tts")
def tts():
    if not _allowed(_client_ip()):
        return jsonify(error={"code": "rate", "message": "Too many requests. Wait a minute and try again."}), 429
    body = request.get_json(silent=True) or {}
    text = str(body.get("text", "")).strip()
    lang = str(body.get("lang", "en")).split("-")[0]
    if not text:
        return jsonify(error={"code": "empty", "message": "Nothing to speak."}), 400
    if len(text) > MAX_CHARS:
        return jsonify(error={"code": "too_long", "message": f"Keep it under {MAX_CHARS} characters."}), 413
    if lang not in LANGS:
        lang = "en"
    buf = io.BytesIO()
    try:
        gTTS(text=text, lang=lang, tld="co.in" if lang == "en" else "com").write_to_fp(buf)
    except Exception:  # upstream refused or timed out
        return jsonify(error={"code": "upstream", "message": "The server voice is busy. Try again."}), 503
    buf.seek(0)
    resp = send_file(buf, mimetype="audio/mpeg")
    resp.headers["Cache-Control"] = "public, max-age=86400"
    return resp


@app.get("/api/health")
def health():
    return {"ok": True, "tts": True}
