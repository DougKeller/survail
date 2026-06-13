import uuid
from decimal import Decimal

from pydantic import Field, field_validator, model_validator

from survail.core.models import CardFinish, CardZone, DeckFormat
from survail.core.schemas import ImportPrintingPreference, ScryfallCardSnapshot, StrictModel


class MoxfieldImportRequest(StrictModel):
    decklist: str = Field(min_length=1, max_length=100_000)
    preserve_tags: bool = False
    preserve_printings: bool = False
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
    used_ai_fallback: bool


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
