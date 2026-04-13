"""
Celery worker — 5 fluxos de automação do CRM Sítio Dom Pedro.

Fluxo 1: Novo lead — resposta WA <2min, notificação vendedor
Fluxo 2: Pré-evento — lembretes D-90, D-30, D-7, D-1 (WA + e-mail)
Fluxo 3: Pagamentos — cobranças D-5, D-1, D+0
Fluxo 4: Pós-evento — agradecimento D+1, NPS D+3, Google Review, aniversário M+11
Fluxo 5: Fornecedores — notificação D-30 (e-mail), D-7 (WA), D-1 (WA)
Fluxo 6: Nurturing — sequência por score (frio/morno)
"""

import asyncio
from datetime import date, timedelta

from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "crm_sitio",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.timezone = "America/Belem"
celery_app.conf.beat_schedule = {
    "check-pre-event-reminders": {
        "task": "app.worker.check_pre_event_reminders",
        "schedule": crontab(hour=8, minute=0),
    },
    "check-payment-reminders": {
        "task": "app.worker.check_payment_reminders",
        "schedule": crontab(hour=8, minute=30),
    },
    "check-post-event-actions": {
        "task": "app.worker.check_post_event_actions",
        "schedule": crontab(hour=9, minute=0),
    },
    "check-provider-notifications": {
        "task": "app.worker.check_provider_notifications",
        "schedule": crontab(hour=9, minute=30),
    },
    "check-lead-nurturing": {
        "task": "app.worker.check_lead_nurturing",
        "schedule": crontab(hour=10, minute=0),
    },
}


def _get_db():
    from app.database import SessionLocal
    return SessionLocal()


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _tpl(key: str, fallback: str, **kwargs) -> str:
    """Carrega template do banco e aplica as variáveis; usa fallback se não encontrado."""
    try:
        from app.models.message_template import MessageTemplate
        db = _get_db()
        try:
            tpl = (
                db.query(MessageTemplate)
                .filter(MessageTemplate.key == key, MessageTemplate.is_active == True)  # noqa: E712
                .first()
            )
            body = tpl.body if tpl else fallback
        finally:
            db.close()
    except Exception:
        body = fallback
    try:
        return body.format(**kwargs)
    except (KeyError, ValueError):
        return body


# ── Fluxo 1: Novo lead ────────────────────────────────────────────────────────


@celery_app.task
def handle_new_lead(lead_id: str):
    """Dispara resposta WA automática ao novo lead e notifica vendedor."""
    from app.models.lead import Lead
    from app.services.whatsapp import send_whatsapp_message
    from app.services.email import send_template_email

    db = _get_db()
    try:
        lead = db.get(Lead, lead_id)
        if not lead:
            return

        # WA imediato (<2min)
        msg = _tpl(
            "novo_lead_wa",
            "Olá {nome}! Obrigado pelo interesse no Sítio Dom Pedro. "
            "Vamos verificar a disponibilidade para a sua data e retornar em breve. "
            "Qualquer dúvida, estamos à disposição!",
            nome=lead.name,
        )
        _run_async(send_whatsapp_message(lead.phone, msg))

        # E-mail de boas-vindas (se e-mail disponível)
        if lead.email:
            data_str = (
                lead.event_date.strftime("%d/%m/%Y") if lead.event_date else "a confirmar"
            )
            _run_async(
                send_template_email(
                    lead.email,
                    "boas_vindas",
                    nome=lead.name,
                    data_evento=data_str,
                )
            )

        # Google Calendar: agendar visita se score >= 60
        if lead.score >= 60:
            _schedule_visit_on_google_cal(lead)

    finally:
        db.close()


def _schedule_visit_on_google_cal(lead) -> None:
    """Tenta criar evento de visita no Google Calendar — falha silenciosa."""
    from app.services.google_calendar import get_google_calendar_service
    from datetime import datetime, timedelta

    svc = get_google_calendar_service()
    if svc is None:
        return
    try:
        # Visita sugerida: próxima semana, 10h
        visit_start = datetime.now().replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=7)
        visit_end = visit_start + timedelta(hours=1)
        attendees = [lead.email] if lead.email else []
        svc.create_event(
            title=f"Visita: {lead.name} — Sítio Dom Pedro",
            start=visit_start,
            end=visit_end,
            description=f"Lead: {lead.name}\nTelefone: {lead.phone}\nTipo: {lead.event_type}\nScore: {lead.score}",
            attendees=attendees,
        )
    except Exception:
        pass


# ── Fluxo 2: Pré-evento ───────────────────────────────────────────────────────


