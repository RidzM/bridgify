import pytest

from bridgify import create_app
from bridgify.config import TestConfig


@pytest.fixture()
def app():
    return create_app(TestConfig)


@pytest.fixture()
def client(app):
    return app.test_client()
