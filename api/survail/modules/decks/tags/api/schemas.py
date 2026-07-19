import uuid

from pydantic import Field, field_validator, model_validator

from survail.core.schemas import StrictModel


class DeckTagCreate(StrictModel):
    name: str = Field(min_length=1, max_length=100)
    target: float = Field(default=0, ge=0)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("name must not be blank")
        return cleaned


class DeckTagUpdate(StrictModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    target: float | None = Field(default=None, ge=0)

    @field_validator("name")
    @classmethod
    def clean_optional_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("name must not be blank")
        return cleaned

    @model_validator(mode="after")
    def has_update(self) -> "DeckTagUpdate":
        if self.name is None and self.target is None:
            raise ValueError("at least one tag field is required")
        return self


class CardsetTagUpdate(StrictModel):
    weight: float = 1

    @field_validator("weight")
    @classmethod
    def supported_weight(cls, value: float) -> float:
        if value not in {0.25, 0.5, 0.75, 1.0}:
            raise ValueError("weight must be one of 0.25, 0.5, 0.75, or 1")
        return value


class DeckTagReorder(StrictModel):
    tag_ids: list[uuid.UUID]


__all__ = ["CardsetTagUpdate", "DeckTagCreate", "DeckTagReorder", "DeckTagUpdate"]
