"""Bridgify API: braille (liblouis), TTS fallback, sign gloss/pose, Bridge rooms."""
from flask import Flask

from .config import Config
from .extensions import cors, limiter, socketio

__version__ = "0.1.0"


def create_app(config: type[Config] | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config or Config)

    cors.init_app(app, resources={r"/api/*": {"origins": app.config["ALLOWED_ORIGINS"]}})
    limiter.init_app(app)
    app.config["RATELIMIT_ENABLED"] = app.config["RATE_LIMIT_ENABLED"]

    from .api.health import bp as health_bp

    app.register_blueprint(health_bp, url_prefix="/api")

    socketio.init_app(
        app,
        cors_allowed_origins=app.config["ALLOWED_ORIGINS"],
        async_mode="threading",
        max_http_buffer_size=1_000_000,
    )

    @app.errorhandler(404)
    def not_found(_e):
        return {"error": {"code": "not_found", "message": "No such endpoint."}}, 404

    @app.errorhandler(429)
    def too_many(_e):
        return {"error": {"code": "rate_limited", "message": "Too many requests. Wait a minute and try again."}}, 429

    return app
