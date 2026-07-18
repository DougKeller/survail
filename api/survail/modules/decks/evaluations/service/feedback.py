"""Store user verdicts on displayed card evaluations as labeled examples.

Each submission captures the evaluation as displayed (`actual`), only the
user's corrections (`expected` — role toggles for overall feedback, criterion
re-ranks for role feedback), and the verbatim judge input context so the
evaluation can be re-simulated when iterating on rubrics. Free-text reasons
are stored as hints for prompt authors and are never used for evaluation.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from survail.core.config import get_settings
from survail.core.models import CardEvaluationFeedback, CardRoleEvaluation, User
from survail.core.types import json_object
from survail.modules.decks.evaluations.api.schemas import EvaluationFeedbackRequest
from survail.modules.decks.evaluations.service.evaluator import (
    _card_contexts,
    _context_key,
    _referenced_card_context,
    _scoring_context_payload,
)
from survail.modules.decks.evaluations.service.role_rubrics import ROLE_NAMES, ROLE_RUBRICS
from survail.modules.decks.evaluations.service.run import EvaluationService

OVERALL_SCOPE = "overall"


class FeedbackValidationError(ValueError):
    pass


class FeedbackEvaluationNotFoundError(LookupError):
    pass


def submit_feedback(
    db: Session, user: User, deck_id: uuid.UUID, request: EvaluationFeedbackRequest
) -> CardEvaluationFeedback:
    deck = EvaluationService(db).require_evaluable_deck(user, deck_id)
    contexts = _card_contexts(db, deck, [request.oracle_id])
    card_context = contexts.get(request.oracle_id)
    if card_context is None:
        raise FeedbackValidationError("Card is not part of this deck")
    references = _referenced_card_context(db, deck, request.oracle_id)
    context_payload = _scoring_context_payload(deck, request.oracle_id, card_context, references)
    evaluation = _latest_evaluation(db, deck.id, request.oracle_id)
    if evaluation is None:
        raise FeedbackEvaluationNotFoundError("No evaluation exists for this card yet")
    actual_roles = {
        str(role["role"]) for role in evaluation.roles if isinstance(role.get("role"), str)
    }
    expected = _expected_diff(request, evaluation, actual_roles)
    cardset = next(
        cardset for cardset in deck.cardsets if cardset.oracle_id == request.oracle_id
    )
    feedback = CardEvaluationFeedback(
        owner_id=user.id,
        deck_id=deck.id,
        deck_revision=deck.revision,
        oracle_id=request.oracle_id,
        card_name=cardset.card_name,
        context_key=_context_key(deck, request.oracle_id, card_context, references),
        evaluator_version=evaluation.evaluator_version,
        evaluation_model=get_settings().openai_role_evaluation_model,
        scope=request.scope,
        verdict=request.verdict,
        reason=request.reason.strip(),
        actual=json_object(
            {
                "overall_comment": evaluation.overall_comment,
                "roles": evaluation.roles,
            }
        ),
        expected=expected,
        evaluation_context=json_object(dict(context_payload)),
    )
    db.add(feedback)
    db.commit()
    return feedback


def _latest_evaluation(
    db: Session, deck_id: uuid.UUID, oracle_id: str
) -> CardRoleEvaluation | None:
    stored = db.scalars(
        select(CardRoleEvaluation)
        .where(
            CardRoleEvaluation.deck_id == deck_id,
            CardRoleEvaluation.oracle_id == oracle_id,
        )
        .order_by(CardRoleEvaluation.created_at.desc())
    )
    for evaluation in stored:
        return evaluation
    return None


def _expected_diff(
    request: EvaluationFeedbackRequest,
    evaluation: CardRoleEvaluation,
    actual_roles: set[str],
) -> dict[str, object]:
    if request.scope == OVERALL_SCOPE:
        return _expected_role_diff(request, actual_roles)
    if request.scope not in ROLE_NAMES:
        raise FeedbackValidationError(f"Unknown feedback scope: {request.scope}")
    if request.expected_added_roles or request.expected_removed_roles:
        raise FeedbackValidationError("Role toggles only apply to overall feedback")
    return _expected_criteria_diff(request, evaluation)


def _expected_role_diff(
    request: EvaluationFeedbackRequest, actual_roles: set[str]
) -> dict[str, object]:
    if request.expected_criteria:
        raise FeedbackValidationError("Criterion ranks only apply to role feedback")
    unknown = [
        role
        for role in [*request.expected_added_roles, *request.expected_removed_roles]
        if role not in ROLE_NAMES
    ]
    if unknown:
        raise FeedbackValidationError(f"Unknown roles: {', '.join(sorted(unknown))}")
    added = sorted(set(request.expected_added_roles) - actual_roles)
    removed = sorted(set(request.expected_removed_roles) & actual_roles)
    diff: dict[str, object] = {}
    if added:
        diff["added_roles"] = added
    if removed:
        diff["removed_roles"] = removed
    return diff


def _expected_criteria_diff(
    request: EvaluationFeedbackRequest, evaluation: CardRoleEvaluation
) -> dict[str, object]:
    rubric = ROLE_RUBRICS[request.scope]
    unknown = [criterion for criterion in request.expected_criteria if criterion not in rubric]
    if unknown:
        raise FeedbackValidationError(
            f"Unknown criteria for {request.scope}: {', '.join(sorted(unknown))}"
        )
    actual_answers: dict[str, str] = {}
    for role in evaluation.roles:
        if role.get("role") == request.scope:
            answers = role.get("answers")
            if isinstance(answers, dict):
                actual_answers = {str(key): str(value) for key, value in answers.items()}
    changed = {
        criterion: rating
        for criterion, rating in sorted(request.expected_criteria.items())
        if actual_answers.get(criterion) != rating
    }
    return {"criteria": changed} if changed else {}
