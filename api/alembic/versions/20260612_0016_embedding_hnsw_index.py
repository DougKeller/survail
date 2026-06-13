"""Add cosine HNSW index for semantic card search.

Revision ID: 20260612_0016
Revises: 20260612_0015
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260612_0016"
down_revision: str | None = "20260612_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX ix_oracle_embeddings_cosine_hnsw "
        "ON oracle_embeddings USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)"
    )


def downgrade() -> None:
    op.drop_index("ix_oracle_embeddings_cosine_hnsw", table_name="oracle_embeddings")
