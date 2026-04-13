from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.lead import EventType, FunnelStage, SourceChannel


class LeadCreate(BaseModel):
    name: str = Field(max_length=200)
    phone: str = Field(max_length=20)
    email: str | None = Field(default=None, max_length=200)
    event_date: datetime | None = None
    event_date_alt: datetime | None = None
    event_type: EventType = EventType.outro
    guest_count: int | None = Field(default=None, ge=1)
    budget: float | None = Field(default=None, ge=0)
    source_channel: SourceChannel = SourceChannel.outro
    notes: str | None = None
    consent_lgpd: bool = False
    utm_source: str | None = Field(default=None, max_length=100)
    utm_medium: str | None = Field(default=None, max_length=100)
    utm_campaign: str | None = Field(default=None, max_length=200)


class LeadUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=200)
    event_date: datetime | None = None
    event_date_alt: datetime | None = None
    event_type: EventType | None = None
    guest_count: int | None = Field(default=None, ge=1)
    budget: float | None = Field(default=None, ge=0)
    source_channel: SourceChannel | None = None
    funnel_stage: FunnelStage | None = None
    notes: str | None = None
    consent_lgpd: bool | None = None


class LeadOut(BaseModel):
    id: str
    name: str
    phone: str
    email: str | None
    event_date: datetime | None
    event_date_alt: datetime | None
    event_type: EventType
    guest_count: int | None
    budget: float | None
    source_channel: SourceChannel
    score: int
    funnel_stage: FunnelStage
    notes: str | None
    consent_lgpd: bool
    utm_source: str | None
    utm_medium: str | None
    utm_campaign: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
