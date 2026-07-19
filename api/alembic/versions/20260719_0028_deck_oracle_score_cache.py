"""Cache card role scores solely by deck and Oracle identity.

Revision ID: 20260719_0028
Revises: 20260719_0027
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260719_0028"
down_revision: str | None = "20260719_0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_card_role_evaluation_context_judge",
        "card_role_evaluations",
        type_="unique",
    )
    op.execute(
        """
        DELETE FROM card_role_evaluations AS stale
        USING (
            SELECT id,
                   row_number() OVER (
                       PARTITION BY deck_id, oracle_id
                       ORDER BY updated_at DESC, created_at DESC, id DESC
                   ) AS rank
            FROM card_role_evaluations
        ) AS ranked
        WHERE stale.id = ranked.id AND ranked.rank > 1
        """
    )
    op.create_unique_constraint(
        "uq_card_role_evaluation_deck_oracle",
        "card_role_evaluations",
        ["deck_id", "oracle_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_card_role_evaluation_deck_oracle",
        "card_role_evaluations",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_card_role_evaluation_context_judge",
        "card_role_evaluations",
        ["deck_id", "context_key", "evaluator_version", "prompt_version"],
    )
