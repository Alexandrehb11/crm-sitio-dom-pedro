"""
Endpoints de webhook para Asaas, ZapSign e WhatsApp (Evolution/Z-API).

• POST /api/webhooks/asaas     — confirmação de pagamento
• POST /api/webhooks/zapsign   — contrato assinado
• POST /api/webhooks/whatsapp  — mensagem recebida → cria lead automaticamente
• POST /api/webhooks/register  — registra webhook na Evolution API (admin only)
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import require_admin
from app.database import get_db
from app.models.contract import Contract, ContractStatus
from app.models.lead import FunnelStage, Lead, SourceChannel
from app.models.payment import Payment, PaymentStatus

logger = logging.getLogger(__name__)
router = APIRouter()


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _clean_phone(raw: str) -> str:
    """Remove @s.whatsapp.net e caracteres não numéricos."""
    phone = raw.split("@")[0].strip()
    return re.sub(r"\D", "", phone)


def _find_lead_by_phone(db: Session, phone: str) -> Lead | None:
    """Busca lead por telefone, tentando com e sem DDI 55."""
    lead = db.query(Lead).filter(Lead.phone == phone).first()
    if lead:
        return lead
    # Tenta sem o DDI internacional (55)
    if phone.startswith("55") and len(phone) > 10:
        stripped = phone[2:]
        lead = db.query(Lead).filter(Lead.phone == stripped).first()
    elif len(phone) <= 11:
        with_ddi = "55" + phone
        lead = db.query(Lead).filter(Lead.phone == with_ddi).first()
    return lead


def _create_lead_from_whatsapp(db: Session, phone: str, name: str) -> Lead:
    """Cria um novo lead a partir de uma mensagem WhatsApp recebida."""
    from app.services.lead_scoring import calculate_score

    lead = Lead(
        name=name or phone,
        phone=phone,
        source_channel=SourceChannel.whatsapp,
        funnel_stage=FunnelStage.lead,
        consent_lgpd=False,
    )
    lead.score = calculate_score(lead)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    logger.info("Lead criado via WhatsApp: %s (%s)", lead.name, lead.phone)
    return lead


# ──────────────────────────────────────────────
# Asaas — confirmação de pagamento
# ──────────────────────────────────────────────

@router.post("/asaas", status_code=status.HTTP_200_OK)
async def asaas_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    event_type: str = body.get("event", "")
    payment_data: dict = body.get("payment", {})
    asaas_id: str = payment_data.get("id", "")

    if not asaas_id:
        raise HTTPException(400, "Webhook inválido: campo 'payment.id' ausente")

    payment: Payment | None = (
        db.query(Payment).filter(Payment.asaas_id == asaas_id).first()
    )
    if not payment:
        logger.warning("Asaas webhook: asaas_id=%s não encontrado no CRM", asaas_id)
        return {"ok": True}

    if event_type == "PAYMENT_RECEIVED":
        payment.status = PaymentStatus.pago
        payment.confirmed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()
        logger.info("Pagamento %s confirmado (asaas_id=%s)", payment.id, asaas_id)

        try:
            from app.models.event import Event
            from app.models.message_template import MessageTemplate
            from app.services.whatsapp import send_whatsapp_message

            event = db.get(Event, payment.event_id)
            if event:
                lead = db.get(Lead, event.lead_id)
                if lead:
                    tpl = db.query(MessageTemplate).filter(
                        MessageTemplate.key == "pagamento_confirmado",
                        MessageTemplate.is_active == True,  # noqa: E712
                    ).first()
                    body = tpl.body if tpl else (
                        "Olá {nome}! Recebemos o seu pagamento de R${valor} "
                        "(parcela {parcela_numero}/{parcela_total}). Obrigado!"
                    )
                    try:
                        msg = body.format(
                            nome=lead.name,
                            valor=f"{payment.amount:.2f}",
                            parcela_numero=payment.installment_number,
                            parcela_total=payment.installment_total,
                        )
                    except (KeyError, ValueError):
                        msg = body
                    await send_whatsapp_message(lead.phone, msg)
        except Exception as exc:
            logger.error("Erro ao enviar WA de confirmação de pagamento: %s", exc)

    elif event_type == "PAYMENT_OVERDUE":
        payment.status = PaymentStatus.vencido
        db.commit()

    elif event_type in ("PAYMENT_DELETED", "PAYMENT_REFUNDED"):
        payment.status = PaymentStatus.cancelado
        db.commit()

    return {"ok": True}


# ──────────────────────────────────────────────
# ZapSign — contrato assinado
# ──────────────────────────────────────────────

@router.post("/zapsign", status_code=status.HTTP_200_OK)
async def zapsign_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    event_type: str = body.get("event_type", "")
    doc_data: dict = body.get("document", {})
    zapsign_id: str = doc_data.get("open_id", "")

    if not zapsign_id:
        raise HTTPException(400, "Webhook inválido: campo 'document.open_id' ausente")

    contract: Contract | None = (
        db.query(Contract).filter(Contract.zapsign_id == zapsign_id).first()
    )
    if not contract:
        logger.warning("ZapSign webhook: zapsign_id=%s não encontrado no CRM", zapsign_id)
        return {"ok": True}

    if event_type == "finished":
        signers = doc_data.get("signers", [])
        signed_by = ", ".join(s.get("name", "") for s in signers if s.get("name"))
        contract.status = ContractStatus.assinado
        contract.signed_by = signed_by or None
        contract.signed_date = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()
        logger.info("Contrato %s assinado (zapsign_id=%s)", contract.id, zapsign_id)

        try:
            from app.models.event import Event

            event = db.get(Event, contract.event_id)
            if event:
                lead = db.get(Lead, event.lead_id)
                if lead and lead.funnel_stage not in (
                    FunnelStage.contrato_assinado,
                    FunnelStage.evento_realizado,
                ):
                    lead.funnel_stage = FunnelStage.contrato_assinado
                    from app.services.lead_scoring import calculate_score
                    lead.score = calculate_score(lead)
                    db.commit()
        except Exception as exc:
            logger.error("Erro ao avançar funil após assinatura: %s", exc)

    elif event_type in ("refused", "canceled"):
        contract.status = ContractStatus.cancelado
        db.commit()

    return {"ok": True}


# ──────────────────────────────────────────────
# WhatsApp — mensagem recebida → cria lead
# ──────────────────────────────────────────────

@router.post("/whatsapp", status_code=status.HTTP_200_OK)
async def whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Recebe mensagens de entrada via Evolution API.
    - Se o número já for lead: responde automaticamente conforme o estágio do funil.
    - Se for número novo: cria lead automaticamente e envia boas-vindas.
    """
    body = await request.json()

    # Ignora eventos que não são mensagens recebidas
    event = body.get("event", "")
    if event and event not in ("messages.upsert", "message"):
        return {"ok": True}

    data = body.get("data", {})

    # Ignora mensagens enviadas pelo próprio bot
    from_me = data.get("key", {}).get("fromMe", False)
    if from_me:
        return {"ok": True}

    # Extrai telefone e nome
    raw_phone = (
        data.get("key", {}).get("remoteJid", "")
        or body.get("phone", "")
    )
    phone = _clean_phone(raw_phone)

    # Ignora grupos (jid de grupo tem @g.us)
    if "g.us" in raw_phone or not phone:
        return {"ok": True}

    push_name: str = data.get("pushName", "") or body.get("pushName", "") or ""

    text: str = (
        data.get("message", {}).get("conversation", "")
        or data.get("message", {}).get("extendedTextMessage", {}).get("text", "")
        or body.get("text", {}).get("message", "")
        or ""
    )

    # Busca ou cria lead
    lead = _find_lead_by_phone(db, phone)
    is_new = lead is None

    if is_new:
        lead = _create_lead_from_whatsapp(db, phone, push_name)

    # Resposta automática
    from app.services.whatsapp import send_whatsapp_message

    def _get_tpl(key: str, fallback: str, **kwargs) -> str:
        try:
            from app.models.message_template import MessageTemplate as MT
            tpl = db.query(MT).filter(MT.key == key, MT.is_active == True).first()  # noqa: E712
            text_body = tpl.body if tpl else fallback
        except Exception:
            text_body = fallback
        try:
            return text_body.format(**kwargs)
        except (KeyError, ValueError):
            return text_body

    try:
        if is_new:
            # Boas-vindas para lead novo
            msg = _get_tpl(
                "webhook_boas_vindas",
                "Olá {nome}! 👋 Seja bem-vindo(a) ao *Sítio Dom Pedro*. Ficamos felizes com seu contato!\n\n"
                "Vamos verificar a disponibilidade para o seu evento e retornar em breve. "
                "Enquanto isso, pode nos contar um pouco mais sobre o que você está planejando? 😊",
                nome=push_name or "",
            )
            await send_whatsapp_message(phone, msg)

            # Dispara scoring e automação via Celery se disponível
            try:
                from app.worker import handle_new_lead
                handle_new_lead.apply_async(args=[lead.id], countdown=10)
            except Exception:
                pass

        else:
            # Lead existente — responde conforme contexto
            lower = (text or "").lower()

            if any(w in lower for w in ("sim", "confirmo", "ok", "confirmar", "quero")):
                if lead.funnel_stage == FunnelStage.visita_agendada:
                    msg = _get_tpl(
                        "webhook_visita_confirmada",
                        "Perfeito, {nome}! Visita confirmada. Até lá! 😊",
                        nome=lead.name,
                    )
                    await send_whatsapp_message(phone, msg)

            elif any(w in lower for w in ("cancelar", "desistir", "não quero", "nao quero")):
                msg = _get_tpl(
                    "webhook_cancelamento",
                    "Entendido, {nome}. Se mudar de ideia, estaremos aqui! 🤝",
                    nome=lead.name,
                )
                await send_whatsapp_message(phone, msg)

            elif any(w in lower for w in ("preço", "preco", "valor", "quanto", "orçamento", "orcamento")):
                msg = _get_tpl(
                    "webhook_consulta_preco",
                    "Olá {nome}! Para passar uma proposta personalizada, "
                    "precisamos de alguns detalhes sobre o seu evento. "
                    "Nossa equipe entrará em contato em breve! 📋",
                    nome=lead.name,
                )
                await send_whatsapp_message(phone, msg)

    except Exception as exc:
        logger.error("Erro ao enviar resposta WA: %s", exc)

    return {"ok": True}


