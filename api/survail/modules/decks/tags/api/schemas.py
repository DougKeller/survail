import uuid

from pydantic import Field, field_validator

from survail.core.schemas import StrictModel


class DeckTagCreate(StrictModel):
    name: str = Field(min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("name must not be blank")
        return cleaned


class DeckTagUpdate(DeckTagCreate):
    pass


class DeckTagReorder(StrictModel):
    tag_ids: list[uuid.UUID]


__all__ = ["DeckTagCreate", "DeckTagReorder", "DeckTagUpdate"]
