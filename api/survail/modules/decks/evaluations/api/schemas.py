from typing import Literal

from pydantic import Field, field_validator

from survail.core.schemas import StrictModel


class QualitativeAnswerRead(StrictModel):
    criterion_id: str
    rating: Literal["very_low", "low", "neutral", "high", "very_high"]
    score: int = Field(ge=0, le=100)


class CardRoleScoreRead(StrictModel):
    role: Literal[
        "land",
        "mana_ramp",
        "card_advantage",
        "removal",
        "board_wipe",
        "enabler",
        "enhancer",
        "payoff",
    ]
    score: int = Field(ge=0, le=100)
    description: str
    answers: list[QualitativeAnswerRead]


class CardRoleEvaluationRead(StrictModel):
    oracle_id: str
    deck_revision: int
    evaluator_version: str
    overall_score: int = Field(ge=0)
    overall_comment: str
    roles: list[CardRoleScoreRead]
    cached: bool


class CardRoleEvaluationRequest(StrictModel):
    oracle_ids: list[str] = Field(min_length=1, max_length=200)

    @field_validator("oracle_ids")
    @classmethod
    def clean_oracle_ids(cls, value: list[str]) -> list[str]:
        cleaned = [oracle_id.strip() for oracle_id in value]
        if any(not oracle_id or len(oracle_id) > 40 for oracle_id in cleaned):
            raise ValueError("oracle_ids must be non-blank and at most 40 characters")
        return list(dict.fromkeys(cleaned))
