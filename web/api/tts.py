"""Server voice fallback for browsers with no speech voices (report §3.3.1: Flask + gTTS)."""
import io

from flask import Flask, jsonify, request, send_file
from gtts import gTTS
from gtts.lang import tts_langs

app = Flask(__name__)
MAX_CHARS = 600
LANGS = set(tts_langs().keys())


@app.post("/api/tts")
def tts():
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
