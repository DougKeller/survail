import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from survail.db import Base
from survail.types import JsonObject


class DeckFormat(StrEnum):
    COMMANDER = "commander"
    BRAWL = "brawl"
    STANDARD = "standard"
    MODERN = "modern"
    PIONEER = "pioneer"
    LEGACY = "legacy"
    VINTAGE = "vintage"
    PAUPER = "pauper"


class CardZone(StrEnum):
    MAINBOARD = "mainboard"
    SIDEBOARD = "sideboard"
    COMMANDER = "commander"
    COMPANION = "companion"
    CONSIDERING = "considering"


class CardFinish(StrEnum):
    NONFOIL = "nonfoil"
    FOIL = "foil"
    ETCHED = "etched"


class CardFrame(StrEnum):
    ORIGINAL = "1993"
    CLASSIC = "1997"
    MODERN = "2003"
    CURRENT = "2015"
    FUTURE = "future"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    discord_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(100))
    display_name: Mapped[str | None] = mapped_column(String(100))
    avatar_hash: Mapped[str | None] = mapped_column(String(100))

    decks: Mapped[list["Deck"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    sessions: Mapped[list["UserSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="sessions")


class Deck(TimestampMixin, Base):
    __tablename__ = "decks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(120))
    format: Mapped[DeckFormat] = mapped_column(Enum(DeckFormat, name="deck_format"), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    metadata_json: Mapped[JsonObject] = mapped_column("metadata", JSON, default=dict)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    revision: Mapped[int] = mapped_column(Integer, default=0)

    owner: Mapped[User] = relationship(back_populates="decks")
    cardsets: Mapped[list["CardSet"]] = relationship(
        back_populates="deck", cascade="all, delete-orphan", order_by="CardSet.card_name"
    )
    operations: Mapped[list["DeckOperation"]] = relationship(
        back_populates="deck", cascade="all, delete-orphan"
    )


class CardSet(TimestampMixin, Base):
    __tablename__ = "cardsets"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_cardset_quantity"),
        UniqueConstraint(
            "deck_id",
            "printing_id",
            "finish",
            "zone",
            name="uq_cardset_identity",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    deck_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"), index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    zone: Mapped[CardZone] = mapped_column(
        Enum(CardZone, name="card_zone"), default=CardZone.MAINBOARD
    )
    finish: Mapped[CardFinish] = mapped_column(
        Enum(CardFinish, name="card_finish"), default=CardFinish.NONFOIL
    )
    printing_id: Mapped[str] = mapped_column(String(40), index=True)
    oracle_id: Mapped[str] = mapped_column(String(40), index=True)
    card_name: Mapped[str] = mapped_column(String(200), index=True)
    set_code: Mapped[str] = mapped_column(String(10))
    collector_number: Mapped[str] = mapped_column(String(32))
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    scryfall: Mapped[JsonObject] = mapped_column(JSON)

    deck: Mapped[Deck] = relationship(back_populates="cardsets")


class DeckOperation(Base):
    __tablename__ = "deck_operations"
    __table_args__ = (
        UniqueConstraint("deck_id", "client_operation_id", name="uq_deck_operation_client_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    deck_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"), index=True
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    client_operation_id: Mapped[uuid.UUID]
    request_hash: Mapped[str] = mapped_column(String(64))
    reason: Mapped[str | None] = mapped_column(String(500))
    revision_before: Mapped[int]
    revision_after: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    deck: Mapped[Deck] = relationship(back_populates="operations")
    changes: Mapped[list["DeckOperationChange"]] = relationship(
        back_populates="operation", cascade="all, delete-orphan", order_by="DeckOperationChange.id"
    )


class DeckOperationChange(Base):
    __tablename__ = "deck_operation_changes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    operation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deck_operations.id", ondelete="CASCADE"), index=True
    )
    printing_id: Mapped[str] = mapped_column(String(40), index=True)
    oracle_id: Mapped[str] = mapped_column(String(40), index=True)
    card_name: Mapped[str] = mapped_column(String(200))
    set_code: Mapped[str] = mapped_column(String(10))
    collector_number: Mapped[str] = mapped_column(String(32))
    finish: Mapped[CardFinish] = mapped_column(Enum(CardFinish, name="card_finish"))
    zone: Mapped[CardZone] = mapped_column(Enum(CardZone, name="card_zone"))
    quantity_delta: Mapped[int]
    quantity_before: Mapped[int]
    quantity_after: Mapped[int]
    tags_before: Mapped[list[str]] = mapped_column(JSON, default=list)
    tags_after: Mapped[list[str]] = mapped_column(JSON, default=list)

    operation: Mapped[DeckOperation] = relationship(back_populates="changes")


class CatalogCard(Base):
    __tablename__ = "catalog_cards"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    oracle_id: Mapped[str] = mapped_column(String(40), index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    lang: Mapped[str] = mapped_column(String(12), index=True)
    layout: Mapped[str] = mapped_column(String(40))
    cmc: Mapped[float] = mapped_column(index=True)
    type_line: Mapped[str] = mapped_column(Text)
    oracle_text: Mapped[str | None] = mapped_column(Text)
    colors: Mapped[list[str]] = mapped_column(JSONB)
    color_identity: Mapped[list[str]] = mapped_column(JSONB)
    keywords: Mapped[list[str]] = mapped_column(JSONB)
    legalities: Mapped[dict[str, str]] = mapped_column(JSONB)
    set_code: Mapped[str] = mapped_column(String(10), index=True)
    set_name: Mapped[str] = mapped_column(String(200))
    collector_number: Mapped[str] = mapped_column(String(32))
    rarity: Mapped[str] = mapped_column(String(20), index=True)
    finishes: Mapped[list[str]] = mapped_column(JSONB)
    usd: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), index=True)
    usd_foil: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    usd_etched: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    eur: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    eur_foil: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    tix: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    border_color: Mapped[str] = mapped_column(String(20), index=True)
    frame: Mapped[str] = mapped_column(String(20), index=True)
    universes_beyond: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    released_at: Mapped[str | None] = mapped_column(String(10), index=True)
    snapshot: Mapped[JsonObject] = mapped_column(JSONB)


class CatalogImport(Base):
    __tablename__ = "catalog_imports"

    bulk_type: Mapped[str] = mapped_column(String(40), primary_key=True)
    source_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    card_count: Mapped[int] = mapped_column(Integer)


class OracleEmbedding(Base):
    __tablename__ = "oracle_embeddings"

    oracle_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    model: Mapped[str] = mapped_column(String(100), index=True)
    source_text: Mapped[str] = mapped_column(Text)
    source_hash: Mapped[str] = mapped_column(String(64), index=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(3072))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
