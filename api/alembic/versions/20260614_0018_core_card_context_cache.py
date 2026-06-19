"""Add core-card flags and context-keyed role evaluation caching.

Revision ID: 20260614_0018
Revises: 20260612_0017
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260614_0018"
down_revision: str | None = "20260612_0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cardsets",
        sa.Column("core", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.alter_column("cardsets", "core", server_default=None)
    op.create_index(op.f("ix_cardsets_core"), "cardsets", ["core"], unique=False)

    op.add_column(
        "card_role_evaluations",
        sa.Column("context_key", sa.String(length=64), server_default="", nullable=False),
    )
    op.execute(
        """
        UPDATE card_role_evaluations
        SET context_key = md5(
            deck_id::text || ':' || deck_revision::text || ':' || oracle_id || ':' || evaluator_version
        )
        """
    )
    op.alter_column("card_role_evaluations", "context_key", server_default=None)
    op.create_index(
        op.f("ix_card_role_evaluations_context_key"),
        "card_role_evaluations",
        ["context_key"],
        unique=False,
    )
    op.drop_constraint(
        "uq_card_role_evaluation_revision_oracle_version",
        "card_role_evaluations",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_card_role_evaluation_context_version",
        "card_role_evaluations",
        ["deck_id", "context_key", "evaluator_version"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_card_role_evaluation_context_version",
        "card_role_evaluations",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_card_role_evaluation_revision_oracle_version",
        "card_role_evaluations",
        ["deck_id", "deck_revision", "oracle_id", "evaluator_version"],
    )
    op.drop_index(op.f("ix_card_role_evaluations_context_key"), table_name="card_role_evaluations")
    op.drop_column("card_role_evaluations", "context_key")

    op.drop_index(op.f("ix_cardsets_core"), table_name="cardsets")
    op.drop_column("cardsets", "core")
