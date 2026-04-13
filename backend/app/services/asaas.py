"""
Serviço de pagamentos — integração com Asaas.

Cria cobranças (Pix, boleto, cartão) e processa webhooks de confirmação.
"""

from __future__ import annotations

import httpx

from app.config import settings

_BASE_SANDBOX = "https://sandbox.asaas.com/api/v3"
_BASE_PROD = "https://api.asaas.com/api/v3"


def _base_url() -> str:
    return _BASE_PROD if settings.asaas_environment == "producao" else _BASE_SANDBOX


def _headers() -> dict:
    return {"access_token": settings.asaas_api_key, "Content-Type": "application/json"}


# ── Clientes ──

async def get_or_create_customer(name: str, phone: str, email: str | None, cpf_cnpj: str | None = None) -> str:
    """Retorna o customerId do cliente no Asaas (cria se não existir)."""
    async with httpx.AsyncClient() as client:
        # Busca por telefone
        r = await client.get(
            f"{_base_url()}/customers",
            headers=_headers(),
            params={"mobilePhone": phone, "limit": 1},
        )
        r.raise_for_status()
        data = r.json()
        if data.get("data"):
            return data["data"][0]["id"]

        # Cria novo cliente
        payload = {"name": name, "mobilePhone": phone}
        if email:
            payload["email"] = email
        if cpf_cnpj:
            payload["cpfCnpj"] = cpf_cnpj

        r = await client.post(f"{_base_url()}/customers", headers=_headers(), json=payload)
        r.raise_for_status()
        return r.json()["id"]


# ── Cobranças ──

_METHOD_MAP = {
    "pix": "PIX",
    "boleto": "BOLETO",
    "cartao": "CREDIT_CARD",
}


async def create_charge(
    customer_id: str,
    value: float,
    due_date: str,  # "YYYY-MM-DD"
    method: str,    # "pix" | "boleto" | "cartao"
    description: str,
) -> dict:
    """
    Cria uma cobrança no Asaas e retorna o objeto completo da API.
    O campo `id` é o asaas_id a salvar no banco.
    """
    payload = {
        "customer": customer_id,
        "billingType": _METHOD_MAP.get(method, "PIX"),
        "value": value,
        "dueDate": due_date,
        "description": description,
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{_base_url()}/payments", headers=_headers(), json=payload)
        r.raise_for_status()
        return r.json()


async def get_payment_link(asaas_id: str) -> str | None:
    """Retorna a URL de pagamento (invoiceUrl) para enviar ao cliente."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{_base_url()}/payments/{asaas_id}", headers=_headers())
        r.raise_for_status()
        return r.json().get("invoiceUrl")
