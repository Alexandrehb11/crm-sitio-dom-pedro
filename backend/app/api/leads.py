from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.event import Event, EventStatus
from app.models.lead import FunnelStage, Lead, SourceChannel
from app.schemas.lead import LeadCreate, LeadOut, LeadUpdate
from app.services.lead_scoring import calculate_score

router = APIRouter()


# ── Schema público ─────────────────────────────────────────────────────────────

class VerifyDateRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    event_date: datetime
    event_type: str = "outro"
    guest_count: Optional[int] = None
    budget: Optional[float] = None
    source_channel: str = "formulario"
    notes: Optional[str] = None
    consent_lgpd: bool = False
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None


class VerifyDateResponse(BaseModel):
    available: bool
    message: str
    lead_id: Optional[str] = None
    alternative_dates: list[str] = []


# ── Endpoint público (sem autenticação) ───────────────────────────────────────

@router.post("/verify-date", response_model=VerifyDateResponse, status_code=200)
def verify_date(data: VerifyDateRequest, db: Session = Depends(get_db)):
    """
    Endpoint público — formulário do site.
    Verifica disponibilidade da data, cria lead e dispara automação.
    """
    # Verifica conflito de data (qualquer espaço)
    date_start = data.event_date.replace(hour=8, minute=0, second=0, microsecond=0)
    date_end = data.event_date.replace(hour=23, minute=59, second=59, microsecond=0)

    conflict = (
        db.query(Event)
        .filter(
            Event.status.in_([EventStatus.confirmado, EventStatus.planejamento]),
            Event.date_start < date_end,
            Event.date_end > date_start,
        )
        .first()
    )

    # Cria lead independente de disponibilidade
    lead = Lead(
        name=data.name,
        phone=data.phone,
        email=data.email,
        event_date=data.event_date,
        event_type=data.event_type,
        guest_count=data.guest_count,
        budget=data.budget,
        source_channel=data.source_channel,
        notes=data.notes,
        consent_lgpd=data.consent_lgpd,
        utm_source=data.utm_source,
        utm_medium=data.utm_medium,
        utm_campaign=data.utm_campaign,
    )
    lead.score = calculate_score(lead)
    db.add(lead)
    db.commit()
    db.refresh(lead)

    # Dispara automação
    try:
        from app.worker import handle_new_lead
        handle_new_lead.apply_async(args=[lead.id], countdown=5)
    except Exception:
        pass

    if conflict:
        # Data indisponível — sugere datas alternativas (próximos 3 fins de semana livres)
        from datetime import timedelta
        alternatives: list[str] = []
        candidate = data.event_date
        while len(alternatives) < 3:
            candidate = candidate + timedelta(days=7)
            c_start = candidate.replace(hour=8, minute=0, second=0, microsecond=0)
            c_end = candidate.replace(hour=23, minute=59, second=59, microsecond=0)
            alt_conflict = (
                db.query(Event)
                .filter(
                    Event.status.in_([EventStatus.confirmado, EventStatus.planejamento]),
                    Event.date_start < c_end,
                    Event.date_end > c_start,
                )
                .first()
            )
            if not alt_conflict:
                alternatives.append(candidate.strftime("%d/%m/%Y"))

        return VerifyDateResponse(
            available=False,
            message=(
                "Esta data não está disponível. "
                "Nossa equipe entrará em contato com opções alternativas. "
                "Sugestões disponíveis: " + ", ".join(alternatives)
            ),
            lead_id=lead.id,
            alternative_dates=alternatives,
        )

    return VerifyDateResponse(
        available=True,
        message=(
            "Data disponível! Recebemos sua consulta e nossa equipe "
            "entrará em contato em breve para confirmar os detalhes."
        ),
        lead_id=lead.id,
    )


@router.get("/", response_model=list[LeadOut])
def list_leads(
    stage: FunnelStage | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Lead)
    if stage:
        q = q.filter(Lead.funnel_stage == stage)
    return q.order_by(Lead.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead não encontrado")
    return lead


@router.post("/", response_model=LeadOut, status_code=201)
def create_lead(data: LeadCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    lead = Lead(**data.model_dump())
    lead.score = calculate_score(lead)
    db.add(lead)
    db.commit()
    db.refresh(lead)

    # Fluxo 1: dispara automação de novo lead (resposta WA <2min)
    try:
        from app.worker import handle_new_lead
        handle_new_lead.apply_async(args=[lead.id], countdown=5)
    except Exception:
        pass  # Worker indisponível não deve bloquear o endpoint

    return lead


@router.patch("/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: str,
    data: LeadUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead não encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    lead.score = calculate_score(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.delete("/{lead_id}", status_code=204)
def delete_lead(lead_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(404, "Lead não encontrado")
    db.delete(lead)
    db.commit()
