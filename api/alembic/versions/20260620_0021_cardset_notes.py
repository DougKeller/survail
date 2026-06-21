"""Add cardset notes for LLM context curation.

Revision ID: 20260620_0021
Revises: 20260619_0020
Create Date: 2026-06-20 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260620_0021"
down_revision = "20260619_0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cardsets", sa.Column("note", sa.String(length=2000), nullable=True))


def downgrade() -> None:
    op.drop_column("cardsets", "note")
