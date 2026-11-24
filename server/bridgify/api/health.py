from flask import Blueprint

from .. import __version__
from ..services import louis_svc

bp = Blueprint("health", __name__)


@bp.get("/health")
def health():
    return {
        "ok": True,
        "version": __version__,
        "louis": louis_svc.version(),
        "tables": louis_svc.check_tables(),
        "gloss": True,
    }
