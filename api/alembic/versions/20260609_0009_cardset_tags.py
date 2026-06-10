"""Persist cardset tags and their operation history.

Revision ID: 20260609_0009
Revises: 20260609_0008
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260609_0009"
down_revision: str | None = "20260609_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    empty_json = sa.text("'[]'::json")
    op.add_column(
        "cardsets",
        sa.Column("tags", sa.JSON(), server_default=empty_json, nullable=False),
    )
    op.add_column(
        "deck_operation_changes",
        sa.Column("tags_before", sa.JSON(), server_default=empty_json, nullable=False),
    )
    op.add_column(
        "deck_operation_changes",
        sa.Column("tags_after", sa.JSON(), server_default=empty_json, nullable=False),
    )


def downgrade() -> None:
    op.drop_column("deck_operation_changes", "tags_after")
    op.drop_column("deck_operation_changes", "tags_before")
    op.drop_column("cardsets", "tags")