# ──────────────────────────────────────────────
# Registrar webhook na Evolution API
# ──────────────────────────────────────────────

class WebhookRegisterRequest(BaseModel):
    webhook_url: str  # URL pública do backend, ex: https://meudominio.com


@router.post("/register", status_code=status.HTTP_200_OK)
async def register_evolution_webhook(
    data: WebhookRegisterRequest,
    _=Depends(require_admin),
):
    """
    Registra o webhook do CRM na instância Evolution API configurada.
    Chame este endpoint uma vez após configurar a URL pública do backend.
    """
    if not settings.evolution_api_url or not settings.evolution_api_key:
        raise HTTPException(400, "Evolution API não configurada. Defina EVOLUTION_API_URL e EVOLUTION_API_KEY.")

    webhook_endpoint = f"{data.webhook_url.rstrip('/')}/api/webhooks/whatsapp"

    url = (
        f"{settings.evolution_api_url.rstrip('/')}/"
        f"webhook/set/{settings.evolution_instance}"
    )
    headers = {"apikey": settings.evolution_api_key}
    payload = {
        "webhook": {
            "enabled": True,
            "url": webhook_endpoint,
            "webhook_by_events": False,
            "webhook_base64": False,
            "events": [
                "MESSAGES_UPSERT",
                "MESSAGES_UPDATE",
            ],
        }
    }

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            return {"ok": True, "webhook_url": webhook_endpoint, "evolution_response": resp.json()}
        except httpx.HTTPStatusError as exc:
            raise HTTPException(502, f"Evolution API retornou erro: {exc.response.text}")
        except Exception as exc:
            raise HTTPException(502, f"Erro ao contatar Evolution API: {exc}")
