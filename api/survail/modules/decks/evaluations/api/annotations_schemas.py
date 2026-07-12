import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator, model_validator

from survail.core.schemas import StrictModel

RatingValue = Literal["very_low", "low", "neutral", "high", "very_high"]


class CriterionLabel(StrictModel):
    expected_rating: RatingValue
    acceptable_min: RatingValue | None = None
    acceptable_max: RatingValue | None = None

    @model_validator(mode="after")
    def validate_range(self) -> "CriterionLabel":
        ordered = ["very_low", "low", "neutral", "high", "very_high"]
        minimum = self.acceptable_min or self.expected_rating
        maximum = self.acceptable_max or self.expected_rating
        if ordered.index(minimum) > ordered.index(maximum):
            raise ValueError("acceptable_min must not be greater than acceptable_max")
        if not (ordered.index(minimum) <= ordered.index(self.expected_rating) <= ordered.index(maximum)):
            raise ValueError("expected_rating must be within the acceptable range")
        return self


class RoleLabel(StrictModel):
    role: str = Field(min_length=1, max_length=64)
    notes: str | None = Field(default=None, max_length=2000)
    criteria: dict[str, CriterionLabel] = Field(default_factory=dict)


class RoleAnnotationLabelUpsert(StrictModel):
    roles: list[RoleLabel] = Field(default_factory=list)

    @field_validator("roles")
    @classmethod
    def unique_roles(cls, value: list[RoleLabel]) -> list[RoleLabel]:
        roles = [item.role for item in value]
        if len(roles) != len(set(roles)):
            raise ValueError("roles must be unique")
        return value


class RoleAnnotationLabelRead(StrictModel):
    roles: list[RoleLabel]


class RoleAnnotationCaptureRead(StrictModel):
    id: uuid.UUID
    deck_id: uuid.UUID
    oracle_id: str
    deck_revision: int
    evaluator_version: str
    model: str
    system_prompt: str
    input_text: str
    output: dict[str, object]
    created_at: datetime
    labeled_at: datetime | None
    label: RoleAnnotationLabelRead | None


class RoleAnnotationQueueRead(StrictModel):
    unlabeled: list[RoleAnnotationCaptureRead]
    labeled: list[RoleAnnotationCaptureRead]


class MetricSummaryRead(StrictModel):
    count: int
    accuracy: float | None
    recall: float | None
    specificity: float | None
    precision: float | None
    npv: float | None
    fpr: float | None
    fnr: float | None
    average_partial_credit: float | None = None


class CriterionMetricRead(StrictModel):
    role: str
    criterion: str
    metrics: MetricSummaryRead


class SandboxExampleResultRead(StrictModel):
    capture_id: uuid.UUID
    oracle_id: str
    predicted_roles: list[str]
    expected_roles: list[str]
    role_metrics: dict[str, str]
    criterion_partial_credit: float | None


class SandboxRunRead(StrictModel):
    id: uuid.UUID
    model: str
    system_prompt: str
    example_count: int
    created_at: datetime
    overall_role_metrics: MetricSummaryRead
    role_metrics: dict[str, MetricSummaryRead]
    criterion_metrics: list[CriterionMetricRead]
    results: list[SandboxExampleResultRead]


class SandboxRunCreate(StrictModel):
    system_prompt: str = Field(min_length=1, max_length=12000)
    model: str = Field(min_length=1, max_length=80)

