"""Add oracle-level OpenAI embeddings.

Revision ID: 20260609_0006
Revises: 20260609_0005
"""

from collections.abc import Sequence

import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

from alembic import op

revision: str = "20260609_0006"
down_revision: str | None = "20260609_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "oracle_embeddings",
        sa.Column("oracle_id", sa.String(length=40), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("source_text", sa.Text(), nullable=False),
        sa.Column("source_hash", sa.String(length=64), nullable=False),
        sa.Column("embedding", Vector(3072), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("oracle_id"),
    )
    op.create_index("ix_oracle_embeddings_model", "oracle_embeddings", ["model"])
    op.create_index("ix_oracle_embeddings_source_hash", "oracle_embeddings", ["source_hash"])


def downgrade() -> None:
    op.drop_table("oracle_embeddings")
