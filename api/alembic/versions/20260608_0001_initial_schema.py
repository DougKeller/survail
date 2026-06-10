"""Create the initial Survail schema.

Revision ID: 20260608_0001
Revises:
Create Date: 2026-06-08

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260608_0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("discord_id", sa.String(length=32), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=True),
        sa.Column("avatar_hash", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_discord_id"), "users", ["discord_id"], unique=True)

    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_user_sessions_token_hash"), "user_sessions", ["token_hash"], unique=True
    )
    op.create_index(op.f("ix_user_sessions_user_id"), "user_sessions", ["user_id"], unique=False)

    op.create_table(
        "decks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("format", sa.String(length=40), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("strategy", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_decks_format"), "decks", ["format"], unique=False)
    op.create_index(op.f("ix_decks_owner_id"), "decks", ["owner_id"], unique=False)

    op.create_table(
        "deck_cards",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("deck_id", sa.Uuid(), nullable=False),
        sa.Column("scryfall_id", sa.String(length=40), nullable=False),
        sa.Column("oracle_id", sa.String(length=40), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("is_commander", sa.Boolean(), nullable=False),
        sa.Column("card_data", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["deck_id"], ["decks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("quantity > 0 AND quantity <= 99", name="ck_deck_card_quantity"),
        sa.UniqueConstraint("deck_id", "oracle_id", name="uq_deck_card_oracle"),
        sa.UniqueConstraint("deck_id", "scryfall_id", name="uq_deck_card_scryfall"),
    )
    op.create_index(op.f("ix_deck_cards_deck_id"), "deck_cards", ["deck_id"], unique=False)
    op.create_index(op.f("ix_deck_cards_name"), "deck_cards", ["name"], unique=False)
    op.create_index(op.f("ix_deck_cards_oracle_id"), "deck_cards", ["oracle_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_deck_cards_oracle_id"), table_name="deck_cards")
    op.drop_index(op.f("ix_deck_cards_name"), table_name="deck_cards")
    op.drop_index(op.f("ix_deck_cards_deck_id"), table_name="deck_cards")
    op.drop_table("deck_cards")
    op.drop_index(op.f("ix_decks_owner_id"), table_name="decks")
    op.drop_index(op.f("ix_decks_format"), table_name="decks")
    op.drop_table("decks")
    op.drop_index(op.f("ix_user_sessions_user_id"), table_name="user_sessions")
    op.drop_index(op.f("ix_user_sessions_token_hash"), table_name="user_sessions")
    op.drop_table("user_sessions")
    op.drop_index(op.f("ix_users_discord_id"), table_name="users")
    op.drop_table("users")
    op.execute("DROP EXTENSION IF EXISTS vector")
