"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-04-12
"""

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "leads",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False, index=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("event_date", sa.DateTime, nullable=True),
        sa.Column("event_date_alt", sa.DateTime, nullable=True),
        sa.Column(
            "event_type",
            sa.Enum("casamento", "corporativo", "debutante", "religioso", "aniversario", "outro", name="eventtype"),
            default="outro",
        ),
        sa.Column("guest_count", sa.Integer, nullable=True),
        sa.Column("budget", sa.Float, nullable=True),
        sa.Column(
            "source_channel",
            sa.Enum("formulario", "chatbot", "whatsapp", "qr_code", "indicacao", "instagram", "outro", name="sourcechannel"),
            default="outro",
        ),
        sa.Column("score", sa.Integer, default=0),
        sa.Column(
            "funnel_stage",
            sa.Enum("lead", "visita_agendada", "proposta_enviada", "contrato_assinado", "evento_realizado", name="funnelstage"),
            default="lead",
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("consent_lgpd", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "providers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("contact_name", sa.String(200), nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("whatsapp", sa.String(20), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("lead_id", sa.String(36), sa.ForeignKey("leads.id"), nullable=False, index=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("date_start", sa.DateTime, nullable=False, index=True),
        sa.Column("date_end", sa.DateTime, nullable=False),
        sa.Column("space", sa.String(200), nullable=False),
        sa.Column("guest_count", sa.Integer, nullable=True),
        sa.Column(
            "status",
            sa.Enum("planejamento", "confirmado", "realizado", "cancelado", name="eventstatus"),
            default="planejamento",
        ),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "event_providers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_id", sa.String(36), sa.ForeignKey("events.id"), nullable=False),
        sa.Column("provider_id", sa.String(36), sa.ForeignKey("providers.id"), nullable=False),
        sa.Column("role", sa.String(100), nullable=True),
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_id", sa.String(36), sa.ForeignKey("events.id"), nullable=False, index=True),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column(
            "method",
            sa.Enum("pix", "boleto", "cartao", name="paymentmethod"),
            nullable=False,
        ),
        sa.Column("installment_number", sa.Integer, default=1),
        sa.Column("installment_total", sa.Integer, default=1),
        sa.Column(
            "status",
            sa.Enum("pendente", "pago", "vencido", "falhou", "cancelado", name="paymentstatus"),
            default="pendente",
        ),
        sa.Column("asaas_id", sa.String(100), nullable=True),
        sa.Column("confirmed_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    op.create_table(
        "contracts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_id", sa.String(36), sa.ForeignKey("events.id"), nullable=False, index=True),
        sa.Column("template_type", sa.String(100), nullable=False),
        sa.Column("signed_by", sa.String(200), nullable=True),
        sa.Column("signed_date", sa.DateTime, nullable=True),
        sa.Column("zapsign_id", sa.String(100), nullable=True),
        sa.Column("signed_via", sa.String(50), nullable=True),
        sa.Column(
            "status",
            sa.Enum("pendente", "assinado", "executado", "cancelado", name="contractstatus"),
            default="pendente",
        ),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("contracts")
    op.drop_table("payments")
    op.drop_table("event_providers")
    op.drop_table("events")
    op.drop_table("providers")
    op.drop_table("leads")
    op.execute("DROP TYPE IF EXISTS contractstatus")
    op.execute("DROP TYPE IF EXISTS paymentstatus")
    op.execute("DROP TYPE IF EXISTS paymentmethod")
    op.execute("DROP TYPE IF EXISTS eventstatus")
    op.execute("DROP TYPE IF EXISTS funnelstage")
    op.execute("DROP TYPE IF EXISTS sourcechannel")
    op.execute("DROP TYPE IF EXISTS eventtype")
