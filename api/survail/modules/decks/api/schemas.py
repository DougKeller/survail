import uuid
from datetime import datetime

from pydantic import ConfigDict, Field, field_validator, model_validator

from survail.core.models import CardFinish, CardZone, DeckFormat
from survail.core.schemas import DeckMetadata, ScryfallCardSnapshot, StrictModel


class CardSetRead(StrictModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid", strict=True)

    id: uuid.UUID
    quantity: int
    zone: CardZone
    finish: CardFinish
    printing_id: str
    oracle_id: str
    card_name: str
    set_code: str
    collector_number: str
    core: bool
    tags: list[str]
    scryfall: ScryfallCardSnapshot


class DeckCreate(StrictModel):
    title: str = Field(min_length=1, max_length=120)
    format: DeckFormat = Field(strict=False)
    description: str = ""
    goal: str = Field(default="", max_length=5000)
    metadata: DeckMetadata

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("title must not be blank")
        return value.strip()

    @field_validator("goal")
    @classmethod
    def clean_goal(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def metadata_matches_format(self) -> "DeckCreate":
        required_kind = {"commander": "commander", "brawl": "brawl"}.get(
            self.format.value, "generic"
        )
        if self.metadata.kind != required_kind:
            raise ValueError(f"{self.format.value} decks require {required_kind} metadata")
        return self


class DeckUpdate(StrictModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    goal: str | None = Field(default=None, max_length=5000)
    metadata: DeckMetadata | None = None

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> "DeckUpdate":
        for field in self.model_fields_set:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value.strip():
            raise ValueError("title must not be blank")
        return value.strip()

    @field_validator("goal")
    @classmethod
    def clean_optional_goal(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class GeneratedDeckDescriptionContentRead(StrictModel):
    overview: str
    early_game: str
    midgame: str
    lategame: str


class DeckRead(StrictModel):
    id: uuid.UUID
    title: str
    format: DeckFormat
    description: str
    goal: str
    generated_description: GeneratedDeckDescriptionContentRead | None
    metadata: DeckMetadata
    cardsets: list[CardSetRead]
    is_sample: bool
    revision: int
    created_at: datetime
    updated_at: datetime


class ValidationErrorRead(StrictModel):
    error_id: str
    code: str
    message: str
    cardset_id: uuid.UUID | None = None


class DeckValidationRead(StrictModel):
    valid: bool
    card_count: int
    errors: list[ValidationErrorRead]


class GeneratedDeckDescriptionRead(StrictModel):
    deck_id: uuid.UUID
    revision: int
    description: GeneratedDeckDescriptionContentRead
    cached: bool


class CloneDeckRequest(StrictModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
