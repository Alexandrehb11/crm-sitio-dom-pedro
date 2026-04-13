from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.event import EventStatus


class EventCreate(BaseModel):
    lead_id: str
    title: str = Field(max_length=300)
    date_start: datetime
    date_end: datetime
    space: str = Field(max_length=200)
    guest_count: int | None = Field(default=None, ge=1)
    notes: str | None = None


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    date_start: datetime | None = None
    date_end: datetime | None = None
    space: str | None = Field(default=None, max_length=200)
    guest_count: int | None = Field(default=None, ge=1)
    status: EventStatus | None = None
    notes: str | None = None


class EventOut(BaseModel):
    id: str
    lead_id: str
    lead_name: str | None = None   # via propriedade do model (requer selectinload)
    lead_phone: str | None = None  # via propriedade do model (requer selectinload)
    title: str
    date_start: datetime
    date_end: datetime
    space: str
    guest_count: int | None
    status: EventStatus
    notes: str | None
    google_event_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
