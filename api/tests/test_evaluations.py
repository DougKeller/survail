import asyncio
import uuid
from typing import cast

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from survail.core.models import Deck, DeckFormat, User
from survail.modules.decks.evaluations.api import router as evaluations
from survail.modules.decks.evaluations.api.schemas import CardRoleEvaluationRead
from survail.modules.decks.evaluations.service import run as evaluation_service


class FakeDb:
    def __init__(self, deck: Deck | None) -> None:
        self.deck = deck

    def scalar(self, statement: object) -> Deck | None:
        del statement
        return self.deck


def _deck(owner_id: uuid.UUID, *, goal: str = "Win through artifacts.") -> Deck:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=owner_id,
        title="Deck",
        format=DeckFormat.COMMANDER,
        description="",
        goal=goal,
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=7,
    )
    deck.cardsets = []
    return deck


def test_single_card_evaluation_uses_owned_deck_and_returns_cached_revision(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner_id = uuid.uuid4()
    deck = _deck(owner_id)
    user = User(id=owner_id, discord_id="1", username="owner")
    expected = CardRoleEvaluationRead(
        oracle_id="oracle-1",
        deck_revision=7,
        evaluator_version="roles-v2",
        overall_score=75,
        overall_comment="This card advances the deck's plan.",
        roles=[],
        cached=True,
    )

    async def fake_evaluate(
        db: Session, subject: Deck, oracle_ids: list[str], evaluator: object
    ) -> list[CardRoleEvaluationRead]:
        del db, evaluator
        assert subject is deck
        assert oracle_ids == ["oracle-1"]
        return [expected]

    monkeypatch.setattr(evaluation_service, "evaluate_oracle_ids", fake_evaluate)
    monkeypatch.setattr(evaluation_service.EvaluationService, "_evaluator", lambda self: None)

    result = asyncio.run(
        evaluations.evaluate_card(
            deck.id,
            "oracle-1",
            cast("Session", FakeDb(deck)),
            user,
        )
    )

    assert result == expected
    assert result.cached is True
    assert result.deck_revision == deck.revision


def test_card_evaluation_requires_goal() -> None:
    owner_id = uuid.uuid4()
    deck = _deck(owner_id, goal=" ")
    user = User(id=owner_id, discord_id="1", username="owner")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            evaluations.evaluate_card(
                deck.id,
                "oracle-1",
                cast("Session", FakeDb(deck)),
                user,
            )
        )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == evaluations.GOAL_REQUIRED_DETAIL


def test_card_evaluation_does_not_expose_another_users_deck() -> None:
    owner_id = uuid.uuid4()
    user = User(id=owner_id, discord_id="1", username="owner")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            evaluations.evaluate_card(
                uuid.uuid4(),
                "oracle-1",
                cast("Session", FakeDb(None)),
                user,
            )
        )

    assert exc_info.value.status_code == 404
