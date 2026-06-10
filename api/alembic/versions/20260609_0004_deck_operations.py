"""Add atomic deck operations and immutable history.

Revision ID: 20260609_0004
Revises: 20260609_0003
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260609_0004"
down_revision: str | Sequence[str] | None = "20260609_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE card_zone ADD VALUE IF NOT EXISTS 'CONSIDERING'")
    op.add_column("decks", sa.Column("revision", sa.Integer(), server_default="0", nullable=False))
    op.drop_constraint("ck_cardset_quantity", "cardsets", type_="check")
    op.create_check_constraint("ck_cardset_quantity", "cardsets", "quantity > 0")
    op.execute(
        """
        WITH grouped AS (
            SELECT deck_id, printing_id, finish, zone,
                   min(id::text)::uuid AS keeper_id, sum(quantity) AS total_quantity
            FROM cardsets
            GROUP BY deck_id, printing_id, finish, zone
        )
        UPDATE cardsets AS cardset
        SET quantity = grouped.total_quantity
        FROM grouped
        WHERE cardset.id = grouped.keeper_id
        """
    )
    op.execute(
        """
        DELETE FROM cardsets AS cardset
        USING (
            SELECT deck_id, printing_id, finish, zone, min(id::text)::uuid AS keeper_id
            FROM cardsets
            GROUP BY deck_id, printing_id, finish, zone
        ) AS grouped
        WHERE cardset.deck_id = grouped.deck_id
          AND cardset.printing_id = grouped.printing_id
          AND cardset.finish = grouped.finish
          AND cardset.zone = grouped.zone
          AND cardset.id <> grouped.keeper_id
        """
    )
    op.create_unique_constraint(
        "uq_cardset_identity", "cardsets", ["deck_id", "printing_id", "finish", "zone"]
    )
    op.create_table(
        "deck_operations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("deck_id", sa.Uuid(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("client_operation_id", sa.Uuid(), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("revision_before", sa.Integer(), nullable=False),
        sa.Column("revision_after", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["deck_id"], ["decks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("deck_id", "client_operation_id", name="uq_deck_operation_client_id"),
    )
    op.create_index("ix_deck_operations_actor_id", "deck_operations", ["actor_id"])
    op.create_index("ix_deck_operations_created_at", "deck_operations", ["created_at"])
    op.create_index("ix_deck_operations_deck_id", "deck_operations", ["deck_id"])
    op.create_table(
        "deck_operation_changes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("operation_id", sa.Uuid(), nullable=False),
        sa.Column("printing_id", sa.String(length=40), nullable=False),
        sa.Column("oracle_id", sa.String(length=40), nullable=False),
        sa.Column("card_name", sa.String(length=200), nullable=False),
        sa.Column("set_code", sa.String(length=10), nullable=False),
        sa.Column("collector_number", sa.String(length=32), nullable=False),
        sa.Column(
            "finish",
            postgresql.ENUM(name="card_finish", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "zone",
            postgresql.ENUM(name="card_zone", create_type=False),
            nullable=False,
        ),
        sa.Column("quantity_delta", sa.Integer(), nullable=False),
        sa.Column("quantity_before", sa.Integer(), nullable=False),
        sa.Column("quantity_after", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["operation_id"], ["deck_operations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_deck_operation_changes_operation_id", "deck_operation_changes", ["operation_id"]
    )
    op.create_index("ix_deck_operation_changes_oracle_id", "deck_operation_changes", ["oracle_id"])
    op.create_index(
        "ix_deck_operation_changes_printing_id", "deck_operation_changes", ["printing_id"]
    )


def downgrade() -> None:
    op.drop_table("deck_operation_changes")
    op.drop_table("deck_operations")
    op.drop_constraint("uq_cardset_identity", "cardsets", type_="unique")
    op.drop_constraint("ck_cardset_quantity", "cardsets", type_="check")
    op.create_check_constraint(
        "ck_cardset_quantity", "cardsets", "quantity > 0 AND quantity <= 250"
    )
    op.drop_column("decks", "revision")
