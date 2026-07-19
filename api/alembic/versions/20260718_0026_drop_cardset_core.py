"""Drop cardset core-card starring.

Revision ID: 20260718_0026
Revises: 20260718_0025
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260718_0026"
down_revision: str | None = "20260718_0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(op.f("ix_cardsets_core"), table_name="cardsets")
    op.drop_column("cardsets", "core")


def downgrade() -> None:
    op.add_column(
        "cardsets",
        sa.Column("core", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.alter_column("cardsets", "core", server_default=None)
    op.create_index(op.f("ix_cardsets_core"), "cardsets", ["core"], unique=False)
