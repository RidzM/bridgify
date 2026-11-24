"""liblouis wrapper. Uses the Debian python3-louis binding (never `pip install louis`)."""
from __future__ import annotations

try:
    import louis  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - only in environments without liblouis
    louis = None

TABLES = {
    "en-ueb-g1": ["unicode.dis", "en-ueb-g1.ctb"],
    "en-ueb-g2": ["unicode.dis", "en-ueb-g2.ctb"],
    "hi-in-g1": ["unicode.dis", "hi-in-g1.utb"],
}


def available() -> bool:
    return louis is not None


def version() -> str | None:
    return louis.version() if louis else None


def check_tables() -> list[str]:
    """Return the table ids that compile on this machine."""
    if not louis:
        return []
    ok = []
    for tid, tables in TABLES.items():
        try:
            louis.checkTable(tables)
            ok.append(tid)
        except RuntimeError:
            pass
    return ok
