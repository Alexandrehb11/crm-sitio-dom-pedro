from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.payment import PaymentMethod, PaymentStatus


class PaymentCreate(BaseModel):
    event_id: str
    amount: float = Field(gt=0)
    due_date: date
    method: PaymentMethod
    installment_number: int = Field(default=1, ge=1)
    installment_total: int = Field(default=1, ge=1)


class PaymentUpdate(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    due_date: date | None = None
    method: PaymentMethod | None = None
    status: PaymentStatus | None = None
    asaas_id: str | None = None
    confirmed_at: datetime | None = None


class PaymentOut(BaseModel):
    id: str
    event_id: str
    amount: float
    due_date: date
    method: PaymentMethod
    installment_number: int
    installment_total: int
    status: PaymentStatus
    asaas_id: str | None
    confirmed_at: datetime | None
    created_at: datetime
    lead_phone: str | None = None
    lead_name: str | None = None

    model_config = {"from_attributes": True}
