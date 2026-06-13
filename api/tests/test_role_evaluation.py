import asyncio
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from typing import cast

import httpx
import pytest
from openai import APIConnectionError, AsyncOpenAI, RateLimitError
from sqlalchemy.orm import Session

from survail.domain.role_evaluation import (
    CardRole,
    OpenAIRoleEvaluator,
    QualitativeRating,
    StructuredAnswer,
    StructuredRoleScore,
    StructuredTagging,
    _retry_delay,
    evaluate_oracle_ids,
)
from survail.models import CardFinish, CardRoleEvaluation, CardSet, CardZone, Deck, DeckFormat
from survail.schemas import ScryfallCardSnapshot


class FakeDb:
    def __init__(self, cached: list[CardRoleEvaluation] | None = None) -> None:
        self.cached = cached or []
        self.added: list[CardRoleEvaluation] = []

    def scalars(self, statement: object) -> list[CardRoleEvaluation]:
        del statement
        return self.cached

    def add(self, evaluation: CardRoleEvaluation) -> None:
        self.added.append(evaluation)

    def flush(self) -> None:
        pass

    def commit(self) -> None:
        pass


@dataclass
class FakeEvaluator:
    active: int = 0
    max_active: int = 0

    async def classify(self, deck: Deck, oracle_id: str, card_context: str) -> StructuredTagging:
        del deck, oracle_id, card_context
        self.active += 1
        self.max_active = max(self.max_active, self.active)
        await asyncio.sleep(0)
        self.active -= 1
        return StructuredTagging(tags=[CardRole.CARD_ADVANTAGE, CardRole.BOARD_WIPE])

    async def score_role(
        self, deck: Deck, oracle_id: str, card_context: str, role: CardRole
    ) -> StructuredRoleScore:
        del deck, oracle_id, card_context
        from survail.domain.role_evaluation import ROLE_RUBRICS

        ratings = [
            QualitativeRating.VERY_HIGH,
            QualitativeRating.HIGH,
            QualitativeRating.NEUTRAL,
            QualitativeRating.LOW,
        ]
        return StructuredRoleScore(
            role=role,
            description=f"This card is a useful {role.value.replace('_', ' ')}.",
            answers=[
                StructuredAnswer(criterion_id=criterion_id, rating=rating)
                for (criterion_id, _), rating in zip(ROLE_RUBRICS[role], ratings, strict=True)
            ],
        )

    async def summarize(
        self,
        deck: Deck,
        oracle_id: str,
        card_context: str,
        role_scores: Sequence[StructuredRoleScore],
    ) -> str:
        del deck, oracle_id, card_context
        descriptions = " ".join(score.description for score in role_scores)
        return f"Overall: {descriptions}"


def _cardset(oracle_id: str) -> CardSet:
    card = ScryfallCardSnapshot(
        id=f"printing-{oracle_id}",
        oracle_id=oracle_id,
        name=oracle_id,
        lang="en",
        layout="normal",
        cmc=4,
        type_line="Sorcery",
        oracle_text="Draw two cards. Destroy all creatures.",
        legalities={"commander": "legal"},
        set="tst",
        set_name="Test",
        collector_number="1",
        rarity="rare",
        scryfall_uri="https://example.test/card",
    )
    return CardSet(
        id=uuid.uuid4(),
        deck_id=uuid.uuid4(),
        quantity=1,
        zone=CardZone.MAINBOARD,
        finish=CardFinish.NONFOIL,
        printing_id=card.id,
        oracle_id=oracle_id,
        card_name=oracle_id,
        set_code="tst",
        collector_number="1",
        tags=[],
        scryfall=card.model_dump(mode="json"),
    )


def test_role_evaluations_derive_numeric_scores_and_cache_by_revision() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=DeckFormat.COMMANDER,
        description="",
        goal="Control the board and accumulate cards.",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=3,
    )
    deck.cardsets = [_cardset(str(index)) for index in range(10)]
    cached = CardRoleEvaluation(
        deck_id=deck.id,
        deck_revision=3,
        evaluator_version="roles-v3",
        oracle_id="0",
        overall_score=80,
        overall_comment="Cached comment.",
        roles=[],
    )
    db = FakeDb([cached])
    evaluator = FakeEvaluator()
    progress: list[tuple[int, int, float | None]] = []

    async def report(update: object) -> None:
        from survail.domain.role_evaluation import EvaluationProgress

        parsed = cast("EvaluationProgress", update)
        progress.append((parsed.completed, parsed.total, parsed.eta_seconds))

    results = asyncio.run(
        evaluate_oracle_ids(
            cast("Session", db),
            deck,
            [card.oracle_id for card in deck.cardsets],
            evaluator,
            report,
        )
    )

    assert results[0].cached is True
    assert results[1].overall_score == 62
    assert results[1].overall_comment == (
        "Overall: This card is a useful card advantage. This card is a useful board wipe."
    )
    assert [role.role for role in results[1].roles] == ["card_advantage", "board_wipe"]
    assert results[1].roles[0].description == "This card is a useful card advantage."
    assert [answer.score for answer in results[1].roles[0].answers] == [100, 75, 50, 25]
    assert evaluator.max_active == 4
    assert progress[0][:2] == (1, 10)
    assert progress[-1][0] == 10
    assert progress[-1][2] == 0


