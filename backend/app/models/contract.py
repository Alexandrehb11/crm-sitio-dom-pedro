from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ContractStatus(str, enum.Enum):
    pendente = "pendente"
    assinado = "assinado"
    executado = "executado"
    cancelado = "cancelado"


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    event_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("events.id"), index=True
    )
    template_type: Mapped[str] = mapped_column(String(100))

    # ── Identificação do signatário ──
    client_name: Mapped[Optional[str]] = mapped_column(String(200))
    client_phone: Mapped[Optional[str]] = mapped_column(String(30))

    # ── PDF do modelo de contrato (base64) ──
    pdf_template_base64: Mapped[Optional[str]] = mapped_column(Text)

    signed_by: Mapped[Optional[str]] = mapped_column(String(200))
    signed_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    zapsign_id: Mapped[Optional[str]] = mapped_column(String(100))
    signed_via: Mapped[Optional[str]] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(
        Enum(ContractStatus), default=ContractStatus.pendente
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    event: Mapped["Event"] = relationship(back_populates="contracts")

    # ── Propriedades computadas (usadas pelo schema Pydantic) ──

    @property
    def has_pdf(self) -> bool:
        """Indica se um PDF foi anexado ao contrato."""
        return self.pdf_template_base64 is not None and len(self.pdf_template_base64) > 0

    @property
    def event_title(self) -> Optional[str]:
        """Título do evento (requer que o relacionamento `event` esteja carregado)."""
        try:
            return self.event.title if self.event else None
        except Exception:
            return None
