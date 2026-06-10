"""Add catalog marketplace prices, border color, and frame.

Revision ID: 20260609_0010
Revises: 20260609_0009
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260609_0010"
down_revision: str | None = "20260609_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("catalog_cards", sa.Column("eur", sa.Numeric(12, 2), nullable=True))
    op.add_column("catalog_cards", sa.Column("eur_foil", sa.Numeric(12, 2), nullable=True))
    op.add_column("catalog_cards", sa.Column("tix", sa.Numeric(12, 2), nullable=True))
    op.add_column(
        "catalog_cards",
        sa.Column("border_color", sa.String(length=20), server_default="black", nullable=False),
    )
    op.add_column(
        "catalog_cards",
        sa.Column("frame", sa.String(length=20), server_default="2015", nullable=False),
    )
    op.create_index("ix_catalog_cards_border_color", "catalog_cards", ["border_color"])
    op.create_index("ix_catalog_cards_frame", "catalog_cards", ["frame"])
    op.execute("DELETE FROM catalog_imports WHERE bulk_type = 'default_cards'")


def downgrade() -> None:
    op.drop_index("ix_catalog_cards_frame", table_name="catalog_cards")
    op.drop_index("ix_catalog_cards_border_color", table_name="catalog_cards")
    op.drop_column("catalog_cards", "frame")
    op.drop_column("catalog_cards", "border_color")
    op.drop_column("catalog_cards", "tix")
    op.drop_column("catalog_cards", "eur_foil")
    op.drop_column("catalog_cards", "eur")
