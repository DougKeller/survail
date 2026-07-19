"""Add deck tag targets and per-card tag weights.

Revision ID: 20260719_0030
Revises: 20260719_0029
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260719_0030"
down_revision: str | None = "20260719_0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "deck_tags",
        sa.Column("target", sa.Float(), server_default="0", nullable=False),
    )
    op.create_check_constraint("ck_deck_tag_target", "deck_tags", "target >= 0")
    op.add_column(
        "cardset_deck_tags",
        sa.Column("weight", sa.Float(), server_default="1", nullable=False),
    )
    op.create_check_constraint(
        "ck_cardset_deck_tag_weight",
        "cardset_deck_tags",
        "weight IN (0.25, 0.5, 0.75, 1)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_cardset_deck_tag_weight",
        "cardset_deck_tags",
        type_="check",
    )
    op.drop_column("cardset_deck_tags", "weight")
    op.drop_constraint("ck_deck_tag_target", "deck_tags", type_="check")
    op.drop_column("deck_tags", "target")
