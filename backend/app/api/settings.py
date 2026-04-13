"""
Settings API — Leitura e atualização das variáveis de integração no .env do backend.
Endpoints acessíveis apenas para usuários com role=admin.

GET  /api/settings/   → retorna os valores atuais das chaves gerenciadas
PATCH /api/settings/  → atualiza as chaves no arquivo .env
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.config import reload_settings
from app.core.security import require_admin

router = APIRouter()

# Caminho para o .env (relativo à raiz do projeto backend)
ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"

# Chaves que podem ser gerenciadas via API (exclui credenciais de banco/infra)
MANAGED_KEYS = [
    # Segurança
    "AES_SECRET_KEY",
    # WhatsApp
    "WHATSAPP_PROVIDER",
    "EVOLUTION_API_URL",
    "EVOLUTION_API_KEY",
    "EVOLUTION_INSTANCE",
    "ZAPI_INSTANCE_ID",
    "ZAPI_TOKEN",
    "ZAPI_SECURITY_TOKEN",
    # Pagamentos
    "ASAAS_API_KEY",
    "ASAAS_ENVIRONMENT",
    # Contratos
    "ZAPSIGN_API_TOKEN",
    # E-mail
    "SENDGRID_API_KEY",
    "EMAIL_FROM",
    # IA
    "OPENAI_API_KEY",
    # Google Calendar
    "GOOGLE_CALENDAR_CREDENTIALS_JSON",
    "GOOGLE_CALENDAR_ID",
    "GOOGLE_CALENDAR_AUTO_SYNC",
    "GOOGLE_CALENDAR_INVITE_LEAD",
]


def _read_env() -> dict[str, str]:
    """Lê o arquivo .env e retorna um dicionário chave→valor."""
    if not ENV_FILE.exists():
        return {}
    result: dict[str, str] = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" in stripped:
            key, _, value = stripped.partition("=")
            result[key.strip()] = value.strip()
    return result


def _quote_value(value: str) -> str:
    """
    Envolve o valor em aspas simples se necessário para preservar caracteres especiais
    como '$', espaços, aspas duplas etc. no arquivo .env.
    """
    # Se já está entre aspas simples ou duplas, retorna como está
    if (value.startswith("'") and value.endswith("'")) or \
       (value.startswith('"') and value.endswith('"')):
        return value
    # Requer aspas simples se contiver $, espaço, aspas, { ou } (JSON ou chaves de API)
    if any(c in value for c in ("$", " ", '"', "{", "}", "\n")):
        # Escapa aspas simples dentro do valor
        escaped = value.replace("'", "'\\''")
        return f"'{escaped}'"
    return value


def _write_env(updates: dict[str, str]) -> None:
    """Atualiza chaves específicas no .env preservando comentários e estrutura."""
    if not ENV_FILE.exists():
        raise HTTPException(status_code=404, detail="Arquivo .env não encontrado no servidor")

    lines = ENV_FILE.read_text(encoding="utf-8").splitlines(keepends=True)
    updated_keys: set[str] = set()
    new_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key, _, _ = stripped.partition("=")
            key = key.strip()
            if key in updates:
                new_lines.append(f"{key}={_quote_value(updates[key])}\n")
                updated_keys.add(key)
                continue
        # Preserva a linha original (incluindo quebra de linha)
        new_lines.append(line if line.endswith("\n") else line + "\n")

    # Adiciona chaves novas que não existiam no arquivo
    for key, value in updates.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={_quote_value(value)}\n")

    ENV_FILE.write_text("".join(new_lines), encoding="utf-8")


class SettingsOut(BaseModel):
    values: dict[str, str]


class SettingsUpdate(BaseModel):
    values: dict[str, str]


@router.get("/", response_model=SettingsOut)
def get_settings(_=Depends(require_admin)):
    """Retorna os valores atuais das variáveis gerenciadas."""
    current = _read_env()
    return SettingsOut(values={k: current.get(k, "") for k in MANAGED_KEYS})


@router.patch("/", response_model=SettingsOut)
def update_settings(data: SettingsUpdate, _=Depends(require_admin)):
    """Atualiza as variáveis gerenciadas no arquivo .env e recarrega o settings em memória."""
    allowed = {k: v for k, v in data.values.items() if k in MANAGED_KEYS}
    if not allowed:
        raise HTTPException(status_code=400, detail="Nenhuma chave válida para atualizar")
    _write_env(allowed)
    # Recarrega o objeto settings em memória para que os novos valores sejam
    # usados imediatamente sem precisar reiniciar o container
    reload_settings()
    current = _read_env()
    return SettingsOut(values={k: current.get(k, "") for k in MANAGED_KEYS})
