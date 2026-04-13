from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ProviderCreate(BaseModel):
    name: str = Field(max_length=200)
    category: str = Field(max_length=100)
    contact_name: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=20)
    whatsapp: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=200)
    notes: str | None = None


class ProviderUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    category: str | None = Field(default=None, max_length=100)
    contact_name: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=20)
    whatsapp: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=200)
    notes: str | None = None


class ProviderOut(BaseModel):
    id: str
    name: str
    category: str
    contact_name: str | None
    phone: str | None
    whatsapp: str | None
    email: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
