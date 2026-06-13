"""Replace user rubrics with system role evaluations.

Revision ID: 20260612_0015
Revises: 20260611_0014
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260612_0015"
down_revision: str | None = "20260611_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table("card_rubric_scores")
    op.drop_column("decks", "rubric")
    op.drop_column("deck_guidance_proposals", "proposed_rubric")
    op.create_table(
        "card_role_evaluations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("deck_id", sa.Uuid(), nullable=False),
        sa.Column("deck_revision", sa.Integer(), nullable=False),
        sa.Column("evaluator_version", sa.String(length=40), nullable=False),
        sa.Column("oracle_id", sa.String(length=40), nullable=False),
        sa.Column("overall_score", sa.Integer(), nullable=False),
        sa.Column("roles", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
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
            "evaluator_version",
            name="uq_card_role_evaluation_revision_oracle_version",
        ),
    )
    for column in ("deck_id", "deck_revision", "evaluator_version", "oracle_id"):
        op.create_index(f"ix_card_role_evaluations_{column}", "card_role_evaluations", [column])


def downgrade() -> None:
    op.drop_table("card_role_evaluations")
    op.add_column(
        "deck_guidance_proposals",
        sa.Column("proposed_rubric", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
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
    )
