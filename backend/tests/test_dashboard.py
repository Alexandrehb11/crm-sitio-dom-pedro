"""
Testes do dashboard — KPIs, funil e calendário.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.models.event import Event, EventStatus
from app.models.lead import FunnelStage, Lead
from app.models.payment import Payment, PaymentMethod, PaymentStatus


# ── Helpers ───────────────────────────────────────────────────────────────────

def _seed_lead(db, score=0, stage=FunnelStage.lead, **kwargs):
    lead = Lead(
        name=kwargs.get("name", "Lead Dashboard"),
        phone=kwargs.get("phone", "119" + str(abs(hash(str(score) + str(stage))))[:8]),
        score=score,
        funnel_stage=stage,
        consent_lgpd=True,
    )
    db.add(lead)
    db.flush()
    return lead


def _seed_event(db, lead, status=EventStatus.planejamento, days_ahead=30):
    start = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=days_ahead)
    event = Event(
        lead_id=lead.id,
        title="Evento Teste",
        date_start=start,
        date_end=start + timedelta(hours=6),
        space="Salão Principal",
        status=status,
    )
    db.add(event)
    db.flush()
    return event


def _seed_payment(db, event, amount=1000.0, status=PaymentStatus.pendente):
    from datetime import date
    payment = Payment(
        event_id=event.id,
        amount=amount,
        due_date=date.today() + timedelta(days=30),
        method=PaymentMethod.pix,
        status=status,
    )
    db.add(payment)
    db.flush()
    return payment


# ── KPIs ─────────────────────────────────────────────────────────────────────

def test_kpis_empty_db(client):
    """Dashboard deve funcionar mesmo sem dados."""
    response = client.get("/api/dashboard/kpis")
    assert response.status_code == 200
    body = response.json()
    assert body["leads"]["total"] == 0
    assert body["eventos"]["confirmados"] == 0
    assert body["receita"]["confirmada"] == 0.0


def test_kpis_with_data(client, db):
    # Lead quente (score > 70), morno (40-69), frio (< 40)
    lead_quente = _seed_lead(db, score=80, stage=FunnelStage.proposta_enviada, phone="11900000001")
    lead_morno = _seed_lead(db, score=50, stage=FunnelStage.visita_agendada, phone="11900000002")
    lead_frio = _seed_lead(db, score=10, stage=FunnelStage.lead, phone="11900000003")

    # Evento confirmado
    event = _seed_event(db, lead_quente, status=EventStatus.confirmado)
    # Pagamento pago
    _seed_payment(db, event, amount=3000.0, status=PaymentStatus.pago)
    # Pagamento pendente
    _seed_payment(db, event, amount=1000.0, status=PaymentStatus.pendente)
    db.commit()

    response = client.get("/api/dashboard/kpis")
    assert response.status_code == 200
    body = response.json()

    assert body["leads"]["total"] == 3
    assert body["leads"]["quentes"] >= 1
    assert body["eventos"]["confirmados"] == 1
    assert body["receita"]["confirmada"] == 3000.0
    assert body["receita"]["pendente"] == 1000.0


# ── Funil ─────────────────────────────────────────────────────────────────────

def test_funnel_empty(client):
    response = client.get("/api/dashboard/funnel")
    assert response.status_code == 200
    body = response.json()
    # Deve retornar todas as etapas com count=0
    stages = [item["stage"] for item in body]
    assert "lead" in stages
    assert "contrato_assinado" in stages
    assert all(item["count"] == 0 for item in body)


def test_funnel_with_leads(client, db):
    _seed_lead(db, stage=FunnelStage.lead, phone="11800000001")
    _seed_lead(db, stage=FunnelStage.lead, phone="11800000002")
    _seed_lead(db, stage=FunnelStage.visita_agendada, phone="11800000003")
    db.commit()

    response = client.get("/api/dashboard/funnel")
    assert response.status_code == 200
    body = response.json()

    counts = {item["stage"]: item["count"] for item in body}
    assert counts["lead"] == 2
    assert counts["visita_agendada"] == 1
    assert counts["proposta_enviada"] == 0


# ── Calendário ────────────────────────────────────────────────────────────────

def test_calendar_empty(client):
    response = client.get("/api/dashboard/calendar")
    assert response.status_code == 200
    assert response.json() == []


def test_calendar_shows_confirmed_events(client, db):
    lead = _seed_lead(db, phone="11700000001")
    event = _seed_event(db, lead, status=EventStatus.confirmado, days_ahead=15)
    db.commit()

    response = client.get("/api/dashboard/calendar?days=30")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == event.id
    assert body[0]["title"] == "Evento Teste"


def test_calendar_excludes_non_confirmed(client, db):
    lead = _seed_lead(db, phone="11700000002")
    _seed_event(db, lead, status=EventStatus.planejamento, days_ahead=10)
    db.commit()

    response = client.get("/api/dashboard/calendar?days=30")
    assert response.status_code == 200
    assert response.json() == []


def test_calendar_excludes_events_outside_range(client, db):
    lead = _seed_lead(db, phone="11700000003")
    _seed_event(db, lead, status=EventStatus.confirmado, days_ahead=60)
    db.commit()

    response = client.get("/api/dashboard/calendar?days=30")
    assert response.status_code == 200
    assert response.json() == []
