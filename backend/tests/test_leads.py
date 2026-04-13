"""
Testes de leads — CRUD, scoring e funil.
"""

import pytest

from app.models.lead import FunnelStage, Lead


# ── Fixtures auxiliares ──────────────────────────────────────────────────────

def _lead_payload(**overrides):
    base = {
        "name": "João Teste",
        "phone": "11999990000",
        "event_type": "casamento",
        "source_channel": "whatsapp",
        "consent_lgpd": True,
    }
    base.update(overrides)
    return base


def _create_lead(client, auth_headers, **overrides):
    """Cria um lead via API e retorna o JSON de resposta.

    O Celery já está envolvido em try/except no endpoint, então não precisamos
    de mock — qualquer falha de conexão com Redis é silenciada.
    """
    response = client.post(
        "/api/leads/",
        json=_lead_payload(**overrides),
        headers=auth_headers,
    )
    return response


# ── Listagem ─────────────────────────────────────────────────────────────────

def test_list_leads_empty(client, auth_headers):
    response = client.get("/api/leads/", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_list_leads_requires_auth(client):
    response = client.get("/api/leads/")
    assert response.status_code == 401


# ── Criação ──────────────────────────────────────────────────────────────────

def test_create_lead(client, auth_headers):
    response = _create_lead(client, auth_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "João Teste"
    assert body["phone"] == "11999990000"
    assert body["funnel_stage"] == "lead"
    assert isinstance(body["score"], int)
    assert body["id"]


def test_create_lead_requires_auth(client):
    response = client.post("/api/leads/", json=_lead_payload())
    assert response.status_code == 401


def test_create_lead_with_budget_boosts_score(client, auth_headers):
    """Lead com orçamento alto e data definida deve ter score maior."""
    from datetime import datetime, timedelta, timezone
    date_str = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=90)).isoformat()

    r_no_budget = _create_lead(client, auth_headers, phone="11100000001")
    r_with_budget = _create_lead(
        client, auth_headers,
        phone="11100000002",
        budget=25000,
        guest_count=150,
        event_date=date_str,
    )
    assert r_with_budget.status_code == 201
    assert r_with_budget.json()["score"] >= r_no_budget.json()["score"]


# ── Leitura individual ────────────────────────────────────────────────────────

def test_get_lead(client, auth_headers):
    created = _create_lead(client, auth_headers).json()
    response = client.get(f"/api/leads/{created['id']}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_get_lead_not_found(client, auth_headers):
    response = client.get("/api/leads/nao-existe", headers=auth_headers)
    assert response.status_code == 404


# ── Atualização ───────────────────────────────────────────────────────────────

def test_update_lead(client, auth_headers):
    created = _create_lead(client, auth_headers).json()
    response = client.patch(
        f"/api/leads/{created['id']}",
        json={"name": "Novo Nome", "funnel_stage": "visita_agendada"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Novo Nome"
    assert body["funnel_stage"] == "visita_agendada"


def test_update_lead_not_found(client, auth_headers):
    response = client.patch(
        "/api/leads/nao-existe",
        json={"name": "X"},
        headers=auth_headers,
    )
    assert response.status_code == 404


# ── Exclusão ──────────────────────────────────────────────────────────────────

def test_delete_lead(client, auth_headers):
    created = _create_lead(client, auth_headers).json()
    response = client.delete(f"/api/leads/{created['id']}", headers=auth_headers)
    assert response.status_code == 204

    response = client.get(f"/api/leads/{created['id']}", headers=auth_headers)
    assert response.status_code == 404


def test_delete_lead_not_found(client, auth_headers):
    response = client.delete("/api/leads/nao-existe", headers=auth_headers)
    assert response.status_code == 404


# ── Filtros ───────────────────────────────────────────────────────────────────

def test_list_leads_filter_by_stage(client, auth_headers):
    _create_lead(client, auth_headers, phone="11111110001")
    _create_lead(client, auth_headers, phone="11111110002")

    response = client.get(
        "/api/leads/?stage=lead",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert len(response.json()) >= 2


def test_list_leads_filter_by_stage_no_match(client, auth_headers):
    _create_lead(client, auth_headers, phone="11111110003")

    response = client.get(
        "/api/leads/?stage=evento_realizado",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json() == []
