from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.core.security import get_current_user
from app.database import get_db
from app.models.event import Event, EventStatus
from app.schemas.event import EventCreate, EventOut, EventUpdate

router = APIRouter()


def _check_conflict(
    db: Session,
    space: str,
    start: datetime,
    end: datetime,
    exclude_id: str | None = None,
):
    """Verifica conflito de datas para o mesmo espaço."""
    q = db.query(Event).filter(
        Event.space == space,
        Event.status != EventStatus.cancelado,
        Event.date_start < end,
        Event.date_end > start,
    )
    if exclude_id:
        q = q.filter(Event.id != exclude_id)
    return q.first()


@router.get("/", response_model=list[EventOut])
def list_events(
    status: EventStatus | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Event).options(selectinload(Event.lead))
    if status:
        q = q.filter(Event.status == status)
    if date_from:
        q = q.filter(Event.date_start >= date_from)
    if date_to:
        q = q.filter(Event.date_start <= date_to)
    return q.order_by(Event.date_start).offset(skip).limit(limit).all()


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    event = db.query(Event).options(selectinload(Event.lead)).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Evento não encontrado")
    return event


@router.post("/", response_model=EventOut, status_code=201)
def create_event(
    data: EventCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    if data.date_end <= data.date_start:
        raise HTTPException(400, "Data final deve ser posterior à data inicial")
    conflict = _check_conflict(db, data.space, data.date_start, data.date_end)
    if conflict:
        raise HTTPException(
            409,
            f"Conflito de agenda: espaço '{data.space}' já reservado de "
            f"{conflict.date_start} a {conflict.date_end}",
        )
    event = Event(**data.model_dump())
    db.add(event)
    db.commit()
    # Rebusca com lead carregado para preencher lead_name/lead_phone
    event = db.query(Event).options(selectinload(Event.lead)).filter(Event.id == event.id).first()
    return event


@router.patch("/{event_id}", response_model=EventOut)
def update_event(
    event_id: str,
    data: EventUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Evento não encontrado")

    updates = data.model_dump(exclude_unset=True)
    start = updates.get("date_start", event.date_start)
    end = updates.get("date_end", event.date_end)
    space = updates.get("space", event.space)

    if end <= start:
        raise HTTPException(400, "Data final deve ser posterior à data inicial")

    conflict = _check_conflict(db, space, start, end, exclude_id=event_id)
    if conflict:
        raise HTTPException(409, f"Conflito de agenda com evento '{conflict.title}'")

    for field, value in updates.items():
        setattr(event, field, value)
    db.commit()
    event = db.query(Event).options(selectinload(Event.lead)).filter(Event.id == event_id).first()
    return event


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Evento não encontrado")
    # Remove do Google Calendar se sincronizado
    if event.google_event_id:
        try:
            from app.services.google_calendar import get_google_calendar_service
            svc = get_google_calendar_service()
            if svc:
                svc.delete_event(event.google_event_id)
        except Exception:
            pass
    db.delete(event)
    db.commit()


@router.post("/{event_id}/sync-calendar", response_model=EventOut)
def sync_google_calendar(
    event_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Cria ou atualiza evento no Google Calendar e salva o ID no CRM."""
    from app.models.lead import Lead
    from app.services.google_calendar import get_google_calendar_service

    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Evento não encontrado")

    svc = get_google_calendar_service()
    if not svc:
        raise HTTPException(
            503,
            "Google Calendar não configurado. Adicione as credenciais nas Configurações.",
        )

    lead = db.get(Lead, event.lead_id)
    lead_name = lead.name if lead else "Cliente"
    lead_email = lead.email if lead else None
    description = f"Lead: {lead_name}\nEspaço: {event.space}"
    if event.guest_count:
        description += f"\nConvidados: {event.guest_count}"
    attendees = [lead_email] if lead_email else []

    if event.google_event_id and svc.event_exists(event.google_event_id):
        # Atualiza evento existente
        svc.update_event(
            event.google_event_id,
            title=event.title,
            start=event.date_start,
            end=event.date_end,
            description=description,
        )
    else:
        # Cria novo evento
        gid = svc.create_event(
            title=event.title,
            start=event.date_start,
            end=event.date_end,
            description=description,
            attendees=attendees,
        )
        if not gid:
            raise HTTPException(502, "Erro ao criar evento no Google Calendar")
        event.google_event_id = gid

    db.commit()
    event = db.query(Event).options(selectinload(Event.lead)).filter(Event.id == event_id).first()
    return event


@router.delete("/{event_id}/sync-calendar", status_code=204)
def unsync_google_calendar(
    event_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Remove evento do Google Calendar mas mantém no CRM."""
    from app.services.google_calendar import get_google_calendar_service

    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Evento não encontrado")
    if not event.google_event_id:
        raise HTTPException(400, "Evento não está sincronizado com Google Calendar")

    svc = get_google_calendar_service()
    if svc:
        svc.delete_event(event.google_event_id)

    event.google_event_id = None
    db.commit()
