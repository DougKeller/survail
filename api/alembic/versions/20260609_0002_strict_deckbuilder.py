"""Replace prototype deck rows with strict cardsets.

Revision ID: 20260609_0002
Revises: 20260608_0001
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260609_0002"
down_revision: str | Sequence[str] | None = "20260608_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    deck_format = sa.Enum(
        "COMMANDER",
        "BRAWL",
        "STANDARD",
        "MODERN",
        "PIONEER",
        "LEGACY",
        "VINTAGE",
        "PAUPER",
        name="deck_format",
    )
    card_zone = sa.Enum("MAINBOARD", "SIDEBOARD", "COMMANDER", "COMPANION", name="card_zone")
    card_finish = sa.Enum("NONFOIL", "FOIL", "ETCHED", name="card_finish")
    deck_format.create(op.get_bind(), checkfirst=True)

    op.drop_table("deck_cards")
    op.alter_column("decks", "name", new_column_name="title")
    op.alter_column("decks", "strategy", new_column_name="metadata")
    op.execute(
        "UPDATE decks SET metadata = CASE "
        'WHEN format = \'commander\' THEN \'{"kind":"commander","commander_oracle_ids":[]}\'::json '
        'WHEN format = \'brawl\' THEN \'{"kind":"brawl","commander_oracle_id":""}\'::json '
        'ELSE \'{"kind":"generic"}\'::json END'
    )
    op.execute(
        "UPDATE decks SET format = 'standard' "
        "WHERE lower(format) NOT IN "
        "('commander', 'brawl', 'standard', 'modern', 'pioneer', 'legacy', 'vintage', 'pauper')"
    )
    op.alter_column(
        "decks",
        "format",
        type_=deck_format,
        postgresql_using="upper(format)::deck_format",
    )
    op.add_column(
        "decks", sa.Column("is_sample", sa.Boolean(), server_default=sa.false(), nullable=False)
    )
    op.create_index(op.f("ix_decks_is_sample"), "decks", ["is_sample"], unique=False)

    op.create_table(
        "cardsets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("deck_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("zone", card_zone, nullable=False),
        sa.Column("finish", card_finish, nullable=False),
        sa.Column("printing_id", sa.String(length=40), nullable=False),
        sa.Column("oracle_id", sa.String(length=40), nullable=False),
        sa.Column("card_name", sa.String(length=200), nullable=False),
        sa.Column("set_code", sa.String(length=10), nullable=False),
        sa.Column("collector_number", sa.String(length=32), nullable=False),
        sa.Column("scryfall", sa.JSON(), nullable=False),
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
        sa.CheckConstraint("quantity > 0 AND quantity <= 250", name="ck_cardset_quantity"),
        sa.ForeignKeyConstraint(["deck_id"], ["decks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("deck_id", "printing_id", "oracle_id", "card_name"):
        op.create_index(op.f(f"ix_cardsets_{column}"), "cardsets", [column], unique=False)


def downgrade() -> None:
    raise RuntimeError("The strict deckbuilder migration is intentionally irreversible")