@celery_app.task
def check_pre_event_reminders():
    """Verifica eventos próximos e envia lembretes D-90, D-30, D-7, D-1."""
    from app.models.event import Event, EventStatus
    from app.models.lead import Lead
    from app.services.whatsapp import send_whatsapp_message
    from app.services.email import send_template_email

    db = _get_db()
    try:
        today = date.today()
        events = db.query(Event).filter(Event.status == EventStatus.confirmado).all()

        reminder_keys = {
            90: ("pre_evento_d90", "Olá {nome}! Faltam 90 dias para o seu evento! Já é hora de confirmar os detalhes de planejamento."),
            30: ("pre_evento_d30", "Olá {nome}! Faltam 30 dias! Vamos confirmar fornecedores e detalhes finais?"),
            7:  ("pre_evento_d7",  "Olá {nome}! Faltam 7 dias! Confira as informações de acesso e horários."),
            1:  ("pre_evento_d1",  "Olá {nome}! Amanhã é o grande dia! Checklist final enviado. Estamos prontos!"),
        }

        for event in events:
            days_until = (event.date_start.date() - today).days
            if days_until not in reminder_keys:
                continue
            lead = db.get(Lead, event.lead_id)
            if not lead:
                continue

            tpl_key, tpl_fallback = reminder_keys[days_until]
            wa_msg = _tpl(tpl_key, tpl_fallback, nome=lead.name)
            _run_async(send_whatsapp_message(lead.phone, wa_msg))

            if lead.email:
                _run_async(
                    send_template_email(
                        lead.email,
                        "lembrete_pre_evento",
                        nome=lead.name,
                        mensagem=wa_msg,
                    )
                )
    finally:
        db.close()


# ── Fluxo 3: Pagamentos ───────────────────────────────────────────────────────


@celery_app.task
def check_payment_reminders():
    """Envia lembretes de pagamento D-5, D-1 e D+0."""
    from app.models.event import Event
    from app.models.lead import Lead
    from app.models.payment import Payment, PaymentStatus
    from app.services.whatsapp import send_whatsapp_message

    db = _get_db()
    try:
        today = date.today()
        pending = db.query(Payment).filter(Payment.status == PaymentStatus.pendente).all()

        for payment in pending:
            days_until = (payment.due_date - today).days
            event = db.get(Event, payment.event_id)
            if not event:
                continue
            lead = db.get(Lead, event.lead_id)
            if not lead:
                continue

            valor = f"{payment.amount:.2f}"
            pn = payment.installment_number
            pt = payment.installment_total
            if days_until == 5:
                msg = _tpl(
                    "pagamento_d5",
                    "Olá {nome}! Lembrete: parcela {parcela_numero}/{parcela_total} no valor de R${valor} vence em 5 dias.",
                    nome=lead.name, parcela_numero=pn, parcela_total=pt, valor=valor,
                )
            elif days_until == 1:
                msg = _tpl(
                    "pagamento_d1",
                    "Olá {nome}! Sua parcela de R${valor} vence amanhã. Enviaremos o link de pagamento em breve.",
                    nome=lead.name, valor=valor,
                )
            elif days_until == 0:
                msg = _tpl(
                    "pagamento_d0",
                    "Olá {nome}! Hoje vence a parcela de R${valor}. Efetue o pagamento para manter tudo em dia!",
                    nome=lead.name, valor=valor,
                )
            elif days_until < 0:
                payment.status = PaymentStatus.vencido
                db.commit()
                continue
            else:
                continue

            _run_async(send_whatsapp_message(lead.phone, msg))
    finally:
        db.close()


# ── Fluxo 4: Pós-evento ───────────────────────────────────────────────────────


@celery_app.task
def check_post_event_actions():
    """Ações pós-evento: agradecimento D+1, NPS D+3, aniversário M+11."""
    from app.models.event import Event, EventStatus
    from app.models.lead import Lead
    from app.services.whatsapp import send_whatsapp_message
    from app.services.email import send_template_email

    db = _get_db()
    try:
        today = date.today()
        realized = db.query(Event).filter(Event.status == EventStatus.realizado).all()

        for event in realized:
            days_since = (today - event.date_end.date()).days
            lead = db.get(Lead, event.lead_id)
            if not lead:
                continue

            if days_since == 1:
                msg = _tpl(
                    "pos_evento_d1",
                    "Olá {nome}! Esperamos que o evento de ontem tenha sido incrível! Obrigado por escolher o Sítio Dom Pedro.",
                    nome=lead.name,
                )
                _run_async(send_whatsapp_message(lead.phone, msg))

            elif days_since == 3:
                msg = _tpl(
                    "pos_evento_d3_nps",
                    "Olá {nome}! Gostaríamos de ouvir sua opinião. De 0 a 10, como foi sua experiência no Sítio Dom Pedro?",
                    nome=lead.name,
                )
                _run_async(send_whatsapp_message(lead.phone, msg))
                if lead.email:
                    _run_async(
                        send_template_email(lead.email, "pesquisa_nps", nome=lead.name)
                    )

            elif days_since == 335:  # ~11 meses
                msg = _tpl(
                    "pos_evento_m11",
                    "Olá {nome}! Faz quase um ano desde o seu evento aqui. Que tal celebrar novamente conosco?",
                    nome=lead.name,
                )
                _run_async(send_whatsapp_message(lead.phone, msg))
    finally:
        db.close()


