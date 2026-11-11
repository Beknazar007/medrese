import os

# Tests must never reach a real database: without this, importing app.db.session builds an
# engine from ../.env, which may point at production. Set before any app module is imported.
os.environ["DATABASE_URL"] = "sqlite://"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.models import *  # noqa: F401,F403,E402 — ensures all models are registered on Base.metadata


@pytest.fixture()
def db() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session_local = sessionmaker(bind=engine)
    session = session_local()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client_as(db: Session):
    """HTTP-level client acting as a given user, so require_role and other dependencies run
    exactly as in production. The test DB session is shared with the endpoint; test data is
    committed first, as it would be in a real database, so an endpoint's rollback after a
    failed write can't wipe it."""
    from app.core.deps import get_current_user
    from app.db.session import get_db
    from app.main import app

    def _make(user):
        db.commit()
        app.dependency_overrides[get_db] = lambda: db
        app.dependency_overrides[get_current_user] = lambda: user
        return TestClient(app)

    try:
        yield _make
    finally:
        app.dependency_overrides.clear()
