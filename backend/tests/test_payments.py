"""
Testes de pagamentos — CRUD e integração com Asaas (mockada).
"""

from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.models.event import Event
from app.models.lead import Lead
from app.models.payment import Payment, PaymentStatus


# ── Fixtures auxiliares ──────────────────────────────────────────────────────

def _make_lead_and_event(db):
    lead = Lead(name="Lead Pagamento", phone="11977770000", consent_lgpd=True)
    db.add(lead)
    db.flush()

    event = Event(
        lead_id=lead.id,
        title="Evento Pagamento",
        date_start=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=60),
        date_end=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=60, hours=6),
        space="Salão A",
    )
    db.add(event)
    db.commit()
    db.refresh(lead)
    db.refresh(event)
    return lead, event


def _payment_payload(event_id: str, **overrides):
    base = {
        "event_id": event_id,
        "amount": 5000.00,
        "due_date": (date.today() + timedelta(days=30)).isoformat(),
        "method": "pix",
        "installment_number": 1,
        "installment_total": 2,
    }
    base.update(overrides)
    return base


# ── Listagem ──────────────────────────────────────────────────────────────────

def test_list_payments_empty(client, auth_headers):
    response = client.get("/api/payments/", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_list_payments_requires_auth(client):
    response = client.get("/api/payments/")
    assert response.status_code == 401


# ── Criação ───────────────────────────────────────────────────────────────────

def test_create_payment(client, db, auth_headers):
    _, event = _make_lead_and_event(db)
    response = client.post(
        "/api/payments/",
        json=_payment_payload(event.id),
        headers=auth_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["event_id"] == event.id
    assert body["amount"] == 5000.00
    assert body["status"] == "pendente"
    assert body["asaas_id"] is None


def test_create_payment_invalid_installment(client, db, auth_headers):
    _, event = _make_lead_and_event(db)
    response = client.post(
        "/api/payments/",
        json=_payment_payload(event.id, installment_number=3, installment_total=2),
        headers=auth_headers,
    )
    assert response.status_code == 400


# ── Leitura individual ────────────────────────────────────────────────────────

def test_get_payment(client, db, auth_headers):
    _, event = _make_lead_and_event(db)
    created = client.post(
        "/api/payments/",
        json=_payment_payload(event.id),
        headers=auth_headers,
    ).json()

    response = client.get(f"/api/payments/{created['id']}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_get_payment_not_found(client, auth_headers):
    response = client.get("/api/payments/nao-existe", headers=auth_headers)
    assert response.status_code == 404


# ── Atualização ───────────────────────────────────────────────────────────────

def test_update_payment_status(client, db, auth_headers):
    _, event = _make_lead_and_event(db)
    created = client.post(
        "/api/payments/",
        json=_payment_payload(event.id),
        headers=auth_headers,
    ).json()

    response = client.patch(
        f"/api/payments/{created['id']}",
        json={"status": "pago", "confirmed_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat()},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "pago"


# ── Exclusão ──────────────────────────────────────────────────────────────────

def test_delete_payment(client, db, auth_headers):
    _, event = _make_lead_and_event(db)
    created = client.post(
        "/api/payments/",
        json=_payment_payload(event.id),
        headers=auth_headers,
    ).json()

    response = client.delete(f"/api/payments/{created['id']}", headers=auth_headers)
    assert response.status_code == 204

    response = client.get(f"/api/payments/{created['id']}", headers=auth_headers)
    assert response.status_code == 404


# ── Charge (Asaas) ────────────────────────────────────────────────────────────

def test_charge_payment_success(client, db, auth_headers):
    lead, event = _make_lead_and_event(db)
    created = client.post(
        "/api/payments/",
        json=_payment_payload(event.id),
        headers=auth_headers,
    ).json()

    with (
        patch(
            "app.services.asaas.get_or_create_customer",
            new=AsyncMock(return_value="cus_asaas_abc123"),
        ),
        patch(
            "app.services.asaas.create_charge",
            new=AsyncMock(return_value={"id": "pay_asaas_xyz789"}),
        ),
        patch(
            "app.services.asaas.get_payment_link",
            new=AsyncMock(return_value="https://www.asaas.com/i/abc123"),
        ),
        patch("app.services.whatsapp.send_whatsapp_message", new=AsyncMock()),
    ):
        response = client.post(
            f"/api/payments/{created['id']}/charge",
            headers=auth_headers,
        )

    assert response.status_code == 200
    body = response.json()
    assert body["asaas_id"] == "pay_asaas_xyz789"


def test_charge_payment_already_charged(client, db, auth_headers):
    lead, event = _make_lead_and_event(db)
    created = client.post(
        "/api/payments/",
        json=_payment_payload(event.id),
        headers=auth_headers,
    ).json()

    # Simula pagamento já com asaas_id
    payment = db.get(Payment, created["id"])
    payment.asaas_id = "pay_ja_existe"
    db.commit()

    response = client.post(
        f"/api/payments/{created['id']}/charge",
        headers=auth_headers,
    )
    assert response.status_code == 409


def test_charge_payment_wrong_status(client, db, auth_headers):
    lead, event = _make_lead_and_event(db)
    created = client.post(
        "/api/payments/",
        json=_payment_payload(event.id),
        headers=auth_headers,
    ).json()

    # Muda status para pago — não pode cobrar novamente
    payment = db.get(Payment, created["id"])
    payment.status = PaymentStatus.pago
    db.commit()

    response = client.post(
        f"/api/payments/{created['id']}/charge",
        headers=auth_headers,
    )
    assert response.status_code == 400


def test_charge_payment_not_found(client, auth_headers):
    response = client.post(
        "/api/payments/nao-existe/charge",
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_charge_payment_asaas_error(client, db, auth_headers):
    lead, event = _make_lead_and_event(db)
    created = client.post(
        "/api/payments/",
        json=_payment_payload(event.id),
        headers=auth_headers,
    ).json()

    with (
        patch(
            "app.services.asaas.get_or_create_customer",
            new=AsyncMock(side_effect=Exception("Timeout")),
        ),
    ):
        response = client.post(
            f"/api/payments/{created['id']}/charge",
            headers=auth_headers,
        )

    assert response.status_code == 502
