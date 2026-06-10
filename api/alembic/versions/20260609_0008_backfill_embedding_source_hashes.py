"""Backfill embedding source hashes without regenerating vectors.

Revision ID: 20260609_0008
Revises: 20260609_0007
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260609_0008"
down_revision: str | None = "20260609_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute(
        """
        UPDATE oracle_embeddings
        SET source_hash = encode(digest(convert_to(source_text, 'UTF8'), 'sha256'), 'hex')
        """
    )


def downgrade() -> None:
    pass
