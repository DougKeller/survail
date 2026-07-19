"""Add first-class deck-owned card tags.

Revision ID: 20260719_0027
Revises: 20260718_0026
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260719_0027"
down_revision: str | None = "20260718_0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "deck_tags",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("deck_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
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
        sa.CheckConstraint("position >= 0", name="ck_deck_tag_position"),
        sa.ForeignKeyConstraint(["deck_id"], ["decks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("deck_id", "name", name="uq_deck_tag_name"),
        sa.UniqueConstraint("deck_id", "position", name="uq_deck_tag_position"),
    )
    op.create_index(op.f("ix_deck_tags_deck_id"), "deck_tags", ["deck_id"], unique=False)
    op.create_table(
        "cardset_deck_tags",
        sa.Column("cardset_id", sa.Uuid(), nullable=False),
        sa.Column("deck_tag_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["cardset_id"], ["cardsets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["deck_tag_id"], ["deck_tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("cardset_id", "deck_tag_id"),
    )
    op.create_index(
        op.f("ix_cardset_deck_tags_deck_tag_id"),
        "cardset_deck_tags",
        ["deck_tag_id"],
        unique=False,
    )

    # Preserve imported Moxfield tags already stored on cardsets. IDs are
    # deterministic per deck/name so rerunning a recovered migration is safe.
    op.execute(
        """
        WITH normalized AS (
            SELECT cardsets.deck_id, trim(raw_tag.value) AS name
            FROM cardsets
            CROSS JOIN LATERAL json_array_elements_text(
                COALESCE(cardsets.tags, '[]'::json)
            ) AS raw_tag(value)
            WHERE trim(raw_tag.value) <> ''
        ), deduplicated AS (
            SELECT deck_id, lower(name) AS normalized_name, min(name) AS name
            FROM normalized
            GROUP BY deck_id, lower(name)
        ), ordered AS (
            SELECT
                deck_id,
                normalized_name,
                name,
                row_number() OVER (PARTITION BY deck_id ORDER BY normalized_name) - 1 AS position
            FROM deduplicated
        )
        INSERT INTO deck_tags (id, deck_id, name, position)
        SELECT
            md5(deck_id::text || ':' || normalized_name)::uuid,
            deck_id,
            name,
            position
        FROM ordered
        """
    )
    op.execute(
        """
        INSERT INTO cardset_deck_tags (cardset_id, deck_tag_id)
        SELECT DISTINCT cardsets.id, deck_tags.id
        FROM cardsets
        CROSS JOIN LATERAL json_array_elements_text(
            COALESCE(cardsets.tags, '[]'::json)
        ) AS raw_tag(value)
        JOIN deck_tags
          ON deck_tags.deck_id = cardsets.deck_id
         AND lower(deck_tags.name) = lower(trim(raw_tag.value))
        WHERE trim(raw_tag.value) <> ''
        """
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_cardset_deck_tags_deck_tag_id"),
        table_name="cardset_deck_tags",
    )
    op.drop_table("cardset_deck_tags")
    op.drop_index(op.f("ix_deck_tags_deck_id"), table_name="deck_tags")
    op.drop_table("deck_tags")
