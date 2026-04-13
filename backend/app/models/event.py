from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EventStatus(str, enum.Enum):
    planejamento = "planejamento"
    confirmado = "confirmado"
    realizado = "realizado"
    cancelado = "cancelado"


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    lead_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("leads.id"), index=True
    )
    title: Mapped[str] = mapped_column(String(300))
    date_start: Mapped[datetime] = mapped_column(DateTime, index=True)
    date_end: Mapped[datetime] = mapped_column(DateTime)
    space: Mapped[str] = mapped_column(String(200))
    guest_count: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(
        Enum(EventStatus), default=EventStatus.planejamento
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    google_event_id: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    lead: Mapped["Lead"] = relationship(back_populates="events")

    # ── Propriedades computadas (requerem que `lead` esteja carregado) ──
    @property
    def lead_name(self) -> "Optional[str]":
        try:
            return self.lead.name if self.lead else None
        except Exception:
            return None

    @property
    def lead_phone(self) -> "Optional[str]":
        try:
            return self.lead.phone if self.lead else None
        except Exception:
            return None
    payments: Mapped[List["Payment"]] = relationship(back_populates="event")
    contracts: Mapped[List["Contract"]] = relationship(back_populates="event")
    event_providers: Mapped[List["EventProvider"]] = relationship(
        back_populates="event"
    )


class EventProvider(Base):
    """Tabela associativa entre eventos e fornecedores."""

    __tablename__ = "event_providers"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    event_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("events.id")
    )
    provider_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("providers.id")
    )
    role: Mapped[Optional[str]] = mapped_column(String(100))

    event: Mapped["Event"] = relationship(back_populates="event_providers")
    provider: Mapped["Provider"] = relationship()
