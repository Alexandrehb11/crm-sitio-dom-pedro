"""
Adaptador de WhatsApp — suporta Evolution API e Z-API.

Envia mensagens via o provedor configurado em Settings.
"""

from __future__ import annotations

import httpx

from app.config import settings


async def send_whatsapp_message(phone: str, text: str) -> dict:
    if settings.whatsapp_provider == "evolution":
        return await _send_evolution(phone, text)
    return await _send_zapi(phone, text)


async def _send_evolution(phone: str, text: str) -> dict:
    url = f"{settings.evolution_api_url}/message/sendText/{settings.evolution_instance}"
    headers = {"apikey": settings.evolution_api_key}
    payload = {"number": phone, "text": text}
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def _send_zapi(phone: str, text: str) -> dict:
    url = f"https://api.z-api.io/instances/{settings.zapi_instance_id}/token/{settings.zapi_token}/send-text"
    headers = {"Client-Token": settings.zapi_security_token}
    payload = {"phone": phone, "message": text}
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()