# ── Fluxo 5: Fornecedores ─────────────────────────────────────────────────────


@celery_app.task
def check_provider_notifications():
    """Notifica fornecedores: D-30 (e-mail), D-7 (WA + horário), D-1 (WA lembrete)."""
    from app.models.event import Event, EventProvider, EventStatus
    from app.models.provider import Provider
    from app.services.whatsapp import send_whatsapp_message
    from app.services.email import send_template_email

    db = _get_db()
    try:
        today = date.today()
        events = db.query(Event).filter(Event.status == EventStatus.confirmado).all()

        for event in events:
            days_until = (event.date_start.date() - today).days
            if days_until not in (30, 7, 1):
                continue

            event_providers = (
                db.query(EventProvider)
                .filter(EventProvider.event_id == event.id)
                .all()
            )

            for ep in event_providers:
                provider = db.get(Provider, ep.provider_id)
                if not provider:
                    continue

                data_fmt = event.date_start.strftime("%d/%m/%Y")
                hora_fmt = event.date_start.strftime("%H:%M")

                if days_until == 30:
                    # D-30: e-mail de confirmação
                    if provider.email:
                        _run_async(
                            send_template_email(
                                provider.email,
                                "confirmacao_fornecedor",
                                nome=provider.name,
                                evento=event.title,
                                data=data_fmt,
                            )
                        )
                    # WA como backup se não tiver e-mail
                    elif provider.whatsapp:
                        msg = _tpl(
                            "fornecedor_d30",
                            "Olá {nome}! Confirmação: evento '{evento}' em 30 dias ({data}). Favor confirmar participação.",
                            nome=provider.name, evento=event.title, data=data_fmt,
                        )
                        _run_async(send_whatsapp_message(provider.whatsapp, msg))

                elif days_until == 7 and provider.whatsapp:
                    msg = _tpl(
                        "fornecedor_d7",
                        "Olá {nome}! Evento '{evento}' em 7 dias. Horário de chegada: {horario}. Instruções de acesso serão enviadas.",
                        nome=provider.name, evento=event.title, horario=hora_fmt,
                    )
                    _run_async(send_whatsapp_message(provider.whatsapp, msg))

                elif days_until == 1 and provider.whatsapp:
                    msg = _tpl(
                        "fornecedor_d1",
                        "Olá {nome}! Lembrete: amanhã evento '{evento}'. Chegada: {horario}.",
                        nome=provider.name, evento=event.title, horario=hora_fmt,
                    )
                    _run_async(send_whatsapp_message(provider.whatsapp, msg))
    finally:
        db.close()


# ── Fluxo 6: Nurturing por score ──────────────────────────────────────────────


@celery_app.task
def check_lead_nurturing():
    """
    Nurturing automático por score:
    - Frio (<30): e-mail mensal (a cada 30 dias desde criação)
    - Morno (30-59): WA a cada 15 dias
    """
    from app.models.lead import Lead, FunnelStage
    from app.services.whatsapp import send_whatsapp_message
    from app.services.email import send_template_email

    db = _get_db()
    try:
        today = date.today()

        # Apenas leads que ainda não converteram (estágios iniciais)
        active_stages = [FunnelStage.lead, FunnelStage.visita_agendada]
        leads = (
            db.query(Lead)
            .filter(Lead.funnel_stage.in_(active_stages))
            .all()
        )

        for lead in leads:
            days_since = (today - lead.created_at.date()).days

            if lead.score < 30:
                # Frio: e-mail a cada 30 dias
                if days_since > 0 and days_since % 30 == 0 and lead.email:
                    _run_async(
                        send_template_email(
                            lead.email,
                            "nurturing_frio",
                            nome=lead.name,
                        )
                    )

            elif lead.score < 60:
                # Morno: WA a cada 15 dias
                if days_since > 0 and days_since % 15 == 0:
                    msg = _tpl(
                        "nurturing_morno",
                        "Olá {nome}! Ainda temos datas disponíveis no Sítio Dom Pedro. Posso te enviar mais informações ou agendar uma visita?",
                        nome=lead.name,
                    )
                    _run_async(send_whatsapp_message(lead.phone, msg))
    finally:
        db.close()
