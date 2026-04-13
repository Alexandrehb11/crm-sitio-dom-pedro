from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.message_template import MessageTemplate
from app.schemas.message_template import MessageTemplateOut, MessageTemplateUpdate

router = APIRouter()


@router.get("/", response_model=list[MessageTemplateOut])
def list_templates(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return (
        db.query(MessageTemplate)
        .order_by(MessageTemplate.flow, MessageTemplate.key)
        .all()
    )


@router.patch("/{template_id}", response_model=MessageTemplateOut)
def update_template(
    template_id: str,
    data: MessageTemplateUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    tpl = db.get(MessageTemplate, template_id)
    if not tpl:
        raise HTTPException(404, "Template não encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(tpl, field, value)
    from datetime import datetime, timezone
    tpl.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(tpl)
    return tpl
