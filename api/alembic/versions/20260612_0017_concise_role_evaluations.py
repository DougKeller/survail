"""Store one concise comment per card role evaluation.

Revision ID: 20260612_0017
Revises: 20260612_0016
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260612_0017"
down_revision: str | None = "20260612_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "card_role_evaluations",
        sa.Column("overall_comment", sa.Text(), server_default="", nullable=False),
    )
    op.alter_column("card_role_evaluations", "overall_comment", server_default=None)


def downgrade() -> None:
    op.drop_column("card_role_evaluations", "overall_comment")
