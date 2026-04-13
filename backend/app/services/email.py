"""
Serviço de e-mail transacional — SendGrid (preferencial) ou SMTP fallback.

Uso:
    from app.services.email import send_email
    await send_email(to="cliente@email.com", subject="Assunto", html="<p>Corpo</p>")
"""

from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ── Templates Jinja-style simples (sem dependência extra) ──────────────────────

def _render(template: str, **kwargs: str) -> str:
    """Substitui {{chave}} no template pelos valores fornecidos."""
    for key, value in kwargs.items():
        template = template.replace("{{" + key + "}}", value)
    return template


TEMPLATES: dict[str, dict[str, str]] = {
    "boas_vindas": {
        "subject": "Bem-vindo ao Sítio Dom Pedro!",
        "html": """
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#2d6a4f">Olá, {{nome}}!</h2>
  <p>Obrigado pelo interesse no <strong>Sítio Dom Pedro</strong>.</p>
  <p>Recebemos sua consulta para o dia <strong>{{data_evento}}</strong>.
     Nossa equipe entrará em contato em breve para confirmar disponibilidade.</p>
  <p style="color:#888;font-size:12px">Sítio Dom Pedro — Eventos Especiais</p>
</div>""",
    },
    "lembrete_pre_evento": {
        "subject": "Lembrete: seu evento se aproxima — Sítio Dom Pedro",
        "html": """
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#2d6a4f">Olá, {{nome}}!</h2>
  <p>{{mensagem}}</p>
  <p>Em caso de dúvidas, entre em contato conosco pelo WhatsApp.</p>
  <p style="color:#888;font-size:12px">Sítio Dom Pedro — Eventos Especiais</p>
</div>""",
    },
    "confirmacao_fornecedor": {
        "subject": "Confirmação de evento — Sítio Dom Pedro",
        "html": """
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#2d6a4f">Olá, {{nome}}!</h2>
  <p>Confirmamos sua participação no evento <strong>{{evento}}</strong>
     em <strong>{{data}}</strong>.</p>
  <p>Por favor confirme o recebimento respondendo este e-mail.</p>
  <p style="color:#888;font-size:12px">Sítio Dom Pedro — Eventos Especiais</p>
</div>""",
    },
    "pesquisa_nps": {
        "subject": "Como foi seu evento? — Sítio Dom Pedro",
        "html": """
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#2d6a4f">Olá, {{nome}}!</h2>
  <p>Esperamos que seu evento tenha sido incrível!</p>
  <p>De 0 a 10, como você avalia sua experiência no Sítio Dom Pedro?</p>
  <p>Sua opinião é muito importante para nós.</p>
  <p style="color:#888;font-size:12px">Sítio Dom Pedro — Eventos Especiais</p>
</div>""",
    },
    "nurturing_frio": {
        "subject": "Novidades do Sítio Dom Pedro",
        "html": """
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#2d6a4f">Olá, {{nome}}!</h2>
  <p>Temos novidades e datas disponíveis no Sítio Dom Pedro.</p>
  <p>Que tal marcar uma visita sem compromisso?</p>
  <p>Estamos prontos para tornar seu evento inesquecível.</p>
  <p style="color:#888;font-size:12px">
    Para não receber mais e-mails, responda com "SAIR".
  </p>
</div>""",
    },
    "nurturing_morno": {
        "subject": "Sua data ainda está disponível — Sítio Dom Pedro",
        "html": """
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#2d6a4f">Olá, {{nome}}!</h2>
  <p>Notamos que você ainda não confirmou sua data no Sítio Dom Pedro.</p>
  <p>Temos um tour virtual 360° disponível — conheça nosso espaço sem sair de casa!</p>
  <p>Datas com boa disponibilidade estão se esgotando. Não perca a sua!</p>
  <p style="color:#888;font-size:12px">Sítio Dom Pedro — Eventos Especiais</p>
</div>""",
    },
}


# ── Envio via SendGrid REST API ────────────────────────────────────────────────

async def _send_via_sendgrid(to: str, subject: str, html: str) -> bool:
    if not settings.sendgrid_api_key:
        return False
    payload = {
        "personalizations": [{"to": [{"email": to}]}],
        "from": {"email": settings.email_from},
        "subject": subject,
        "content": [{"type": "text/html", "value": html}],
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://api.sendgrid.com/v3/mail/send",
            json=payload,
            headers={"Authorization": f"Bearer {settings.sendgrid_api_key}"},
        )
    if resp.status_code in (200, 202):
        return True
    logger.error("SendGrid erro %s: %s", resp.status_code, resp.text[:200])
    return False


# ── Envio via SMTP fallback ────────────────────────────────────────────────────

def _send_via_smtp(to: str, subject: str, html: str) -> bool:
    smtp_host = getattr(settings, "smtp_host", "")
    smtp_port = int(getattr(settings, "smtp_port", 587))
    smtp_user = getattr(settings, "smtp_user", "")
    smtp_pass = getattr(settings, "smtp_password", "")
    if not smtp_host:
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.email_from
        msg["To"] = to
        msg.attach(MIMEText(html, "html", "utf-8"))
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            if smtp_user:
                server.login(smtp_user, smtp_pass)
            server.sendmail(settings.email_from, [to], msg.as_string())
        return True
    except Exception as exc:
        logger.error("SMTP erro: %s", exc)
        return False


# ── Função pública ─────────────────────────────────────────────────────────────

async def send_email(to: str, subject: str, html: str) -> bool:
    """Envia e-mail via SendGrid (prioridade) ou SMTP.  Retorna True se enviado."""
    if not to:
        return False
    try:
        if await _send_via_sendgrid(to, subject, html):
            logger.info("E-mail enviado via SendGrid para %s", to)
            return True
        if _send_via_smtp(to, subject, html):
            logger.info("E-mail enviado via SMTP para %s", to)
            return True
        logger.warning("Nenhum provedor de e-mail configurado — e-mail não enviado para %s", to)
        return False
    except Exception as exc:
        logger.error("Erro ao enviar e-mail para %s: %s", to, exc)
        return False


async def send_template_email(
    to: str,
    template_name: str,
    **kwargs: str,
) -> bool:
    """Renderiza template e envia e-mail."""
    tpl = TEMPLATES.get(template_name)
    if not tpl:
        logger.error("Template '%s' não encontrado", template_name)
        return False
    subject = _render(tpl["subject"], **kwargs)
    html = _render(tpl["html"], **kwargs)
    return await send_email(to, subject, html)
