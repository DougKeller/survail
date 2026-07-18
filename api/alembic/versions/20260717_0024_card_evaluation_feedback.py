"""Card evaluation feedback with expected-diff labels.

Revision ID: 20260717_0024
Revises: 20260716_0023
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260717_0024"
down_revision: str | None = "20260716_0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "card_evaluation_feedback",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("deck_id", sa.Uuid(), nullable=False),
        sa.Column("deck_revision", sa.Integer(), nullable=False),
        sa.Column("oracle_id", sa.String(length=40), nullable=False),
        sa.Column("card_name", sa.String(length=200), nullable=False),
        sa.Column("context_key", sa.String(length=64), nullable=False),
        sa.Column("evaluator_version", sa.String(length=40), nullable=False),
        sa.Column("evaluation_model", sa.String(length=80), nullable=False),
        sa.Column("scope", sa.String(length=40), nullable=False),
        sa.Column("verdict", sa.String(length=8), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("actual", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("expected", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "evaluation_context", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["deck_id"], ["decks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_card_evaluation_feedback_owner_id", "card_evaluation_feedback", ["owner_id"]
    )
    op.create_index(
        "ix_card_evaluation_feedback_deck_id", "card_evaluation_feedback", ["deck_id"]
    )
    op.create_index(
        "ix_card_evaluation_feedback_oracle_id", "card_evaluation_feedback", ["oracle_id"]
    )
    op.create_index(
        "ix_card_evaluation_feedback_context_key", "card_evaluation_feedback", ["context_key"]
    )
    op.create_index(
        "ix_card_evaluation_feedback_evaluator_version",
        "card_evaluation_feedback",
        ["evaluator_version"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_card_evaluation_feedback_evaluator_version", table_name="card_evaluation_feedback"
    )
    op.drop_index(
        "ix_card_evaluation_feedback_context_key", table_name="card_evaluation_feedback"
    )
    op.drop_index("ix_card_evaluation_feedback_oracle_id", table_name="card_evaluation_feedback")
    op.drop_index("ix_card_evaluation_feedback_deck_id", table_name="card_evaluation_feedback")
    op.drop_index("ix_card_evaluation_feedback_owner_id", table_name="card_evaluation_feedback")
    op.drop_table("card_evaluation_feedback")
