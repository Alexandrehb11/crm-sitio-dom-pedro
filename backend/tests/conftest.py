"""
Fixtures de teste — usa SQLite em memória para não precisar de PostgreSQL.
"""

import bcrypt as _bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, hash_password
from app.database import Base, get_db
from app.main import app
from app.models.user import User, UserRole

# Celery em modo eager — tarefas executam inline, sem precisar de Redis
from app.worker import celery_app as _celery_app
_celery_app.conf.task_always_eager = True
_celery_app.conf.task_eager_propagates = False  # não propaga exceções da task

# Hash pré-computado com custo baixo (rounds=4) para acelerar os testes.
# Todos os testes usam a senha "senha123" para o admin — computar uma vez é suficiente.
_HASHED_SENHA123 = _bcrypt.hashpw(b"senha123", _bcrypt.gensalt(rounds=4)).decode()

_TEST_DB_URL = "sqlite:///:memory:"

# StaticPool garante que create_all e as queries usem a mesma conexão in-memory
engine = create_engine(
    _TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db):
    user = User(
        username="admin_test",
        hashed_password=_HASHED_SENHA123,
        role=UserRole.admin,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user):
    return create_access_token(admin_user.id, admin_user.username, admin_user.role)


@pytest.fixture
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}
