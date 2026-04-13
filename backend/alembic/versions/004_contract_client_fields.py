"""add client_name, client_phone, pdf_template_base64 to contracts

Revision ID: 004
Revises: 003
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('contracts', sa.Column('client_name', sa.String(200), nullable=True))
    op.add_column('contracts', sa.Column('client_phone', sa.String(30), nullable=True))
    op.add_column('contracts', sa.Column('pdf_template_base64', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('contracts', 'pdf_template_base64')
    op.drop_column('contracts', 'client_phone')
    op.drop_column('contracts', 'client_name')
