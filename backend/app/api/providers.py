from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.provider import Provider
from app.schemas.provider import ProviderCreate, ProviderOut, ProviderUpdate

router = APIRouter()


@router.get("/", response_model=list[ProviderOut])
def list_providers(
    category: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Provider)
    if category:
        q = q.filter(Provider.category == category)
    return q.order_by(Provider.name).offset(skip).limit(limit).all()


@router.get("/{provider_id}", response_model=ProviderOut)
def get_provider(provider_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    provider = db.get(Provider, provider_id)
    if not provider:
        raise HTTPException(404, "Fornecedor não encontrado")
    return provider


@router.post("/", response_model=ProviderOut, status_code=201)
def create_provider(
    data: ProviderCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    provider = Provider(**data.model_dump())
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


@router.patch("/{provider_id}", response_model=ProviderOut)
def update_provider(
    provider_id: str,
    data: ProviderUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    provider = db.get(Provider, provider_id)
    if not provider:
        raise HTTPException(404, "Fornecedor não encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(provider, field, value)
    db.commit()
    db.refresh(provider)
    return provider


@router.delete("/{provider_id}", status_code=204)
def delete_provider(
    provider_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    provider = db.get(Provider, provider_id)
    if not provider:
        raise HTTPException(404, "Fornecedor não encontrado")
    db.delete(provider)
    db.commit()
