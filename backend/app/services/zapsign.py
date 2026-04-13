"""
Serviço de contratos digitais — integração com ZapSign.

Envia contratos para assinatura e consulta status.
"""

from __future__ import annotations

import httpx

from app.config import settings

_BASE_URL = "https://api.zapsign.com.br/api/v1"


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.zapsign_api_token}",
        "Content-Type": "application/json",
    }


async def create_document(
    name: str,
    signers: list[dict],  # [{"name": "...", "email": "...", "phone_country": "55", "phone_number": "..."}]
    template_id: str | None = None,
    pdf_base64: str | None = None,
) -> dict:
    """
    Cria um documento no ZapSign para coleta de assinaturas.

    Retorna o objeto da API contendo 'open_id' (zapsign_id) e links de assinatura.

    Forneça `template_id` para usar um template pré-configurado, ou `pdf_base64`
    para enviar um PDF diretamente.
    """
    payload: dict = {
        "name": name,
        "signers": signers,
        "lang": "pt-BR",
        "disable_signer_emails": False,
        "signed_file_only_finished": True,
    }
    if template_id:
        payload["template_id"] = template_id
    elif pdf_base64:
        payload["base64_pdf"] = pdf_base64

    async with httpx.AsyncClient() as client:
        r = await client.post(f"{_BASE_URL}/docs/", headers=_headers(), json=payload)
        r.raise_for_status()
        return r.json()


async def get_document_status(zapsign_id: str) -> dict:
    """Consulta status do documento (pending | signed | refused)."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{_BASE_URL}/docs/{zapsign_id}/", headers=_headers())
        r.raise_for_status()
        return r.json()
