from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.payment import Payment, PaymentStatus
from app.schemas.payment import PaymentCreate, PaymentOut, PaymentUpdate

router = APIRouter()


@router.get("/", response_model=list[PaymentOut])
def list_payments(
    event_id: str | None = None,
    status: PaymentStatus | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Payment)
    if event_id:
        q = q.filter(Payment.event_id == event_id)
    if status:
        q = q.filter(Payment.status == status)
    return q.order_by(Payment.due_date).offset(skip).limit(limit).all()


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(payment_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(404, "Pagamento não encontrado")
    return payment


@router.post("/", response_model=PaymentOut, status_code=201)
def create_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    if data.installment_number > data.installment_total:
        raise HTTPException(400, "Número da parcela não pode exceder o total")
    payment = Payment(**data.model_dump())
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.patch("/{payment_id}", response_model=PaymentOut)
def update_payment(
    payment_id: str,
    data: PaymentUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(404, "Pagamento não encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(payment, field, value)
    db.commit()
    db.refresh(payment)
    return payment


@router.delete("/{payment_id}", status_code=204)
def delete_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(404, "Pagamento não encontrado")
    db.delete(payment)
    db.commit()


# ── Integração Asaas ──

@router.post("/{payment_id}/charge", response_model=PaymentOut)
async def charge_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Cria a cobrança no Asaas para o pagamento e salva o asaas_id.
    Retorna o link de pagamento em `asaas_invoice_url` (no campo notes do response).
    """
    from app.models.event import Event
    from app.models.lead import Lead
    from app.services.asaas import create_charge, get_or_create_customer, get_payment_link

    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(404, "Pagamento não encontrado")
    if payment.asaas_id:
        raise HTTPException(409, "Cobrança já gerada para este pagamento (asaas_id já preenchido)")
    if payment.status != PaymentStatus.pendente:
        raise HTTPException(400, f"Pagamento com status '{payment.status}' não pode ser cobrado")

    event = db.get(Event, payment.event_id)
    if not event:
        raise HTTPException(404, "Evento vinculado não encontrado")
    lead = db.get(Lead, event.lead_id)
    if not lead:
        raise HTTPException(404, "Lead vinculado não encontrado")

    try:
        customer_id = await get_or_create_customer(
            name=lead.name,
            phone=lead.phone,
            email=lead.email,
        )
        description = (
            f"Sítio Dom Pedro — {event.title} "
            f"(parcela {payment.installment_number}/{payment.installment_total})"
        )
        charge = await create_charge(
            customer_id=customer_id,
            value=payment.amount,
            due_date=payment.due_date.strftime("%Y-%m-%d"),
            method=payment.method,
            description=description,
        )
        payment.asaas_id = charge["id"]
        db.commit()
        db.refresh(payment)

        # Envia link de pagamento via WhatsApp
        try:
            invoice_url = await get_payment_link(payment.asaas_id)
            if invoice_url:
                from app.services.whatsapp import send_whatsapp_message

                msg = (
                    f"Olá {lead.name}! Segue o link para pagamento da parcela "
                    f"{payment.installment_number}/{payment.installment_total} "
                    f"de R${payment.amount:.2f}: {invoice_url}"
                )
                await send_whatsapp_message(lead.phone, msg)
        except Exception:
            pass  # Falha no WA não deve reverter a cobrança

    except Exception as exc:
        raise HTTPException(502, f"Erro ao criar cobrança no Asaas: {exc}")

    return payment
