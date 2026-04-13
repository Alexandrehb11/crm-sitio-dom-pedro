"""utm fields + google_event_id

Revision ID: 003
Revises: 002
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # UTM tracking em leads
    op.add_column("leads", sa.Column("utm_source", sa.String(100), nullable=True))
    op.add_column("leads", sa.Column("utm_medium", sa.String(100), nullable=True))
    op.add_column("leads", sa.Column("utm_campaign", sa.String(200), nullable=True))

    # Google Calendar em events
    op.add_column("events", sa.Column("google_event_id", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("leads", "utm_source")
    op.drop_column("leads", "utm_medium")
    op.drop_column("leads", "utm_campaign")
    op.drop_column("events", "google_event_id")
