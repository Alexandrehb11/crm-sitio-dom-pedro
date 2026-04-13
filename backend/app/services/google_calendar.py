"""
Google Calendar API — Service Account auth.

Configuração via painel (Settings):
  GOOGLE_CALENDAR_CREDENTIALS_JSON  JSON do Service Account (string ou path para arquivo)
  GOOGLE_CALENDAR_ID                ID da agenda (e-mail ou ID do Google)

Uso:
    svc = get_google_calendar_service()
    if svc:
        event_id = svc.create_event(title=..., start=..., end=..., ...)
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


class GoogleCalendarService:
    def __init__(self, credentials: dict, calendar_id: str) -> None:
        self._calendar_id = calendar_id
        self._service = self._build_service(credentials)

    @staticmethod
    def _build_service(credentials: dict):
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build

            scopes = ["https://www.googleapis.com/auth/calendar"]
            creds = service_account.Credentials.from_service_account_info(
                credentials, scopes=scopes
            )
            return build("calendar", "v3", credentials=creds, cache_discovery=False)
        except ImportError:
            logger.error(
                "google-api-python-client não instalado. "
                "Execute: pip install google-auth google-auth-httplib2 google-api-python-client"
            )
            return None
        except Exception as exc:
            logger.error("Erro ao criar serviço Google Calendar: %s", exc)
            return None

    def _dt_body(self, dt: datetime) -> dict:
        """Converte datetime para body do Google Calendar (UTC)."""
        return {"dateTime": dt.strftime("%Y-%m-%dT%H:%M:%S"), "timeZone": "America/Belem"}

    def create_event(
        self,
        title: str,
        start: datetime,
        end: datetime,
        description: str = "",
        attendees: list[str] | None = None,
    ) -> Optional[str]:
        """Cria evento no Google Calendar. Retorna google_event_id ou None."""
        if not self._service:
            return None
        body: dict = {
            "summary": title,
            "description": description,
            "start": self._dt_body(start),
            "end": self._dt_body(end),
        }
        if attendees:
            body["attendees"] = [{"email": e} for e in attendees if e]
        try:
            result = (
                self._service.events()
                .insert(calendarId=self._calendar_id, body=body, sendUpdates="all")
                .execute()
            )
            event_id: str = result.get("id", "")
            logger.info("Evento criado no Google Calendar: %s", event_id)
            return event_id
        except Exception as exc:
            logger.error("Erro ao criar evento no Google Calendar: %s", exc)
            return None

    def update_event(self, google_event_id: str, **kwargs) -> bool:
        """Atualiza campos de um evento existente. Aceita title, start, end, description."""
        if not self._service:
            return False
        try:
            existing = (
                self._service.events()
                .get(calendarId=self._calendar_id, eventId=google_event_id)
                .execute()
            )
            if "title" in kwargs:
                existing["summary"] = kwargs["title"]
            if "description" in kwargs:
                existing["description"] = kwargs["description"]
            if "start" in kwargs:
                existing["start"] = self._dt_body(kwargs["start"])
            if "end" in kwargs:
                existing["end"] = self._dt_body(kwargs["end"])
            self._service.events().update(
                calendarId=self._calendar_id,
                eventId=google_event_id,
                body=existing,
                sendUpdates="all",
            ).execute()
            return True
        except Exception as exc:
            logger.error("Erro ao atualizar evento %s: %s", google_event_id, exc)
            return False

    def delete_event(self, google_event_id: str) -> bool:
        """Remove evento do Google Calendar."""
        if not self._service:
            return False
        try:
            self._service.events().delete(
                calendarId=self._calendar_id,
                eventId=google_event_id,
                sendUpdates="all",
            ).execute()
            logger.info("Evento %s removido do Google Calendar", google_event_id)
            return True
        except Exception as exc:
            logger.error("Erro ao remover evento %s: %s", google_event_id, exc)
            return False

    def event_exists(self, google_event_id: str) -> bool:
        """Verifica se evento ainda existe no Google Calendar."""
        if not self._service:
            return False
        try:
            self._service.events().get(
                calendarId=self._calendar_id, eventId=google_event_id
            ).execute()
            return True
        except Exception:
            return False


def get_google_calendar_service() -> Optional[GoogleCalendarService]:
    """
    Instancia o serviço usando as configurações do banco/env.
    Retorna None se credenciais não estiverem configuradas.
    """
    from app.config import settings

    raw = getattr(settings, "google_calendar_credentials_json", "")
    calendar_id = getattr(settings, "google_calendar_id", "")

    if not raw or not calendar_id:
        return None

    # Aceita JSON direto como string ou path para arquivo
    credentials: dict | None = None
    if raw.strip().startswith("{"):
        try:
            credentials = json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.error("GOOGLE_CALENDAR_CREDENTIALS_JSON inválido: %s", exc)
            return None
    elif os.path.isfile(raw):
        try:
            with open(raw, "r", encoding="utf-8") as f:
                credentials = json.load(f)
        except Exception as exc:
            logger.error("Erro ao ler arquivo de credenciais Google: %s", exc)
            return None
    else:
        logger.warning("GOOGLE_CALENDAR_CREDENTIALS_JSON não é JSON nem caminho válido")
        return None

    return GoogleCalendarService(credentials, calendar_id)
