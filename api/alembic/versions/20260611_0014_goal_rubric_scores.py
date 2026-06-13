"""Add deck goals, rubrics, scores, and guidance proposals.

Revision ID: 20260611_0014
Revises: 20260611_0013
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260611_0014"
down_revision: str | None = "20260611_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "decks", sa.Column("goal", sa.Text(), server_default=sa.text("''"), nullable=False)
    )
    op.add_column(
        "decks",
        sa.Column(
            "rubric",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.create_table(
        "card_rubric_scores",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("deck_id", sa.Uuid(), nullable=False),
        sa.Column("deck_revision", sa.Integer(), nullable=False),
        sa.Column("oracle_id", sa.String(length=40), nullable=False),
        sa.Column("total_score", sa.Integer(), nullable=False),
        sa.Column("criteria", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["deck_id"], ["decks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "deck_id",
            "deck_revision",
            "oracle_id",
            name="uq_card_rubric_score_revision_oracle",
        ),
    )
    for column in ("deck_id", "deck_revision", "oracle_id"):
        op.create_index(f"ix_card_rubric_scores_{column}", "card_rubric_scores", [column])
    op.create_table(
        "deck_guidance_proposals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("run_id", sa.Uuid(), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), nullable=False),
        sa.Column("deck_id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("expected_revision", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=False),
        sa.Column("proposed_goal", sa.Text(), nullable=True),
        sa.Column("proposed_rubric", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["conversation_id"], ["deck_conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["deck_id"], ["decks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["deck_agent_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("run_id", "conversation_id", "deck_id", "owner_id", "status"):
        op.create_index(f"ix_deck_guidance_proposals_{column}", "deck_guidance_proposals", [column])


def downgrade() -> None:
    op.drop_table("deck_guidance_proposals")
    op.drop_table("card_rubric_scores")
    op.drop_column("decks", "rubric")
    op.drop_column("decks", "goal")
