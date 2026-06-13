"""Track the deck revision used for generated descriptions.

Revision ID: 20260611_0013
Revises: 20260610_0012
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260611_0013"
down_revision: str | None = "20260610_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "decks",
        sa.Column(
            "generated_description",
            sa.Text(),
            server_default=sa.text("''"),
            nullable=False,
        ),
    )
    op.add_column(
        "decks",
        sa.Column("generated_description_revision", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("decks", "generated_description_revision")
    op.drop_column("decks", "generated_description")
