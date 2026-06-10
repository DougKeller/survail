import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from survail.models import CardFinish, CardFrame, CardZone, DeckFormat


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class ImageUris(StrictModel):
    small: str | None = None
    normal: str | None = None
    large: str | None = None
    png: str | None = None
    art_crop: str | None = None
    border_crop: str | None = None


class CardFace(StrictModel):
    name: str
    mana_cost: str
    type_line: str
    oracle_text: str | None = None
    colors: list[str] = Field(default_factory=list)
    power: str | None = None
    toughness: str | None = None
    loyalty: str | None = None
    image_uris: ImageUris | None = None


class CardPrices(StrictModel):
    usd: Decimal | None = None
    usd_foil: Decimal | None = None
    usd_etched: Decimal | None = None
    eur: Decimal | None = None
    eur_foil: Decimal | None = None
    tix: Decimal | None = None


class ScryfallCardSnapshot(StrictModel):
    id: str
    oracle_id: str
    name: str
    lang: str
    released_at: str | None = None
    layout: str
    mana_cost: str | None = None
    cmc: float
    type_line: str
    oracle_text: str | None = None
    colors: list[str] = Field(default_factory=list)
    color_identity: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    legalities: dict[str, str]
    set: str
    set_name: str
    collector_number: str
    rarity: str
    finishes: list[str] = Field(default_factory=list)
    prices: CardPrices = Field(default_factory=CardPrices)
    border_color: str = "black"
    frame: str = "2015"
    universes_beyond: bool = False
    image_uris: ImageUris | None = None
    card_faces: list[CardFace] = Field(default_factory=list)
    scryfall_uri: str


class GenericDeckMetadata(StrictModel):
    kind: Literal["generic"] = "generic"


class CommanderDeckMetadata(StrictModel):
    kind: Literal["commander"] = "commander"
    commander_oracle_ids: list[str] = Field(default_factory=list)


class BrawlDeckMetadata(StrictModel):
    kind: Literal["brawl"] = "brawl"
    commander_oracle_id: str


DeckMetadata = Annotated[
    GenericDeckMetadata | CommanderDeckMetadata | BrawlDeckMetadata,
    Field(discriminator="kind"),
]


class UserRead(StrictModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid", strict=True)

    id: uuid.UUID
    discord_id: str
    username: str
    display_name: str | None
    avatar_hash: str | None


class DeckOperationChangeCreate(StrictModel):
    printing_id: str = Field(min_length=1, max_length=40)
    quantity_delta: int
    zone: CardZone = Field(default=CardZone.MAINBOARD, strict=False)
    finish: CardFinish = Field(default=CardFinish.NONFOIL, strict=False)
    tags: list[str] | None = Field(default=None, max_length=50)

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
    deck: "DeckRead"
    validation: "DeckValidationRead"


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
    tags: list[str]
    scryfall: ScryfallCardSnapshot


class DeckCreate(StrictModel):
    title: str = Field(min_length=1, max_length=120)
    format: DeckFormat = Field(strict=False)
    description: str = ""
    metadata: DeckMetadata

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("title must not be blank")
        return value.strip()

    @model_validator(mode="after")
    def metadata_matches_format(self) -> "DeckCreate":
        from survail.domain.format_strategies import strategy_for

        strategy = strategy_for(self.format)
        if not strategy.metadata_matches(self.metadata):
            raise ValueError(f"{self.format.value} decks require {strategy.metadata_kind} metadata")
        return self


class DeckUpdate(StrictModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
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


class DeckRead(StrictModel):
    id: uuid.UUID
    title: str
    format: DeckFormat
    description: str
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
    description: str
    cached: bool


class CardSearchRead(StrictModel):
    cards: list[ScryfallCardSnapshot]
    total_cards: int
    has_more: bool


class NonUniversesBeyondPreference(StrictModel):
    kind: Literal["non_universes_beyond"]


class CheapestPreference(StrictModel):
    kind: Literal["cheapest"]
    buffer_percent: int = Field(default=15, ge=0, le=100)


class OriginalPrintingPreference(StrictModel):
    kind: Literal["original_printing"]


class FramePreference(StrictModel):
    kind: Literal["frame"]
    frame: CardFrame = Field(strict=False)


class FoilPreference(StrictModel):
    kind: Literal["foil"]


class NonfoilPreference(StrictModel):
    kind: Literal["nonfoil"]


ImportPrintingPreference = Annotated[
    NonUniversesBeyondPreference
    | CheapestPreference
    | OriginalPrintingPreference
    | FramePreference
    | FoilPreference
    | NonfoilPreference,
    Field(discriminator="kind"),
]


class CardSearchRequest(StrictModel):
    query: str = Field(min_length=1, max_length=500)
    printing_preferences: list[ImportPrintingPreference] = Field(default_factory=list, max_length=6)

    @field_validator("query")
    @classmethod
    def clean_query(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("query must not be blank")
        return value.strip()

    @model_validator(mode="after")
    def reject_duplicate_preferences(self) -> "CardSearchRequest":
        kinds = [preference.kind for preference in self.printing_preferences]
        if len(kinds) != len(set(kinds)):
            raise ValueError("printing_preferences must not contain duplicate rules")
        return self


class MoxfieldImportRequest(StrictModel):
    decklist: str = Field(min_length=1, max_length=100_000)
    preserve_tags: bool = False
    printing_preferences: list[ImportPrintingPreference] = Field(default_factory=list, max_length=6)
    default_zone: CardZone = Field(default=CardZone.MAINBOARD, strict=False)

    @model_validator(mode="after")
    def reject_duplicate_preferences(self) -> "MoxfieldImportRequest":
        kinds = [preference.kind for preference in self.printing_preferences]
        if len(kinds) != len(set(kinds)):
            raise ValueError("printing_preferences must not contain duplicate rules")
        return self


class ImportedCardSetRead(StrictModel):
    quantity: int
    printing_id: str
    oracle_id: str
    card_name: str
    set_code: str
    collector_number: str
    finish: CardFinish
    zone: CardZone
    tags: tuple[str, ...]
    source_lines: tuple[int, ...]
    selected_price_usd: Decimal | None
    printing_selection_reason: str
    scryfall: ScryfallCardSnapshot


class MoxfieldImportIssueRead(StrictModel):
    line_number: int
    raw_line: str
    code: str
    message: str


class MoxfieldImportPreviewRead(StrictModel):
    cardsets: list[ImportedCardSetRead]
    errors: list[MoxfieldImportIssueRead]


class MoxfieldDeckImportRequest(MoxfieldImportRequest):
    title: str = Field(min_length=1, max_length=120)
    format: DeckFormat = Field(strict=False)
    description: str = ""

    @field_validator("title")
    @classmethod
    def clean_import_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("title must not be blank")
        return value.strip()


class MoxfieldDeckImportRead(StrictModel):
    deck_id: uuid.UUID
    operation_id: uuid.UUID
    revision: int
    preview: MoxfieldImportPreviewRead


class CloneDeckRequest(StrictModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
