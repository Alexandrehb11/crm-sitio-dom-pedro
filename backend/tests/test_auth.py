"""
Testes de autenticação — login, me, criação e desativação de usuário.
"""

import bcrypt as _bcrypt
import pytest

from app.core.security import hash_password
from app.models.user import User, UserRole

# Hash pré-computado com custo baixo para testes
_HASHED_SENHA123 = _bcrypt.hashpw(b"senha123", _bcrypt.gensalt(rounds=4)).decode()


def test_login_success(client, admin_user):
    response = client.post(
        "/api/auth/login",
        data={"username": "admin_test", "password": "senha123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    assert body["user"]["username"] == "admin_test"
    assert body["user"]["role"] == "admin"


def test_login_wrong_password(client, admin_user):
    response = client.post(
        "/api/auth/login",
        data={"username": "admin_test", "password": "errada"},
    )
    assert response.status_code == 401


def test_login_unknown_user(client):
    response = client.post(
        "/api/auth/login",
        data={"username": "naoexiste", "password": "senha123"},
    )
    assert response.status_code == 401


def test_login_inactive_user(client, db):
    user = User(
        username="inativo",
        hashed_password=_HASHED_SENHA123,
        role=UserRole.vendedor,
        is_active=False,
    )
    db.add(user)
    db.commit()

    response = client.post(
        "/api/auth/login",
        data={"username": "inativo", "password": "senha123"},
    )
    assert response.status_code == 403


def test_me_authenticated(client, auth_headers):
    response = client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["username"] == "admin_test"


def test_me_unauthenticated(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_create_user_as_admin(client, auth_headers):
    response = client.post(
        "/api/auth/users",
        json={"username": "novo_vendedor", "password": "senha456", "role": "vendedor"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "novo_vendedor"
    assert body["role"] == "vendedor"
    assert body["is_active"] is True


def test_create_user_duplicate_username(client, auth_headers, admin_user):
    response = client.post(
        "/api/auth/users",
        json={"username": "admin_test", "password": "outrasenha"},
        headers=auth_headers,
    )
    assert response.status_code == 400


def test_create_user_requires_admin(client, db):
    vendedor = User(
        username="vendedor1",
        hashed_password=_HASHED_SENHA123,
        role=UserRole.vendedor,
        is_active=True,
    )
    db.add(vendedor)
    db.commit()

    from app.core.security import create_access_token
    token = create_access_token(vendedor.id, vendedor.username, vendedor.role)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/auth/users",
        json={"username": "outro", "password": "senha123"},
        headers=headers,
    )
    assert response.status_code == 403


def test_deactivate_user(client, db, auth_headers):
    target = User(
        username="alvo",
        hashed_password=hash_password("senha123"),
        role=UserRole.vendedor,
        is_active=True,
    )
    db.add(target)
    db.commit()
    db.refresh(target)

    response = client.patch(
        f"/api/auth/users/{target.id}/deactivate",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is False


def test_deactivate_self_forbidden(client, auth_headers, admin_user):
    response = client.patch(
        f"/api/auth/users/{admin_user.id}/deactivate",
        headers=auth_headers,
    )
    assert response.status_code == 400


def test_deactivate_nonexistent_user(client, auth_headers):
    response = client.patch(
        "/api/auth/users/00000000-0000-0000-0000-000000000000/deactivate",
        headers=auth_headers,
    )
    assert response.status_code == 404
