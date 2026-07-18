"""Read the judge spot-check artifacts (scripts/judge_eval_*.json) for display.

The golden dataset, latest results snapshot, and card snapshots are maintained
by scripts/judge_eval.py; this service loads them and recomputes the same
per-card pass/fail verdicts the harness check applies.
"""

import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict

from survail.modules.decks.evaluations.api.judge_reference_schemas import (
    JudgeGoldenExpectationRead,
    JudgeReferenceCardRead,
    JudgeReferenceDeckRead,
    JudgeReferenceRead,
    JudgeResultRead,
    JudgeRoleRead,
)

SCRIPTS_DIR = Path(__file__).resolve().parents[5] / "scripts"


class JudgeReferenceUnavailableError(Exception):
    pass


class _GoldenDeck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    cards: dict[str, JudgeGoldenExpectationRead]


class _GoldenFile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    evaluator_version: str
    min_pass_rate: float = 0.9
    decks: dict[str, _GoldenDeck]


class _RoleEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    role: str
    score: int
    description: str
    answers: dict[str, str]


class _ResultEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    overall_score: int
    overall_comment: str
    roles: list[_RoleEntry]

    def read(self) -> JudgeResultRead:
        return JudgeResultRead(
            overall_score=self.overall_score,
            overall_comment=self.overall_comment,
            roles=[JudgeRoleRead(**role.model_dump()) for role in self.roles],
        )


class _ResultsFile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    model: str
    decks: dict[str, dict[str, _ResultEntry]]


class _SnapshotCard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    mana_cost: str | None = None
    type_line: str | None = None
    image_uris: dict[str, str] | None = None


class _DeckSpec(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str
    goal: str


class _DeckSpecFile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    decks: list[_DeckSpec]


def _load(name: str) -> object:
    path = SCRIPTS_DIR / name
    if not path.exists():
        raise JudgeReferenceUnavailableError(f"{name} is not available in this environment")
    return json.loads(path.read_text())


def _expectation_failures(
    expectation: JudgeGoldenExpectationRead, result: JudgeResultRead | None
) -> list[str]:
    if result is None:
        return ["no result recorded"]
    failures: list[str] = []
    roles = {entry.role: entry.score for entry in result.roles}
    for role in expectation.must_roles:
        if role not in roles:
            failures.append(f"expected role '{role}' missing")
    for role in expectation.forbid_roles:
        if role in roles:
            failures.append(f"forbidden role '{role}' present (score {roles[role]})")
    for role, (low, high) in expectation.role_score_ranges.items():
        if role in roles and not low <= roles[role] <= high:
            failures.append(f"{role} score {roles[role]} outside [{low}, {high}]")
    answers = {entry.role: entry.answers for entry in result.roles}
    for role, criteria in expectation.role_criteria.items():
        if role not in roles:
            continue  # absence is must_roles' concern, not the criteria's
        for criterion, allowed in criteria.items():
            actual = answers[role].get(criterion)
            if actual is None:
                failures.append(f"{role} criterion '{criterion}' missing from answers")
            elif actual not in allowed:
                allowed_text = ", ".join(f"'{value}'" for value in allowed)
                failures.append(
                    f"{role} criterion '{criterion}' answered '{actual}' (allowed {allowed_text})"
                )
    low, high = expectation.overall_range
    if not low <= result.overall_score <= high:
        failures.append(f"overall {result.overall_score} outside [{low}, {high}]")
    return failures


def load_judge_reference() -> JudgeReferenceRead:
    golden = _GoldenFile.model_validate(_load("judge_eval_golden.json"))
    results = _ResultsFile.model_validate(_load("judge_eval_results.json"))
    spec = _DeckSpecFile.model_validate(_load("judge_eval_deck.json"))
    if not spec.decks:
        raise JudgeReferenceUnavailableError("judge_eval_deck.json lists no decks")
    snapshots = {
        name: _SnapshotCard.model_validate(payload)
        for name, payload in _snapshot_payloads(_load("judge_eval_snapshots.json")).items()
    }

    cards: list[JudgeReferenceCardRead] = []
    passed_count = 0
    for deck_title, golden_deck in golden.decks.items():
        deck_results = results.decks.get(deck_title, {})
        for name, expectation in sorted(golden_deck.cards.items()):
            entry = deck_results.get(name)
            result = entry.read() if entry is not None else None
            failures = _expectation_failures(expectation, result)
            passed = not failures
            passed_count += int(passed)
            snapshot = snapshots.get(name)
            image_uris = snapshot.image_uris if snapshot is not None else None
            cards.append(
                JudgeReferenceCardRead(
                    name=name,
                    deck_title=deck_title,
                    image_uri=image_uris.get("normal") if image_uris is not None else None,
                    mana_cost=snapshot.mana_cost if snapshot is not None else None,
                    type_line=snapshot.type_line if snapshot is not None else None,
                    expectation=expectation,
                    result=result,
                    passed=passed,
                    failures=failures,
                )
            )
    total = len(cards)
    first = spec.decks[0]
    return JudgeReferenceRead(
        evaluator_version=golden.evaluator_version,
        model=results.model,
        min_pass_rate=golden.min_pass_rate,
        pass_rate=passed_count / total if total else 0.0,
        passed_cards=passed_count,
        total_cards=total,
        deck_title=first.title,
        deck_goal=first.goal,
        decks=[JudgeReferenceDeckRead(title=deck.title, goal=deck.goal) for deck in spec.decks],
        cards=cards,
    )


def _snapshot_payloads(raw: object) -> dict[str, object]:
    if not isinstance(raw, dict):
        raise JudgeReferenceUnavailableError("judge_eval_snapshots.json has an unexpected shape")
    return {str(name): payload for name, payload in raw.items()}
