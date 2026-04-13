from __future__ import annotations

import base64
import mimetypes

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, selectinload

from app.core.security import get_current_user
from app.database import get_db
from app.models.contract import Contract, ContractStatus
from app.schemas.contract import ContractCreate, ContractOut, ContractUpdate

router = APIRouter()

# Tamanho máximo do PDF: 15 MB
_MAX_PDF_BYTES = 15 * 1024 * 1024


def _get_with_event(db: Session, contract_id: str) -> Contract:
    """Busca contrato com relacionamento `event` carregado."""
    contract = (
        db.query(Contract)
        .options(selectinload(Contract.event))
        .filter(Contract.id == contract_id)
        .first()
    )
    if not contract:
        raise HTTPException(404, "Contrato não encontrado")
    return contract


@router.get("/", response_model=list[ContractOut])
def list_contracts(
    event_id: str | None = None,
    status: ContractStatus | None = None,
    search: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Contract).options(selectinload(Contract.event))
    if event_id:
        q = q.filter(Contract.event_id == event_id)
    if status:
        q = q.filter(Contract.status == status)
    if search:
        term = f"%{search}%"
        q = q.filter(
            Contract.client_name.ilike(term) | Contract.client_phone.ilike(term)
        )
    return q.order_by(Contract.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{contract_id}", response_model=ContractOut)
def get_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return _get_with_event(db, contract_id)


@router.post("/", response_model=ContractOut, status_code=201)
def create_contract(
    data: ContractCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    contract = Contract(**data.model_dump())
    db.add(contract)
    db.commit()
    # Busca novamente com o evento carregado para preencher event_title
    return _get_with_event(db, contract.id)


@router.patch("/{contract_id}", response_model=ContractOut)
def update_contract(
    contract_id: str,
    data: ContractUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    contract = _get_with_event(db, contract_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contract, field, value)
    db.commit()
    db.refresh(contract)
    return _get_with_event(db, contract_id)


@router.delete("/{contract_id}", status_code=204)
def delete_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contrato não encontrado")
    db.delete(contract)
    db.commit()


# ── Anexar PDF ──────────────────────────────────────────────────────────────

@router.post("/{contract_id}/attach-pdf", response_model=ContractOut)
async def attach_pdf(
    contract_id: str,
    file: UploadFile = File(..., description="Arquivo PDF do modelo de contrato"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Faz upload do PDF do modelo de contrato e armazena em base64 no banco.
    Máximo 15 MB. Aceita somente arquivos PDF.
    """
    # Validação do tipo
    content_type = file.content_type or ""
    filename = file.filename or ""
    if "pdf" not in content_type.lower() and not filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Apenas arquivos PDF são aceitos")

    content = await file.read()
    if len(content) > _MAX_PDF_BYTES:
        raise HTTPException(400, f"Arquivo muito grande. Máximo: {_MAX_PDF_BYTES // 1024 // 1024} MB")
    if len(content) < 4 or content[:4] != b"%PDF":
        raise HTTPException(400, "Arquivo inválido — não é um PDF válido")

    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contrato não encontrado")

    contract.pdf_template_base64 = base64.b64encode(content).decode("ascii")
    db.commit()
    return _get_with_event(db, contract_id)


@router.delete("/{contract_id}/attach-pdf", response_model=ContractOut)
def remove_pdf(
    contract_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Remove o PDF anexado ao contrato."""
    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contrato não encontrado")
    contract.pdf_template_base64 = None
    db.commit()
    return _get_with_event(db, contract_id)


@router.get("/{contract_id}/template-pdf")
def download_pdf(
    contract_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Retorna o PDF do modelo de contrato para visualização / download."""
    from fastapi.responses import Response

    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contrato não encontrado")
    if not contract.pdf_template_base64:
        raise HTTPException(404, "Nenhum PDF anexado a este contrato")

    pdf_bytes = base64.b64decode(contract.pdf_template_base64)
    safe_name = (contract.client_name or "contrato").replace(" ", "_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{safe_name}.pdf"'
        },
    )


# ── Envio via ZapSign ────────────────────────────────────────────────────────

@router.post("/{contract_id}/send", response_model=ContractOut)
async def send_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Envia o contrato para assinatura via ZapSign.

    Requer:
      - PDF anexado (endpoint /attach-pdf)
      - client_name e client_phone preenchidos

    O signatário usa os dados do próprio contrato (client_name / client_phone)
    e o e-mail do lead vinculado ao evento (se disponível).
    """
    from app.models.event import Event
    from app.models.lead import Lead
    from app.services.zapsign import create_document

    contract = db.get(Contract, contract_id)
    if not contract:
        raise HTTPException(404, "Contrato não encontrado")
    if contract.zapsign_id:
        raise HTTPException(409, "Contrato já enviado para assinatura (zapsign_id já preenchido)")
    if contract.status == ContractStatus.assinado:
        raise HTTPException(400, "Contrato já está assinado")
    if not contract.pdf_template_base64:
        raise HTTPException(
            400,
            "Nenhum PDF anexado. Faça upload do modelo de contrato antes de enviar."
        )
    if not contract.client_name or not contract.client_phone:
        raise HTTPException(
            400,
            "Nome e telefone do signatário são obrigatórios para envio."
        )

    # E-mail do lead (opcional — usado apenas para envio por e-mail pelo ZapSign)
    lead_email: str = ""
    event = db.get(Event, contract.event_id)
    if event:
        lead = db.get(Lead, event.lead_id)
        if lead and lead.email:
            lead_email = lead.email

    signers = [
        {
            "name": contract.client_name,
            "email": lead_email,
            "phone_country": "55",
            "phone_number": contract.client_phone.replace("+55", "").replace(" ", "").replace("-", ""),
            "send_automatic_whatsapp": True,
        }
    ]

    try:
        doc = await create_document(
            name=f"Contrato — {contract.template_type}",
            signers=signers,
            pdf_base64=contract.pdf_template_base64,
        )
        contract.zapsign_id = doc.get("open_id") or doc.get("token")
        db.commit()
    except Exception as exc:
        raise HTTPException(502, f"Erro ao criar documento no ZapSign: {exc}")

    return _get_with_event(db, contract_id)
