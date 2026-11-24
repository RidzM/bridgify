"""The browser braille engine (liblouis wasm) is checked against golden.json in
web/src/engines/braille/louis.test.ts. This test proves the fixture itself is
what NATIVE liblouis produces, so the two engines agree.

Fixture lookup: $BRAILLE_GOLDEN, then /fixtures/golden.json (Docker mount), then
the repo path relative to this file. Skips if none is found.

  docker run --rm -v ~/bridgify/server/tests:/app/tests \
    -v ~/bridgify/web/src/engines/braille/__fixtures__:/fixtures \
    bridgify-api /venv/bin/python -m pytest -q tests/test_braille_golden.py
"""
import json
import os
from pathlib import Path

import pytest

louis = pytest.importorskip("louis")


def _fixture_path():
    candidates = [
        os.environ.get("BRAILLE_GOLDEN"),
        "/fixtures/golden.json",
        Path(__file__).resolve().parents[2] / "web/src/engines/braille/__fixtures__/golden.json",
    ]
    for c in candidates:
        if c and Path(c).is_file():
            return Path(c)
    return None


FIXTURE = _fixture_path()
if FIXTURE is None:
    pytest.skip("golden.json not found (mount it at /fixtures)", allow_module_level=True)

DOC = json.loads(FIXTURE.read_text(encoding="utf-8"))
CASES = DOC["cases"]


def test_fixture_shape():
    assert DOC["liblouis"] == louis.version()
    assert len(CASES) >= 40
    kinds = {(c["kind"], c["table"]) for c in CASES}
    for need in [("translate", "en-ueb-g1"), ("translate", "en-ueb-g2"), ("translate", "hi-in-g1"),
                 ("back", "en-ueb-g1"), ("back", "en-ueb-g2")]:
        assert need in kinds


@pytest.mark.parametrize("case", CASES, ids=[f'{c["kind"]}-{c["table"]}-{i}' for i, c in enumerate(CASES)])
def test_native_matches_golden(case):
    tables = [DOC["tables"][case["table"]]]
    if case["kind"] == "translate":
        got = louis.translateString(tables, case["input"], mode=0)
    else:
        got = louis.backTranslateString(tables, case["input"], mode=0)
    assert got == case["expected"]
