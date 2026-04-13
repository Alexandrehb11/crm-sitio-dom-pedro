from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EventType(str, enum.Enum):
    casamento = "casamento"
    corporativo = "corporativo"
    debutante = "debutante"
    religioso = "religioso"
    aniversario = "aniversario"
    outro = "outro"


class SourceChannel(str, enum.Enum):
    formulario = "formulario"
    chatbot = "chatbot"
    whatsapp = "whatsapp"
    qr_code = "qr_code"
    indicacao = "indicacao"
    instagram = "instagram"
    outro = "outro"


class FunnelStage(str, enum.Enum):
    lead = "lead"
    visita_agendada = "visita_agendada"
    proposta_enviada = "proposta_enviada"
    contrato_assinado = "contrato_assinado"
    evento_realizado = "evento_realizado"


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(20), index=True)
    email: Mapped[Optional[str]] = mapped_column(String(200))
    event_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    event_date_alt: Mapped[Optional[datetime]] = mapped_column(DateTime)
    event_type: Mapped[str] = mapped_column(
        Enum(EventType), default=EventType.outro
    )
    guest_count: Mapped[Optional[int]] = mapped_column(Integer)
    budget: Mapped[Optional[float]] = mapped_column(Float)
    source_channel: Mapped[str] = mapped_column(
        Enum(SourceChannel), default=SourceChannel.outro
    )
    score: Mapped[int] = mapped_column(Integer, default=0)
    funnel_stage: Mapped[str] = mapped_column(
        Enum(FunnelStage), default=FunnelStage.lead
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    consent_lgpd: Mapped[bool] = mapped_column(Boolean, default=False)
    # UTM tracking (captura de origem via link/QR)
    utm_source: Mapped[Optional[str]] = mapped_column(String(100))
    utm_medium: Mapped[Optional[str]] = mapped_column(String(100))
    utm_campaign: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    events: Mapped[List["Event"]] = relationship(back_populates="lead")