def test_structured_role_outputs_include_role_description_but_not_per_answer_prose() -> None:
    tagging_schema = StructuredTagging.model_json_schema()
    score_schema = StructuredRoleScore.model_json_schema()
    answer_schema = score_schema["$defs"]["StructuredAnswer"]

    assert set(tagging_schema["properties"]) == {"tags"}
    assert set(score_schema["properties"]) == {"role", "description", "answers"}
    assert set(answer_schema["properties"]) == {"criterion_id", "rating"}


def test_openai_role_evaluator_retries_transient_errors_with_exponential_backoff() -> None:
    result = StructuredTagging(tags=[CardRole.ENABLER])

    class FakeResponses:
        calls = 0

        async def parse(self, **kwargs: object) -> object:
            del kwargs
            self.calls += 1
            if self.calls == 1:
                raise APIConnectionError(request=httpx.Request("POST", "https://example.test"))
            return type("Response", (), {"output_parsed": result})()

    class FakeClient:
        responses = FakeResponses()

    sleeps: list[float] = []

    async def sleep(delay: float) -> None:
        sleeps.append(delay)

    evaluator = OpenAIRoleEvaluator("test-key", "test-model", sleep=sleep, random_value=lambda: 0)
    evaluator._client = cast("AsyncOpenAI", FakeClient())
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=DeckFormat.MODERN,
        description="",
        goal="Start an engine.",
        metadata_json={"kind": "generic"},
        revision=1,
    )
    deck.cardsets = []

    tagged = asyncio.run(evaluator.classify(deck, "oracle", "{}"))

    assert tagged == result
    assert sleeps == [1.0]
    assert (
        _retry_delay(
            APIConnectionError(request=httpx.Request("POST", "https://example.test")), 3, 0
        )
        == 8
    )


def test_retry_delay_parses_millisecond_rate_limit_message() -> None:
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    response = httpx.Response(429, request=request)
    error = RateLimitError(
        "Rate limit reached. Please try again in 71ms.",
        response=response,
        body=None,
    )

    assert _retry_delay(error, 0, 0) == 1


def test_completed_cards_are_persisted_when_another_card_fails() -> None:
    class PartiallyFailingEvaluator(FakeEvaluator):
        async def classify(
            self, deck: Deck, oracle_id: str, card_context: str
        ) -> StructuredTagging:
            if oracle_id == "bad":
                raise RuntimeError("failed")
            return await super().classify(deck, oracle_id, card_context)

    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=DeckFormat.MODERN,
        description="",
        goal="Control the board.",
        metadata_json={"kind": "generic"},
        revision=1,
    )
    deck.cardsets = [_cardset("good"), _cardset("bad")]
    db = FakeDb()
    streamed: list[str] = []

    async def result(update: object) -> None:
        from survail.schemas import CardRoleEvaluationRead

        streamed.append(cast("CardRoleEvaluationRead", update).oracle_id)

    async def run() -> None:
        with pytest.raises(RuntimeError, match="failed"):
            await evaluate_oracle_ids(
                cast("Session", db),
                deck,
                ["good", "bad"],
                PartiallyFailingEvaluator(),
                result_callback=result,
            )

    asyncio.run(run())

    assert [evaluation.oracle_id for evaluation in db.added] == ["good"]
    assert streamed == ["good"]


def test_evaluation_requires_nonblank_goal_before_reading_cache_or_calling_evaluator() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=DeckFormat.MODERN,
        description="",
        goal="  ",
        metadata_json={"kind": "generic"},
        revision=1,
    )
    deck.cardsets = [_cardset("card")]
    db = FakeDb()

    with pytest.raises(
        ValueError,
        match="Deck must have a Goal / North Star before cards can be evaluated",
    ):
        asyncio.run(evaluate_oracle_ids(cast("Session", db), deck, ["card"], FakeEvaluator()))
