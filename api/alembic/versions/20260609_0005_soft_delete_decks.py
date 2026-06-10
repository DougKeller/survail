"""soft delete decks to preserve operation history

Revision ID: 20260609_0005
Revises: 20260609_0004
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260609_0005"
down_revision: str | None = "20260609_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("decks", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_decks_deleted_at", "decks", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_decks_deleted_at", table_name="decks")
    op.drop_column("decks", "deleted_at")
