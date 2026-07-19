"""Track the exact prompt artifact used for card evaluations.

Revision ID: 20260718_0025
Revises: 20260717_0024
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260718_0025"
down_revision: str | None = "20260717_0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

LEGACY_PROMPT_VERSION = "legacy"


def upgrade() -> None:
    op.add_column(
        "card_role_evaluations",
        sa.Column(
            "prompt_version",
            sa.String(length=80),
            server_default=LEGACY_PROMPT_VERSION,
            nullable=False,
        ),
    )
    op.create_index(
        "ix_card_role_evaluations_prompt_version",
        "card_role_evaluations",
        ["prompt_version"],
    )
    op.drop_constraint(
        "uq_card_role_evaluation_context_version",
        "card_role_evaluations",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_card_role_evaluation_context_judge",
        "card_role_evaluations",
        ["deck_id", "context_key", "evaluator_version", "prompt_version"],
    )
    op.alter_column("card_role_evaluations", "prompt_version", server_default=None)

    op.add_column(
        "card_evaluation_feedback",
        sa.Column(
            "prompt_version",
            sa.String(length=80),
            server_default=LEGACY_PROMPT_VERSION,
            nullable=False,
        ),
    )
    op.create_index(
        "ix_card_evaluation_feedback_prompt_version",
        "card_evaluation_feedback",
        ["prompt_version"],
    )
    op.alter_column("card_evaluation_feedback", "prompt_version", server_default=None)


def downgrade() -> None:
    op.drop_index(
        "ix_card_evaluation_feedback_prompt_version",
        table_name="card_evaluation_feedback",
    )
    op.drop_column("card_evaluation_feedback", "prompt_version")

    op.drop_constraint(
        "uq_card_role_evaluation_context_judge",
        "card_role_evaluations",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_card_role_evaluation_context_version",
        "card_role_evaluations",
        ["deck_id", "context_key", "evaluator_version"],
    )
    op.drop_index(
        "ix_card_role_evaluations_prompt_version",
        table_name="card_role_evaluations",
    )
    op.drop_column("card_role_evaluations", "prompt_version")
