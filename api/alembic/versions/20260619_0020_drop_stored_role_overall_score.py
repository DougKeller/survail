"""Drop stored overall score from role evaluations.

Revision ID: 20260619_0020
Revises: 20260614_0019
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260619_0020"
down_revision: str | None = "20260614_0019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("card_role_evaluations", "overall_score")


def downgrade() -> None:
    op.add_column(
        "card_role_evaluations",
        sa.Column("overall_score", sa.Integer(), nullable=False, server_default="0"),
    )
    op.alter_column("card_role_evaluations", "overall_score", server_default=None)
