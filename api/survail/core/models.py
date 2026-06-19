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

from survail.core.db import Base
from survail.core.types import JsonObject


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
    deck_conversations: Mapped[list["DeckConversation"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
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
    goal: Mapped[str] = mapped_column(Text, default="")
    generated_description: Mapped[str] = mapped_column(Text, default="")
    generated_description_revision: Mapped[int | None] = mapped_column(Integer, default=None)
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
    conversations: Mapped[list["DeckConversation"]] = relationship(
        back_populates="deck", cascade="all, delete-orphan"
    )
    role_evaluations: Mapped[list["CardRoleEvaluation"]] = relationship(
        back_populates="deck", cascade="all, delete-orphan"
    )
    guidance_proposals: Mapped[list["DeckGuidanceProposal"]] = relationship(
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
    core: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
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


class DeckConversation(TimestampMixin, Base):
    __tablename__ = "deck_conversations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    deck_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"), index=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    deck: Mapped[Deck] = relationship(back_populates="conversations")
    owner: Mapped[User] = relationship(back_populates="deck_conversations")
    messages: Mapped[list["DeckConversationMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="DeckConversationMessage.created_at",
    )
    runs: Mapped[list["DeckAgentRun"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class DeckConversationMessage(Base):
    __tablename__ = "deck_conversation_messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deck_conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    conversation: Mapped[DeckConversation] = relationship(back_populates="messages")


class DeckAgentRun(TimestampMixin, Base):
    __tablename__ = "deck_agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deck_conversations.id", ondelete="CASCADE"), index=True
    )
    deck_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"), index=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(32), index=True)
    deck_revision_started: Mapped[int]
    sdk_state: Mapped[JsonObject | None] = mapped_column(JSONB)
    error: Mapped[str | None] = mapped_column(Text)

    conversation: Mapped[DeckConversation] = relationship(back_populates="runs")
    events: Mapped[list["DeckAgentEvent"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="DeckAgentEvent.sequence"
    )
    proposals: Mapped[list["DeckOperationProposal"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )


class DeckAgentEvent(Base):
    __tablename__ = "deck_agent_events"
    __table_args__ = (UniqueConstraint("run_id", "sequence", name="uq_deck_agent_event_sequence"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deck_agent_runs.id", ondelete="CASCADE"), index=True
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deck_conversations.id", ondelete="CASCADE"), index=True
    )
    sequence: Mapped[int]
    event_type: Mapped[str] = mapped_column(String(50), index=True)
    payload: Mapped[JsonObject] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    run: Mapped[DeckAgentRun] = relationship(back_populates="events")


class DeckOperationProposal(TimestampMixin, Base):
    __tablename__ = "deck_operation_proposals"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deck_agent_runs.id", ondelete="CASCADE"), index=True
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deck_conversations.id", ondelete="CASCADE"), index=True
    )
    deck_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"), index=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    expected_revision: Mapped[int]
    reason: Mapped[str] = mapped_column(String(500))
    changes: Mapped[JsonObject] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(24), index=True)
    operation_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("deck_operations.id", ondelete="SET NULL"), index=True
    )

    run: Mapped[DeckAgentRun] = relationship(back_populates="proposals")


class CardRoleEvaluation(TimestampMixin, Base):
    __tablename__ = "card_role_evaluations"
    __table_args__ = (
        UniqueConstraint(
            "deck_id",
            "context_key",
            "evaluator_version",
            name="uq_card_role_evaluation_context_version",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    deck_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"), index=True
    )
    deck_revision: Mapped[int] = mapped_column(Integer, index=True)
    context_key: Mapped[str] = mapped_column(String(64), index=True)
    evaluator_version: Mapped[str] = mapped_column(String(40), index=True)
    oracle_id: Mapped[str] = mapped_column(String(40), index=True)
    overall_score: Mapped[int] = mapped_column(Integer)
    overall_comment: Mapped[str] = mapped_column(Text)
    roles: Mapped[list[JsonObject]] = mapped_column(JSONB)

    deck: Mapped[Deck] = relationship(back_populates="role_evaluations")


class DeckGuidanceProposal(TimestampMixin, Base):
    __tablename__ = "deck_guidance_proposals"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deck_agent_runs.id", ondelete="CASCADE"), index=True
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("deck_conversations.id", ondelete="CASCADE"), index=True
    )
    deck_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("decks.id", ondelete="CASCADE"), index=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    expected_revision: Mapped[int]
    reason: Mapped[str] = mapped_column(String(500))
    proposed_goal: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), index=True)

    deck: Mapped[Deck] = relationship(back_populates="guidance_proposals")


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
