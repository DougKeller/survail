from pydantic import Field

from survail.core.schemas import StrictModel


class JudgeGoldenExpectationRead(StrictModel):
    must_roles: list[str] = Field(default_factory=list)
    forbid_roles: list[str] = Field(default_factory=list)
    role_score_ranges: dict[str, list[int]] = Field(default_factory=dict)
    overall_range: list[int] = Field(default_factory=lambda: [0, 100])


class JudgeRoleRead(StrictModel):
    role: str
    score: int
    description: str
    answers: dict[str, str]


class JudgeResultRead(StrictModel):
    overall_score: int
    overall_comment: str
    roles: list[JudgeRoleRead]


class JudgeReferenceCardRead(StrictModel):
    name: str
    image_uri: str | None = None
    mana_cost: str | None = None
    type_line: str | None = None
    expectation: JudgeGoldenExpectationRead
    result: JudgeResultRead | None = None
    passed: bool
    failures: list[str] = Field(default_factory=list)


class JudgeReferenceRead(StrictModel):
    evaluator_version: str
    model: str
    min_pass_rate: float
    pass_rate: float
    passed_cards: int
    total_cards: int
    deck_title: str
    deck_goal: str
    cards: list[JudgeReferenceCardRead]
