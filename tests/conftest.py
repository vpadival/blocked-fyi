import os
import tempfile
from pathlib import Path

# Isolation before importing the application; never use the developer's evidence DB.
test_dir = tempfile.TemporaryDirectory(prefix="blocked-fyi-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{(Path(test_dir.name) / 'tests.sqlite3').as_posix()}"
os.environ["EMBEDDED_WORKER"] = "false"
os.environ["PROBE_MODE"] = "mock"
os.environ["MOCK_SCENARIO"] = "regional"

import pytest
from fastapi.testclient import TestClient

from backend.database import engine
from backend.main import app
from backend.models import Base


@pytest.fixture(scope="session", autouse=True)
def close_test_database():
    yield
    engine.dispose()
    test_dir.cleanup()


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def lead():
    return {
        "target_url": "https://example.com/resource",
        "platform": "WebDomain",
        "reported_issue": "HTTP451",
        "reported_region": "India / Bengaluru",
        "reported_isp": "Example ISP",
    }
