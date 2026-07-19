import uuid
from typing import cast

import pytest
from sqlalchemy.orm import Session

from survail.core.models import (
    CardEvaluationFeedback,
    CardRoleEvaluation,
    CardSet,
    CardZone,
    Deck,
    DeckFormat,
    User,
)
from survail.core.schemas import ScryfallCardSnapshot
from survail.modules.decks.evaluations.api.schemas import EvaluationFeedbackRequest
from survail.modules.decks.evaluations.service.evaluator import EVALUATOR_VERSION
from survail.modules.decks.evaluations.service.feedback import (
    FeedbackEvaluationNotFoundError,
    FeedbackValidationError,
    submit_feedback,
)


class FakeDb:
    def __init__(self, deck: Deck, evaluations: list[CardRoleEvaluation] | None = None) -> None:
        self.deck = deck
        self.evaluations = evaluations or []
        self.added: list[CardEvaluationFeedback] = []
        self.committed = False

    def scalar(self, statement: object) -> Deck:
        del statement
        return self.deck

    def scalars(self, statement: object) -> list[CardRoleEvaluation]:
        del statement
        return self.evaluations

    def add(self, feedback: CardEvaluationFeedback) -> None:
        self.added.append(feedback)

    def commit(self) -> None:
        self.committed = True


def _cardset(deck_id: uuid.UUID, oracle_id: str) -> CardSet:
    card = ScryfallCardSnapshot(
        id=f"printing-{oracle_id}",
        oracle_id=oracle_id,
        name=oracle_id,
        lang="en",
        layout="normal",
        cmc=2,
        type_line="Artifact",
        oracle_text="{T}: Add {C}{C}.",
        legalities={"commander": "legal"},
        set="tst",
        set_name="Test",
        collector_number="1",
        rarity="rare",
        scryfall_uri="https://example.test/card",
    )
    return CardSet(
        id=uuid.uuid4(),
        deck_id=deck_id,
        quantity=1,
        zone=CardZone.MAINBOARD,
        printing_id=card.id,
        oracle_id=oracle_id,
        card_name=oracle_id,
        note=None,
        scryfall=card.model_dump(mode="json"),
    )


def _deck(owner_id: uuid.UUID) -> Deck:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=owner_id,
        title="Deck",
        format=DeckFormat.COMMANDER,
        description="",
        goal="Ramp into large threats.",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=4,
    )
    deck.cardsets = [_cardset(deck.id, "oracle-1")]
    return deck


def _evaluation(deck: Deck) -> CardRoleEvaluation:
    return CardRoleEvaluation(
        deck_id=deck.id,
        deck_revision=deck.revision,
        context_key="key",
        evaluator_version=EVALUATOR_VERSION,
        prompt_version="gepa-feedback-test",
        oracle_id="oracle-1",
        overall_comment="A premier mana rock.",
        roles=[
            {
                "role": "mana_ramp",
                "score": 90,
                "description": "Fast acceleration.",
                "answers": {"speed": "very_high", "fixing": "neutral"},
            }
        ],
    )


def _user(owner_id: uuid.UUID) -> User:
    return User(id=owner_id, discord_id="1", username="owner")


def _request(**overrides: object) -> EvaluationFeedbackRequest:
    payload: dict[str, object] = {
        "oracle_id": "oracle-1",
        "evaluator_version": EVALUATOR_VERSION,
        "prompt_version": "gepa-feedback-test",
        "scope": "overall",
        "verdict": "down",
    }
    payload.update(overrides)
    return EvaluationFeedbackRequest.model_validate(payload)


def test_overall_feedback_stores_role_diff_and_verbatim_context() -> None:
    owner_id = uuid.uuid4()
    deck = _deck(owner_id)
    db = FakeDb(deck, [_evaluation(deck)])

    feedback = submit_feedback(
        cast("Session", db),
        _user(owner_id),
        deck.id,
        _request(
            expected_added_roles=["enabler"],
            expected_removed_roles=["mana_ramp", "payoff"],
            reason="  This is a staple, not an enabler.  ",
        ),
    )

    assert db.committed is True
    assert db.added == [feedback]
    assert feedback.scope == "overall"
    assert feedback.verdict == "down"
    assert feedback.reason == "This is a staple, not an enabler."
    assert feedback.expected == {
        "added_roles": ["enabler"],
        "removed_roles": ["mana_ramp"],
    }
    assert feedback.actual["roles"][0]["role"] == "mana_ramp"
    assert feedback.card_name == "oracle-1"
    assert feedback.deck_revision == deck.revision
    assert feedback.evaluator_version == EVALUATOR_VERSION
    assert feedback.prompt_version == "gepa-feedback-test"
    assert len(feedback.context_key) == 64
    context = feedback.evaluation_context
    assert context["goal"] == deck.goal
    assert "oracle-1" in str(context["card_under_evaluation"])
    assert context["evaluator_version"] == EVALUATOR_VERSION
    assert context["prompt_version"] == "gepa-feedback-test"


def test_thumbs_up_with_no_corrections_stores_empty_diff() -> None:
    owner_id = uuid.uuid4()
    deck = _deck(owner_id)
    db = FakeDb(deck, [_evaluation(deck)])

    feedback = submit_feedback(
        cast("Session", db),
        _user(owner_id),
        deck.id,
        _request(verdict="up", reason="Exactly right."),
    )

    assert feedback.expected == {}
    assert feedback.verdict == "up"


def test_role_feedback_keeps_only_changed_criteria() -> None:
    owner_id = uuid.uuid4()
    deck = _deck(owner_id)
    db = FakeDb(deck, [_evaluation(deck)])

    feedback = submit_feedback(
        cast("Session", db),
        _user(owner_id),
        deck.id,
        _request(
            scope="mana_ramp",
            expected_criteria={"speed": "very_high", "fixing": "low"},
        ),
    )

    assert feedback.expected == {"criteria": {"fixing": "low"}}
    assert feedback.scope == "mana_ramp"


def test_role_feedback_rejects_unknown_criteria_and_scope() -> None:
    owner_id = uuid.uuid4()
    deck = _deck(owner_id)
    db = FakeDb(deck, [_evaluation(deck)])

    with pytest.raises(FeedbackValidationError, match="Unknown criteria"):
        submit_feedback(
            cast("Session", db),
            _user(owner_id),
            deck.id,
            _request(scope="mana_ramp", expected_criteria={"bogus": "high"}),
        )
    with pytest.raises(FeedbackValidationError, match="Unknown feedback scope"):
        submit_feedback(
            cast("Session", db), _user(owner_id), deck.id, _request(scope="bogus_scope")
        )


def test_cross_scope_payloads_are_rejected() -> None:
    owner_id = uuid.uuid4()
    deck = _deck(owner_id)
    db = FakeDb(deck, [_evaluation(deck)])

    with pytest.raises(FeedbackValidationError, match="Criterion ranks"):
        submit_feedback(
            cast("Session", db),
            _user(owner_id),
            deck.id,
            _request(expected_criteria={"speed": "low"}),
        )
    with pytest.raises(FeedbackValidationError, match="Role toggles"):
        submit_feedback(
            cast("Session", db),
            _user(owner_id),
            deck.id,
            _request(scope="mana_ramp", expected_added_roles=["payoff"]),
        )


def test_feedback_requires_an_existing_evaluation() -> None:
    owner_id = uuid.uuid4()
    deck = _deck(owner_id)
    db = FakeDb(deck, [])

    with pytest.raises(FeedbackEvaluationNotFoundError):
        submit_feedback(cast("Session", db), _user(owner_id), deck.id, _request())
