from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PaymentMethod(str, enum.Enum):
    pix = "pix"
    boleto = "boleto"
    cartao = "cartao"


class PaymentStatus(str, enum.Enum):
    pendente = "pendente"
    pago = "pago"
    vencido = "vencido"
    falhou = "falhou"
    cancelado = "cancelado"


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    event_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("events.id"), index=True
    )
    amount: Mapped[float] = mapped_column(Float)
    due_date: Mapped[date] = mapped_column(Date)
    method: Mapped[str] = mapped_column(Enum(PaymentMethod))
    installment_number: Mapped[int] = mapped_column(Integer, default=1)
    installment_total: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.pendente
    )
    asaas_id: Mapped[Optional[str]] = mapped_column(String(100))
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    event: Mapped["Event"] = relationship(back_populates="payments")

    @property
    def lead_phone(self) -> str | None:
        try:
            return self.event.lead.phone
        except AttributeError:
            return None

    @property
    def lead_name(self) -> str | None:
        try:
            return self.event.lead.name
        except AttributeError:
            return None
