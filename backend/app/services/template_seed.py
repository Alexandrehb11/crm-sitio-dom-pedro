"""
Templates de mensagem padrão — compartilhado entre migration e startup seed.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

DEFAULT_TEMPLATES = [
    # ── Respostas automáticas via webhook ──────────────────────────────────
    {
        "key": "webhook_boas_vindas",
        "title": "Boas-vindas — Novo contato WhatsApp",
        "body": (
            "Olá {nome}! 👋 Seja bem-vindo(a) ao *Sítio Dom Pedro*. "
            "Ficamos felizes com seu contato!\n\n"
            "Vamos verificar a disponibilidade para o seu evento e retornar em breve. "
            "Enquanto isso, pode nos contar um pouco mais sobre o que você está planejando? 😊"
        ),
        "flow": "webhook",
        "trigger": "Recebimento de mensagem WhatsApp (número novo)",
        "channel": "whatsapp",
        "variables": '["nome"]',
    },
    {
        "key": "webhook_visita_confirmada",
        "title": "Confirmação de visita",
        "body": "Perfeito, {nome}! Visita confirmada. Até lá! 😊",
        "flow": "webhook",
        "trigger": "Lead responde 'sim/confirmo/ok' com visita agendada",
        "channel": "whatsapp",
        "variables": '["nome"]',
    },
    {
        "key": "webhook_cancelamento",
        "title": "Resposta a cancelamento",
        "body": "Entendido, {nome}. Se mudar de ideia, estaremos aqui! 🤝",
        "flow": "webhook",
        "trigger": "Lead responde 'cancelar/desistir/não quero'",
        "channel": "whatsapp",
        "variables": '["nome"]',
    },
    {
        "key": "webhook_consulta_preco",
        "title": "Consulta de preço/orçamento",
        "body": (
            "Olá {nome}! Para passar uma proposta personalizada, "
            "precisamos de alguns detalhes sobre o seu evento. "
            "Nossa equipe entrará em contato em breve! 📋"
        ),
        "flow": "webhook",
        "trigger": "Lead pergunta sobre preço/valor/orçamento",
        "channel": "whatsapp",
        "variables": '["nome"]',
    },
    # ── Fluxo 1: Novo lead ─────────────────────────────────────────────────
    {
        "key": "novo_lead_wa",
        "title": "Novo lead — Boas-vindas automática",
        "body": (
            "Olá {nome}! Obrigado pelo interesse no Sítio Dom Pedro. "
            "Vamos verificar a disponibilidade para a sua data e retornar em breve. "
            "Qualquer dúvida, estamos à disposição!"
        ),
        "flow": "novo_lead",
        "trigger": "Imediato após criação do lead (<2 min)",
        "channel": "whatsapp",
        "variables": '["nome"]',
    },
    # ── Fluxo 2: Pré-evento ────────────────────────────────────────────────
    {
        "key": "pre_evento_d90",
        "title": "Pré-evento — 90 dias",
        "body": "Olá {nome}! Faltam 90 dias para o seu evento! Já é hora de confirmar os detalhes de planejamento.",
        "flow": "pre_evento",
        "trigger": "D-90 antes do evento",
        "channel": "whatsapp",
        "variables": '["nome"]',
    },
    {
        "key": "pre_evento_d30",
        "title": "Pré-evento — 30 dias",
        "body": "Olá {nome}! Faltam 30 dias! Vamos confirmar fornecedores e detalhes finais?",
        "flow": "pre_evento",
        "trigger": "D-30 antes do evento",
        "channel": "whatsapp",
        "variables": '["nome"]',
    },
    {
        "key": "pre_evento_d7",
        "title": "Pré-evento — 7 dias",
        "body": "Olá {nome}! Faltam 7 dias! Confira as informações de acesso e horários.",
        "flow": "pre_evento",
        "trigger": "D-7 antes do evento",
        "channel": "whatsapp",
        "variables": '["nome"]',
    },
    {
        "key": "pre_evento_d1",
        "title": "Pré-evento — 1 dia",
        "body": "Olá {nome}! Amanhã é o grande dia! Checklist final enviado. Estamos prontos!",
        "flow": "pre_evento",
        "trigger": "D-1 antes do evento",
        "channel": "whatsapp",
        "variables": '["nome"]',
    },
    # ── Fluxo 3: Pagamentos ────────────────────────────────────────────────
    {
        "key": "pagamento_d5",
        "title": "Pagamento — Lembrete 5 dias",
        "body": (
            "Olá {nome}! Lembrete: parcela {parcela_numero}/{parcela_total} "
            "no valor de R${valor} vence em 5 dias."
        ),
        "flow": "pagamento",
        "trigger": "D-5 antes do vencimento",
        "channel": "whatsapp",
        "variables": '["nome", "parcela_numero", "parcela_total", "valor"]',
    },
    {
        "key": "pagamento_d1",
        "title": "Pagamento — Lembrete 1 dia",
        "body": (
            "Olá {nome}! Sua parcela de R${valor} vence amanhã. "
            "Enviaremos o link de pagamento em breve."
        ),
        "flow": "pagamento",
        "trigger": "D-1 antes do vencimento",
        "channel": "whatsapp",
        "variables": '["nome", "valor"]',
    },
    {
        "key": "pagamento_d0",
        "title": "Pagamento — Dia do vencimento",
        "body": (
            "Olá {nome}! Hoje vence a parcela de R${valor}. "
            "Efetue o pagamento para manter tudo em dia!"
        ),
        "flow": "pagamento",
        "trigger": "D+0 (dia do vencimento)",
        "channel": "whatsapp",
        "variables": '["nome", "valor"]',
    },
    {
        "key": "pagamento_confirmado",
        "title": "Pagamento — Confirmação de recebimento",
        "body": (
            "Olá {nome}! Recebemos o seu pagamento de R${valor} "
            "(parcela {parcela_numero}/{parcela_total}). Obrigado!"
        ),
        "flow": "pagamento",
        "trigger": "Webhook Asaas: pagamento recebido",
        "channel": "whatsapp",
        "variables": '["nome", "valor", "parcela_numero", "parcela_total"]',
    },
    # ── Fluxo 4: Pós-evento ────────────────────────────────────────────────
    {
        "key": "pos_evento_d1",
        "title": "Pós-evento — Agradecimento",
        "body": (
            "Olá {nome}! Esperamos que o evento de ontem tenha sido incrível! "
            "Obrigado por escolher o Sítio Dom Pedro."
        ),
        "flow": "pos_evento",
        "trigger": "D+1 após o evento",
        "channel": "whatsapp",
        "variables": '["nome"]',
    },
    {
        "key": "pos_evento_d3_nps",
        "title": "Pós-evento — Pesquisa NPS",
        "body": (
            "Olá {nome}! Gostaríamos de ouvir sua opinião. "
            "De 0 a 10, como foi sua experiência no Sítio Dom Pedro?"
        ),
        "flow": "pos_evento",
        "trigger": "D+3 após o evento",
        "channel": "whatsapp",
        "variables": '["nome"]',
    },
    {
        "key": "pos_evento_m11",
        "title": "Pós-evento — Aniversário (11 meses)",
        "body": (
            "Olá {nome}! Faz quase um ano desde o seu evento aqui. "
            "Que tal celebrar novamente conosco?"
        ),
        "flow": "pos_evento",
        "trigger": "~11 meses após o evento",
        "channel": "whatsapp",
        "variables": '["nome"]',
    },
    # ── Fluxo 5: Fornecedores ──────────────────────────────────────────────
    {
        "key": "fornecedor_d30",
        "title": "Fornecedor — Confirmação 30 dias",
        "body": (
            "Olá {nome}! Confirmação: evento '{evento}' em 30 dias ({data}). "
            "Favor confirmar participação."
        ),
        "flow": "fornecedor",
        "trigger": "D-30 antes do evento (sem e-mail cadastrado)",
        "channel": "whatsapp",
        "variables": '["nome", "evento", "data"]',
    },
    {
        "key": "fornecedor_d7",
        "title": "Fornecedor — Aviso 7 dias",
        "body": (
            "Olá {nome}! Evento '{evento}' em 7 dias. "
            "Horário de chegada: {horario}. Instruções de acesso serão enviadas."
        ),
        "flow": "fornecedor",
        "trigger": "D-7 antes do evento",
        "channel": "whatsapp",
        "variables": '["nome", "evento", "horario"]',
    },
    {
        "key": "fornecedor_d1",
        "title": "Fornecedor — Lembrete 1 dia",
        "body": "Olá {nome}! Lembrete: amanhã evento '{evento}'. Chegada: {horario}.",
        "flow": "fornecedor",
        "trigger": "D-1 antes do evento",
        "channel": "whatsapp",
        "variables": '["nome", "evento", "horario"]',
    },
    # ── Fluxo 6: Nurturing ─────────────────────────────────────────────────
    {
        "key": "nurturing_morno",
        "title": "Nurturing — Lead morno (a cada 15 dias)",
        "body": (
            "Olá {nome}! Ainda temos datas disponíveis no Sítio Dom Pedro. "
            "Posso te enviar mais informações ou agendar uma visita?"
        ),
        "flow": "nurturing",
        "trigger": "A cada 15 dias (leads com score 30–59)",
        "channel": "whatsapp",
        "variables": '["nome"]',
    },
]


def seed_message_templates() -> None:
    """
    Insere os templates padrão se a tabela existir e estiver vazia.
    Chamada silenciosa — ignora erros (tabela inexistente, etc.).
    """
    try:
        from app.database import SessionLocal
        from app.models.message_template import MessageTemplate

        db = SessionLocal()
        try:
            if db.query(MessageTemplate).count() > 0:
                return
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            for t in DEFAULT_TEMPLATES:
                db.add(
                    MessageTemplate(
                        id=str(uuid.uuid4()),
                        is_active=True,
                        updated_at=now,
                        **t,
                    )
                )
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
    except Exception:
        pass
