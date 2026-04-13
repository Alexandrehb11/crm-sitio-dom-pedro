"""
Dashboard — KPIs consolidados para o frontend.

GET /api/dashboard/kpis
GET /api/dashboard/funnel
GET /api/dashboard/calendar  (próximos eventos)
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.event import Event, EventStatus
from app.models.lead import FunnelStage, Lead
from app.models.payment import Payment, PaymentStatus
from app.services.lead_scoring import classify_lead

router = APIRouter()


@router.get("/kpis")
def get_kpis(db: Session = Depends(get_db)):
    """
    Retorna métricas gerais:
    - total de leads e breakdown por temperatura
    - eventos confirmados/realizados
    - receita confirmada e pendente
    """
    leads = db.query(Lead).all()
    total_leads = len(leads)
    quentes = sum(1 for l in leads if classify_lead(l.score) == "quente")
    mornos = sum(1 for l in leads if classify_lead(l.score) == "morno")
    frios = total_leads - quentes - mornos

    eventos_confirmados = (
        db.query(func.count(Event.id))
        .filter(Event.status == EventStatus.confirmado)
        .scalar()
    )
    eventos_realizados = (
        db.query(func.count(Event.id))
        .filter(Event.status == EventStatus.realizado)
        .scalar()
    )

    receita_confirmada = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.status == PaymentStatus.pago)
        .scalar()
    )
    receita_pendente = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.status == PaymentStatus.pendente)
        .scalar()
    )

    return {
        "leads": {
            "total": total_leads,
            "quentes": quentes,
            "mornos": mornos,
            "frios": frios,
        },
        "eventos": {
            "confirmados": eventos_confirmados,
            "realizados": eventos_realizados,
        },
        "receita": {
            "confirmada": float(receita_confirmada),
            "pendente": float(receita_pendente),
        },
    }


@router.get("/funnel")
def get_funnel(db: Session = Depends(get_db)):
    """Contagem de leads por etapa do funil."""
    rows = (
        db.query(Lead.funnel_stage, func.count(Lead.id))
        .group_by(Lead.funnel_stage)
        .all()
    )
    order = [s.value for s in FunnelStage]
    counts = {stage: 0 for stage in order}
    for stage, count in rows:
        counts[stage] = count
    return [{"stage": s, "count": counts[s]} for s in order]


@router.get("/calendar")
def get_calendar(
    days: int = 30,
    db: Session = Depends(get_db),
):
    """Próximos N dias de eventos confirmados."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    until = now + timedelta(days=days)
    events = (
        db.query(Event)
        .filter(
            Event.status == EventStatus.confirmado,
            Event.date_start >= now,
            Event.date_start <= until,
        )
        .order_by(Event.date_start)
        .all()
    )
    return [
        {
            "id": e.id,
            "title": e.title,
            "date_start": e.date_start.isoformat(),
            "date_end": e.date_end.isoformat(),
            "space": e.space,
            "guest_count": e.guest_count,
        }
        for e in events
    ]
