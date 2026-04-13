"""
Lead Scoring — modelo de pontuação para qualificação de leads.

Faixas:
  < 30  → Frio
  30-59 → Morno
  ≥ 60  → Quente
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.lead import Lead


def calculate_score(lead: Lead) -> int:
    score = 0

    # ── Fatores demográficos ──

    # Data confirmada
    if lead.event_date is not None:
        score += 20

        # Evento em menos de 6 meses
        if lead.event_date <= datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=180):
            score += 15

    # Orçamento definido
    if lead.budget is not None and lead.budget > 0:
        score += 15

    # Tipo de evento de alto valor
    if lead.event_type in ("casamento", "corporativo"):
        score += 10

    # Mais de 100 convidados
    if lead.guest_count is not None and lead.guest_count > 100:
        score += 10

    # Indicação
    if lead.source_channel == "indicacao":
        score += 15

    # ── Fatores comportamentais ──

    # Preencheu formulário
    if lead.source_channel == "formulario":
        score += 10

    # Visita agendada
    if lead.funnel_stage in ("visita_agendada", "proposta_enviada", "contrato_assinado", "evento_realizado"):
        score += 20

    # Visitou o espaço (proposta enviada ou além)
    if lead.funnel_stage in ("proposta_enviada", "contrato_assinado", "evento_realizado"):
        score += 25

    # Abriu proposta / contrato assinado
    if lead.funnel_stage in ("contrato_assinado", "evento_realizado"):
        score += 15

    return min(score, 100)


def classify_lead(score: int) -> str:
    if score >= 60:
        return "quente"
    if score >= 30:
        return "morno"
    return "frio"
