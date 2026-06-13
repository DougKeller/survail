import uuid
from datetime import datetime

from pydantic import Field

from survail.core.schemas import StrictModel


class DeckGuidanceProposalRead(StrictModel):
    id: uuid.UUID
    deck_id: uuid.UUID
    expected_revision: int
    reason: str
    proposed_goal: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class DeckGuidanceProposalDecision(StrictModel):
    expected_revision: int = Field(ge=0)
