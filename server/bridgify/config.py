import os


def _list(name: str, default: str) -> list[str]:
    return [o.strip() for o in os.environ.get(name, default).split(",") if o.strip()]


class Config:
    ALLOWED_ORIGINS = _list("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:4173")
    RATE_LIMIT_ENABLED = os.environ.get("RATE_LIMIT_ENABLED", "1") == "1"
    POSE_UPSTREAM = os.environ.get(
        "POSE_UPSTREAM", "https://us-central1-sign-mt.cloudfunctions.net/spoken_text_to_signed_pose"
    )
    POSE_CACHE_DIR = os.environ.get("POSE_CACHE_DIR", "/tmp/bridgify/pose-cache")
    TTS_CACHE_DIR = os.environ.get("TTS_CACHE_DIR", "/tmp/bridgify/tts-cache")
    MAX_CONTENT_LENGTH = 64 * 1024


class TestConfig(Config):
    TESTING = True
    RATE_LIMIT_ENABLED = False
