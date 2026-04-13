from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MessageTemplateOut(BaseModel):
    id: str
    key: str
    title: str
    body: str
    flow: str
    trigger: str
    channel: str
    variables: Optional[str]
    is_active: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageTemplateUpdate(BaseModel):
    body: Optional[str] = None
    is_active: Optional[bool] = None
