"""Add locally searchable Scryfall bulk catalog.

Revision ID: 20260609_0003
Revises: 20260609_0002
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260609_0003"
down_revision: str | Sequence[str] | None = "20260609_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_table(
        "catalog_cards",
        sa.Column("id", sa.String(length=40), nullable=False),
        sa.Column("oracle_id", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("lang", sa.String(length=12), nullable=False),
        sa.Column("layout", sa.String(length=40), nullable=False),
        sa.Column("cmc", sa.Float(), nullable=False),
        sa.Column("type_line", sa.Text(), nullable=False),
        sa.Column("oracle_text", sa.Text(), nullable=True),
        sa.Column("colors", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("color_identity", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("keywords", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("legalities", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("set_code", sa.String(length=10), nullable=False),
        sa.Column("set_name", sa.String(length=200), nullable=False),
        sa.Column("collector_number", sa.String(length=32), nullable=False),
        sa.Column("rarity", sa.String(length=20), nullable=False),
        sa.Column("finishes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("released_at", sa.String(length=10), nullable=True),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("oracle_id", "name", "lang", "cmc", "set_code", "rarity", "released_at"):
        op.create_index(op.f(f"ix_catalog_cards_{column}"), "catalog_cards", [column], unique=False)
    for column in ("name", "type_line", "oracle_text"):
        op.create_index(
            f"ix_catalog_cards_{column}_trgm",
            "catalog_cards",
            [column],
            unique=False,
            postgresql_using="gin",
            postgresql_ops={column: "gin_trgm_ops"},
        )
    for column in ("colors", "color_identity", "legalities"):
        op.create_index(
            f"ix_catalog_cards_{column}_gin",
            "catalog_cards",
            [column],
            unique=False,
            postgresql_using="gin",
        )
    op.create_table(
        "catalog_imports",
        sa.Column("bulk_type", sa.String(length=40), nullable=False),
        sa.Column("source_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("card_count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("bulk_type"),
    )


def downgrade() -> None:
    op.drop_table("catalog_imports")
    op.drop_table("catalog_cards")
