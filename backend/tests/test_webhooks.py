"""
Testes dos webhooks — Asaas, ZapSign e WhatsApp.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.models.contract import Contract, ContractStatus
from app.models.event import Event, EventStatus
from app.models.lead import FunnelStage, Lead
from app.models.payment import Payment, PaymentMethod, PaymentStatus


# ── Helpers ───────────────────────────────────────────────────────────────────

def _seed_lead(db, phone="11900000001", stage=FunnelStage.lead):
    from datetime import date
    lead = Lead(
        name="Lead Webhook",
        phone=phone,
        email="webhook@email.com",
        funnel_stage=stage,
        consent_lgpd=True,
    )
    db.add(lead)
    db.flush()
    return lead


def _seed_event(db, lead):
    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30)
    event = Event(
        lead_id=lead.id,
        title="Evento Webhook",
        date_start=start,
        date_end=start + timedelta(hours=6),
        space="Salão",
        status=EventStatus.confirmado,
    )
    db.add(event)
    db.flush()
    return event


def _seed_payment(db, event, asaas_id="pay_asaas_test"):
    from datetime import date
    payment = Payment(
        event_id=event.id,
        amount=2000.0,
        due_date=date.today() + timedelta(days=10),
        method=PaymentMethod.pix,
        asaas_id=asaas_id,
    )
    db.add(payment)
    db.flush()
    return payment


def _seed_contract(db, event, zapsign_id="zap_test_open_id"):
    contract = Contract(
        event_id=event.id,
        template_type="casamento",
        zapsign_id=zapsign_id,
    )
    db.add(contract)
    db.flush()
    return contract


# ── Webhook Asaas ─────────────────────────────────────────────────────────────

def test_asaas_payment_received(client, db):
    lead = _seed_lead(db)
    event = _seed_event(db, lead)
    payment = _seed_payment(db, event)
    db.commit()

    with patch("app.services.whatsapp.send_whatsapp_message", new=AsyncMock()):
        response = client.post(
            "/api/webhooks/asaas",
            json={
                "event": "PAYMENT_RECEIVED",
                "payment": {"id": "pay_asaas_test"},
            },
        )

    assert response.status_code == 200
    db.refresh(payment)
    assert payment.status == PaymentStatus.pago
    assert payment.confirmed_at is not None


def test_asaas_payment_overdue(client, db):
    lead = _seed_lead(db, phone="11900000011")
    event = _seed_event(db, lead)
    payment = _seed_payment(db, event, asaas_id="pay_overdue")
    db.commit()

    response = client.post(
        "/api/webhooks/asaas",
        json={
            "event": "PAYMENT_OVERDUE",
            "payment": {"id": "pay_overdue"},
        },
    )

    assert response.status_code == 200
    db.refresh(payment)
    assert payment.status == PaymentStatus.vencido


def test_asaas_payment_deleted(client, db):
    lead = _seed_lead(db, phone="11900000012")
    event = _seed_event(db, lead)
    payment = _seed_payment(db, event, asaas_id="pay_deleted")
    db.commit()

    response = client.post(
        "/api/webhooks/asaas",
        json={
            "event": "PAYMENT_DELETED",
            "payment": {"id": "pay_deleted"},
        },
    )

    assert response.status_code == 200
    db.refresh(payment)
    assert payment.status == PaymentStatus.cancelado


def test_asaas_unknown_payment_ignored(client):
    """Pagamento não cadastrado deve retornar 200 sem erro."""
    response = client.post(
        "/api/webhooks/asaas",
        json={
            "event": "PAYMENT_RECEIVED",
            "payment": {"id": "pay_desconhecido_xyz"},
        },
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_asaas_missing_payment_id(client):
    response = client.post(
        "/api/webhooks/asaas",
        json={"event": "PAYMENT_RECEIVED", "payment": {}},
    )
    assert response.status_code == 400


# ── Webhook ZapSign ────────────────────────────────────────────────────────────

def test_zapsign_finished(client, db):
    lead = _seed_lead(db, phone="11900000021", stage=FunnelStage.proposta_enviada)
    event = _seed_event(db, lead)
    contract = _seed_contract(db, event)
    db.commit()

    # calculate_score é uma função pura sem I/O — deixamos rodar de verdade
    response = client.post(
        "/api/webhooks/zapsign",
        json={
            "event_type": "finished",
            "document": {
                "open_id": "zap_test_open_id",
                "signers": [{"name": "Lead Webhook"}],
            },
        },
    )

    assert response.status_code == 200
    db.refresh(contract)
    db.refresh(lead)
    assert contract.status == ContractStatus.assinado
    assert contract.signed_by == "Lead Webhook"
    assert contract.signed_date is not None
    assert lead.funnel_stage == FunnelStage.contrato_assinado


def test_zapsign_refused(client, db):
    lead = _seed_lead(db, phone="11900000022")
    event = _seed_event(db, lead)
    contract = _seed_contract(db, event, zapsign_id="zap_refused")
    db.commit()

    response = client.post(
        "/api/webhooks/zapsign",
        json={
            "event_type": "refused",
            "document": {"open_id": "zap_refused"},
        },
    )

    assert response.status_code == 200
    db.refresh(contract)
    assert contract.status == ContractStatus.cancelado


def test_zapsign_unknown_document_ignored(client):
    response = client.post(
        "/api/webhooks/zapsign",
        json={
            "event_type": "finished",
            "document": {"open_id": "zap_desconhecido_xyz"},
        },
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_zapsign_missing_open_id(client):
    response = client.post(
        "/api/webhooks/zapsign",
        json={"event_type": "finished", "document": {}},
    )
    assert response.status_code == 400


def test_zapsign_no_funnel_regression(client, db):
    """Lead já em evento_realizado não deve regredir no funil."""
    lead = _seed_lead(db, phone="11900000023", stage=FunnelStage.evento_realizado)
    event = _seed_event(db, lead)
    contract = _seed_contract(db, event, zapsign_id="zap_no_regression")
    db.commit()

    response = client.post(
        "/api/webhooks/zapsign",
        json={
            "event_type": "finished",
            "document": {"open_id": "zap_no_regression"},
        },
    )

    assert response.status_code == 200
    db.refresh(lead)
    assert lead.funnel_stage == FunnelStage.evento_realizado  # não regrediu


# ── Webhook WhatsApp ──────────────────────────────────────────────────────────

def test_whatsapp_confirmo_reply(client, db):
    lead = _seed_lead(db, phone="11900000031", stage=FunnelStage.visita_agendada)
    db.commit()

    with patch("app.services.whatsapp.send_whatsapp_message", new=AsyncMock()) as mock_wa:
        response = client.post(
            "/api/webhooks/whatsapp",
            json={
                "data": {
                    "key": {"remoteJid": "11900000031@s.whatsapp.net"},
                    "message": {"conversation": "confirmo"},
                }
            },
        )

    assert response.status_code == 200
    mock_wa.assert_called_once()
    call_args = mock_wa.call_args[0]
    assert "confirmada" in call_args[1].lower() or "confirmado" in call_args[1].lower()


def test_whatsapp_cancelar_reply(client, db):
    lead = _seed_lead(db, phone="11900000032")
    db.commit()

    with patch("app.services.whatsapp.send_whatsapp_message", new=AsyncMock()) as mock_wa:
        response = client.post(
            "/api/webhooks/whatsapp",
            json={
                "phone": "11900000032",
                "text": {"message": "cancelar"},
            },
        )

    assert response.status_code == 200
    mock_wa.assert_called_once()


def test_whatsapp_unknown_phone_ignored(client):
    response = client.post(
        "/api/webhooks/whatsapp",
        json={
            "phone": "00000000000",
            "text": {"message": "oi"},
        },
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_whatsapp_empty_phone_ignored(client):
    response = client.post(
        "/api/webhooks/whatsapp",
        json={"data": {}, "phone": ""},
    )
    assert response.status_code == 200
