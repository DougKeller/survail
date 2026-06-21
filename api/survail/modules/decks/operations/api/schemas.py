from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field, field_validator

from survail.core.models import CardFinish, CardZone
from survail.core.schemas import (
    DeckOperationProposalDecision,
    DeckOperationProposalRead,
    StrictModel,
)
from survail.modules.decks.contracts import DeckRead, DeckValidationRead


class DeckOperationChangeCreate(StrictModel):
    printing_id: str = Field(min_length=1, max_length=40)
    quantity_delta: int
    zone: CardZone = Field(default=CardZone.MAINBOARD, strict=False)
    finish: CardFinish = Field(default=CardFinish.NONFOIL, strict=False)
    tags: list[str] | None = Field(default=None, max_length=50)
    note: str | None = Field(default=None, max_length=2000)

    @field_validator("quantity_delta")
    @classmethod
    def reject_zero_delta(cls, value: int) -> int:
        if value == 0:
            raise ValueError("quantity_delta must not be zero")
        return value

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = [tag.strip() for tag in value]
        if any(not tag or len(tag) > 100 for tag in cleaned):
            raise ValueError("tags must be non-blank and at most 100 characters")
        return list(dict.fromkeys(cleaned))

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


class DeckOperationCreate(StrictModel):
    client_operation_id: uuid.UUID = Field(strict=False)
    reason: str | None = Field(default=None, min_length=1, max_length=500)
    expected_revision: int | None = Field(default=None, ge=0)
    changes: list[DeckOperationChangeCreate] = Field(min_length=1, max_length=500)


class DeckOperationRevertCreate(StrictModel):
    client_operation_id: uuid.UUID = Field(strict=False)
    expected_revision: int = Field(ge=0)
    reason: str | None = Field(default=None, min_length=1, max_length=500)


class DeckOperationChangeRead(StrictModel):
    printing_id: str
    oracle_id: str
    card_name: str
    set_code: str
    collector_number: str
    finish: CardFinish
    zone: CardZone
    quantity_delta: int
    quantity_before: int
    quantity_after: int
    tags_before: list[str]
    tags_after: list[str]


class DeckOperationRead(StrictModel):
    id: uuid.UUID
    deck_id: uuid.UUID
    actor_id: uuid.UUID
    client_operation_id: uuid.UUID
    reason: str | None
    revision_before: int
    revision_after: int
    created_at: datetime
    changes: list[DeckOperationChangeRead]


class DeckOperationResult(StrictModel):
    operation: DeckOperationRead
    deck: DeckRead
    validation: DeckValidationRead


class CardSetCoreUpdate(StrictModel):
    core: bool


class CardSetNoteUpdate(StrictModel):
    note: str = Field(default="", max_length=2000)

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: str) -> str:
        return value.strip()


__all__ = [
    "CardSetCoreUpdate",
    "CardSetNoteUpdate",
    "DeckOperationChangeCreate",
    "DeckOperationChangeRead",
    "DeckOperationCreate",
    "DeckOperationProposalDecision",
    "DeckOperationProposalRead",
    "DeckOperationRead",
    "DeckOperationResult",
    "DeckOperationRevertCreate",
]
