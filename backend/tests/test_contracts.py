"""
Testes de contratos — CRUD e envio via ZapSign (mockado).
"""

import base64
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.models.contract import Contract, ContractStatus
from app.models.event import Event
from app.models.lead import Lead

# PDF mínimo válido em base64 para usar nos testes de envio
_TINY_PDF_B64 = base64.b64encode(b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
                                  b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
                                  b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>"
                                  b"endobj\nxref\n0 4\n0000000000 65535 f \n"
                                  b"0000000009 00000 n \n0000000058 00000 n \n"
                                  b"0000000115 00000 n \n"
                                  b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n").decode()


# ── Fixtures auxiliares ──────────────────────────────────────────────────────

def _make_lead_and_event(db):
    lead = Lead(
        name="Lead Contrato",
        phone="11966660000",
        email="lead@email.com",
        consent_lgpd=True,
    )
    db.add(lead)
    db.flush()

    event = Event(
        lead_id=lead.id,
        title="Evento Contrato",
        date_start=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=45),
        date_end=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=45, hours=6),
        space="Salão B",
    )
    db.add(event)
    db.commit()
    db.refresh(lead)
    db.refresh(event)
    return lead, event


def _contract_payload(event_id: str, **overrides):
    base = {
        "event_id": event_id,
        "template_type": "casamento_standard",
        "client_name": "Maria Oliveira",
        "client_phone": "11977770000",
    }
    base.update(overrides)
    return base


# ── Listagem ──────────────────────────────────────────────────────────────────

def test_list_contracts_empty(client, auth_headers):
    response = client.get("/api/contracts/", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_list_contracts_requires_auth(client):
    response = client.get("/api/contracts/")
    assert response.status_code == 401


# ── Criação ───────────────────────────────────────────────────────────────────

def test_create_contract(client, db, auth_headers):
    _, event = _make_lead_and_event(db)
    response = client.post(
        "/api/contracts/",
        json=_contract_payload(event.id),
        headers=auth_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["event_id"] == event.id
    assert body["template_type"] == "casamento_standard"
    assert body["status"] == "pendente"
    assert body["zapsign_id"] is None


# ── Leitura individual ────────────────────────────────────────────────────────

def test_get_contract(client, db, auth_headers):
    _, event = _make_lead_and_event(db)
    created = client.post(
        "/api/contracts/",
        json=_contract_payload(event.id),
        headers=auth_headers,
    ).json()

    response = client.get(f"/api/contracts/{created['id']}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_get_contract_not_found(client, auth_headers):
    response = client.get("/api/contracts/nao-existe", headers=auth_headers)
    assert response.status_code == 404


# ── Atualização ───────────────────────────────────────────────────────────────

def test_update_contract(client, db, auth_headers):
    _, event = _make_lead_and_event(db)
    created = client.post(
        "/api/contracts/",
        json=_contract_payload(event.id),
        headers=auth_headers,
    ).json()

    response = client.patch(
        f"/api/contracts/{created['id']}",
        json={"status": "assinado", "signed_by": "João Silva"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "assinado"
    assert body["signed_by"] == "João Silva"


# ── Exclusão ──────────────────────────────────────────────────────────────────

def test_delete_contract(client, db, auth_headers):
    _, event = _make_lead_and_event(db)
    created = client.post(
        "/api/contracts/",
        json=_contract_payload(event.id),
        headers=auth_headers,
    ).json()

    response = client.delete(f"/api/contracts/{created['id']}", headers=auth_headers)
    assert response.status_code == 204

    response = client.get(f"/api/contracts/{created['id']}", headers=auth_headers)
    assert response.status_code == 404


# ── Send (ZapSign) ─────────────────────────────────────────────────────────────

def test_send_contract_success(client, db, auth_headers):
    lead, event = _make_lead_and_event(db)
    created = client.post(
        "/api/contracts/",
        json=_contract_payload(event.id),
        headers=auth_headers,
    ).json()

    # Anexa PDF de teste diretamente no banco (bypass do endpoint de upload)
    contract = db.get(Contract, created["id"])
    contract.pdf_template_base64 = _TINY_PDF_B64
    db.commit()

    with patch(
        "app.services.zapsign.create_document",
        new=AsyncMock(return_value={"open_id": "zap_open_id_abc", "token": "tok_123"}),
    ):
        response = client.post(
            f"/api/contracts/{created['id']}/send",
            headers=auth_headers,
        )

    assert response.status_code == 200
    body = response.json()
    assert body["zapsign_id"] == "zap_open_id_abc"


def test_send_contract_already_sent(client, db, auth_headers):
    lead, event = _make_lead_and_event(db)
    created = client.post(
        "/api/contracts/",
        json=_contract_payload(event.id),
        headers=auth_headers,
    ).json()

    # Simula contrato já enviado (com PDF e zapsign_id)
    contract = db.get(Contract, created["id"])
    contract.pdf_template_base64 = _TINY_PDF_B64
    contract.zapsign_id = "zap_ja_existe"
    db.commit()

    response = client.post(
        f"/api/contracts/{created['id']}/send",
        headers=auth_headers,
    )
    assert response.status_code == 409


def test_send_contract_already_signed(client, db, auth_headers):
    lead, event = _make_lead_and_event(db)
    created = client.post(
        "/api/contracts/",
        json=_contract_payload(event.id),
        headers=auth_headers,
    ).json()

    # Marca como assinado diretamente (com PDF)
    contract = db.get(Contract, created["id"])
    contract.pdf_template_base64 = _TINY_PDF_B64
    contract.status = ContractStatus.assinado
    db.commit()

    response = client.post(
        f"/api/contracts/{created['id']}/send",
        headers=auth_headers,
    )
    assert response.status_code == 400


def test_send_contract_not_found(client, auth_headers):
    response = client.post(
        "/api/contracts/nao-existe/send",
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_send_contract_zapsign_error(client, db, auth_headers):
    lead, event = _make_lead_and_event(db)
    created = client.post(
        "/api/contracts/",
        json=_contract_payload(event.id),
        headers=auth_headers,
    ).json()

    # Precisa ter PDF para chegar no ZapSign
    contract = db.get(Contract, created["id"])
    contract.pdf_template_base64 = _TINY_PDF_B64
    db.commit()

    with patch(
        "app.services.zapsign.create_document",
        new=AsyncMock(side_effect=Exception("ZapSign offline")),
    ):
        response = client.post(
            f"/api/contracts/{created['id']}/send",
            headers=auth_headers,
        )

    assert response.status_code == 502
