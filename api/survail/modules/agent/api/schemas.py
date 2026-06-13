import uuid
from datetime import datetime

from pydantic import Field, field_validator

from survail.core.schemas import StrictModel
from survail.core.types import JsonObject


class DeckConversationRead(StrictModel):
    id: uuid.UUID
    deck_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class DeckAgentMessageCreate(StrictModel):
    message: str = Field(min_length=1, max_length=10_000)

    @field_validator("message")
    @classmethod
    def clean_message(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("message must not be blank")
        return value.strip()


class DeckAgentEventRead(StrictModel):
    id: uuid.UUID
    run_id: uuid.UUID
    sequence: int
    event_type: str
    payload: JsonObject
    created_at: datetime
