from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Banco de Dados ──
    database_url: str = "postgresql://crm:crm_secret@db:5432/crm_sitio"

    # ── Redis / Celery ──
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/0"
    celery_result_backend: str = "redis://redis:6379/1"

    # ── Criptografia ──
    aes_secret_key: str = "trocar-por-chave-segura-de-32-bytes"

    # ── WhatsApp ──
    whatsapp_provider: str = "evolution"  # "evolution" ou "zapi"
    evolution_api_url: str = ""
    evolution_api_key: str = ""
    evolution_instance: str = "sitio-dom-pedro"
    zapi_instance_id: str = ""
    zapi_token: str = ""
    zapi_security_token: str = ""

    # ── Pagamentos (Asaas) ──
    asaas_api_key: str = ""
    asaas_environment: str = "sandbox"  # "sandbox" ou "producao"

    # ── Contratos (ZapSign) ──
    zapsign_api_token: str = ""

    # ── Email ──
    sendgrid_api_key: str = ""
    email_from: str = "contato@sitiodomPedro.com.br"

    # ── IA (opcional) ──
    openai_api_key: str = ""

    # ── Google Calendar ──
    google_calendar_credentials_json: str = ""  # JSON string ou path para arquivo
    google_calendar_id: str = ""                # ID da agenda (e-mail ou ID do Google)
    google_calendar_auto_sync: bool = True      # sincroniza automaticamente ao confirmar
    google_calendar_invite_lead: bool = False   # convida lead por e-mail na visita

    # ── SMTP fallback (alternativa ao SendGrid) ──
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""

    # ── CORS ──
    cors_origins: str = "http://localhost:5173,http://localhost:5174"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()


def reload_settings() -> None:
    """
    Re-instancia o objeto `settings` lendo o arquivo .env atualizado.
    Deve ser chamado após qualquer escrita no .env (ex: painel de configurações).
    """
    global settings
    settings = Settings()
