from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.models.contract import ContractStatus


class ContractCreate(BaseModel):
    event_id: str
    template_type: str = Field(max_length=100)
    client_name: str = Field(max_length=200, description="Nome do signatário (cliente)")
    client_phone: str = Field(max_length=30, description="Telefone do signatário")


class ContractUpdate(BaseModel):
    template_type: str | None = Field(default=None, max_length=100)
    client_name: str | None = Field(default=None, max_length=200)
    client_phone: str | None = Field(default=None, max_length=30)
    signed_by: str | None = Field(default=None, max_length=200)
    signed_date: datetime | None = None
    zapsign_id: str | None = None
    signed_via: str | None = None
    status: ContractStatus | None = None


class ContractOut(BaseModel):
    id: str
    event_id: str
    event_title: str | None = None   # via propriedade do model (requer selectinload)
    template_type: str
    client_name: str | None = None
    client_phone: str | None = None
    has_pdf: bool = False             # via propriedade do model
    signed_by: str | None = None
    signed_date: datetime | None = None
    zapsign_id: str | None = None
    signed_via: str | None = None
    status: ContractStatus
    created_at: datetime

    model_config = {"from_attributes": True}
