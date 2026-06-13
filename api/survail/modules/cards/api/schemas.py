from pydantic import Field, field_validator, model_validator

from survail.core.schemas import (
    ImportPrintingPreference,
    ScryfallCardSnapshot,
    StrictModel,
)


class CardSearchRead(StrictModel):
    cards: list[ScryfallCardSnapshot]
    total_cards: int
    has_more: bool


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
