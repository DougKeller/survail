"""Replace soft-deleted decks with permanent deletion.

Revision ID: 20260609_0011
Revises: 20260609_0010
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260609_0011"
down_revision: str | None = "20260609_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Preserve the meaning of prior deletions instead of making those decks visible again.
    op.execute("DELETE FROM decks WHERE deleted_at IS NOT NULL")
    op.drop_index("ix_decks_deleted_at", table_name="decks")
    op.drop_column("decks", "deleted_at")


def downgrade() -> None:
    op.add_column("decks", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_decks_deleted_at", "decks", ["deleted_at"])
