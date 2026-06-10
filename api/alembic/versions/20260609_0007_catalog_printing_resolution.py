"""Add catalog fields used for printing resolution.

Revision ID: 20260609_0007
Revises: 20260609_0006
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260609_0007"
down_revision: str | None = "20260609_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("catalog_cards", sa.Column("usd", sa.Numeric(12, 2), nullable=True))
    op.add_column("catalog_cards", sa.Column("usd_foil", sa.Numeric(12, 2), nullable=True))
    op.add_column("catalog_cards", sa.Column("usd_etched", sa.Numeric(12, 2), nullable=True))
    op.add_column(
        "catalog_cards",
        sa.Column("universes_beyond", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.create_index("ix_catalog_cards_usd", "catalog_cards", ["usd"])
    op.create_index("ix_catalog_cards_universes_beyond", "catalog_cards", ["universes_beyond"])
    op.execute("DELETE FROM catalog_imports WHERE bulk_type IN ('all-cards', 'default_cards')")


def downgrade() -> None:
    op.drop_index("ix_catalog_cards_universes_beyond", table_name="catalog_cards")
    op.drop_index("ix_catalog_cards_usd", table_name="catalog_cards")
    op.drop_column("catalog_cards", "universes_beyond")
    op.drop_column("catalog_cards", "usd_etched")
    op.drop_column("catalog_cards", "usd_foil")
    op.drop_column("catalog_cards", "usd")
