"""create message_templates table with default templates

Revision ID: 005
Revises: 004
Create Date: 2026-04-13
"""

import sys
import os
import uuid
from datetime import datetime

import sqlalchemy as sa
from alembic import op
from sqlalchemy.sql import column, table

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None

NOW = datetime(2026, 4, 13, 12, 0, 0)


def _get_default_templates():
    """Importa lista de templates do módulo compartilhado."""
    try:
        from app.services.template_seed import DEFAULT_TEMPLATES
        return DEFAULT_TEMPLATES
    except ImportError:
        return []


def upgrade() -> None:
    op.create_table(
        "message_templates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("flow", sa.String(50), nullable=False),
        sa.Column("trigger", sa.String(150), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False, server_default="whatsapp"),
        sa.Column("variables", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_message_templates_key", "message_templates", ["key"], unique=True)
    op.create_index("ix_message_templates_flow", "message_templates", ["flow"])

    templates = _get_default_templates()
    if not templates:
        return

    tpl_table = table(
        "message_templates",
        column("id", sa.String),
        column("key", sa.String),
        column("title", sa.String),
        column("body", sa.Text),
        column("flow", sa.String),
        column("trigger", sa.String),
        column("channel", sa.String),
        column("variables", sa.Text),
        column("is_active", sa.Boolean),
        column("updated_at", sa.DateTime),
    )
    op.bulk_insert(
        tpl_table,
        [{"id": str(uuid.uuid4()), "is_active": True, "updated_at": NOW, **t} for t in templates],
    )


def downgrade() -> None:
    op.drop_index("ix_message_templates_flow", table_name="message_templates")
    op.drop_index("ix_message_templates_key", table_name="message_templates")
    op.drop_table("message_templates")
