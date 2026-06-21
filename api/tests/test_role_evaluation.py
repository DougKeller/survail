import asyncio
import uuid
from dataclasses import dataclass
from typing import cast

import httpx
import pytest
from openai import APIConnectionError, AsyncOpenAI, RateLimitError
from sqlalchemy.orm import Session

from survail.core.models import CardFinish, CardRoleEvaluation, CardSet, CardZone, Deck, DeckFormat
from survail.core.schemas import CardFace, ScryfallCardSnapshot
from survail.modules.decks.evaluations.api.schemas import CardRoleScoreRead
from survail.modules.decks.evaluations.service.evaluator import (
    MAX_CONCURRENT_EVALUATIONS,
    OVERALL_SCORE_WEIGHTING_EXPONENT,
    OpenAIRoleEvaluator,
    QualitativeRating,
    ROLE_NAMES,
    ROLE_RUBRICS,
    StructuredLLMaaJ,
    _card_brief,
    _calculate_overall_score,
    _context_key,
    _evaluation_input,
    _retry_delay,
    evaluate_oracle_ids,
)


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

    async def evaluate(self, deck: Deck, oracle_id: str, card_context: str) -> StructuredLLMaaJ:
        del deck, oracle_id, card_context

        self.active += 1
        self.max_active = max(self.max_active, self.active)
        await asyncio.sleep(0)
        self.active -= 1

        ratings = [
            QualitativeRating.VERY_HIGH,
            QualitativeRating.HIGH,
            QualitativeRating.NEUTRAL,
            QualitativeRating.LOW,
            QualitativeRating.HIGH,
        ]
        def applicable(role: str) -> dict[str, object]:
            return {
                "description": f"This card is a useful {role.replace('_', ' ')}.",
                "answers": {
                    criterion_id: rating
                    for criterion_id, rating in zip(ROLE_RUBRICS[role], ratings, strict=True)
                },
            }

        payload = {role: "N/A" for role in ROLE_NAMES}
        payload["card_advantage"] = applicable("card_advantage")
        payload["board_control"] = applicable("board_control")
        payload["overall_summary"] = (
            "Overall: This card is a useful card advantage. "
            "This card is a useful board control."
        )
        return StructuredLLMaaJ(**payload)


def _cardset(
    oracle_id: str,
    *,
    type_line: str = "Sorcery",
    oracle_text: str | None = "Draw two cards. Destroy all creatures.",
    power: str | None = None,
    toughness: str | None = None,
    card_faces: list[CardFace] | None = None,
) -> CardSet:
    card = ScryfallCardSnapshot(
        id=f"printing-{oracle_id}",
        oracle_id=oracle_id,
        name=oracle_id,
        lang="en",
        layout="modal_dfc" if card_faces else "normal",
        cmc=4,
        type_line=type_line,
        oracle_text=oracle_text,
        power=power,
        toughness=toughness,
        legalities={"commander": "legal"},
        set="tst",
        set_name="Test",
        collector_number="1",
        rarity="rare",
        card_faces=card_faces or [],
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
        core=False,
        note=None,
        tags=[],
        scryfall=card.model_dump(mode="json"),
    )


def _brief(name: str) -> str:
    return (
        f"Name: {name}\n"
        "Quantity: 1\n"
        "Zone Summary:\n"
        "- Mainboard: 1x\n"
        "Cost: None\n"
        "Type: Sorcery\n"
        "Power/Toughness: None\n"
        "Oracle Text: Draw two cards. Destroy all creatures.\n"
        "Cardset Notes:\n"
        "- None"
    )


def test_role_evaluations_derive_numeric_scores_and_cache_by_context() -> None:
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
        context_key=_context_key(deck, "0", _brief("0")),
        evaluator_version="roles-v7",
        oracle_id="0",
        overall_comment="Cached comment.",
        roles=[
            {
                "role": "card_advantage",
                "score": 100,
                "description": "Cached primary role.",
                "answers": {},
            },
            {
                "role": "board_control",
                "score": 50,
                "description": "Cached secondary role.",
                "answers": {},
            },
        ],
    )
    db = FakeDb([cached])
    evaluator = FakeEvaluator()
    progress: list[tuple[int, int, float | None]] = []

    async def report(update: object) -> None:
        from survail.modules.decks.evaluations.service.evaluator import EvaluationProgress

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

    cached_expected = _calculate_overall_score(
        [CardRoleScoreRead.model_validate(item, strict=False) for item in cached.roles]
    )
    fresh_expected = _calculate_overall_score(results[1].roles)

    assert results[0].cached is True
    assert results[0].overall_score == cached_expected
    assert results[1].overall_score == fresh_expected
    assert results[1].overall_comment == (
        "Overall: This card is a useful card advantage. This card is a useful board control."
    )
    assert [role.role for role in results[1].roles] == ["card_advantage", "board_control"]
    assert results[1].roles[0].description == "This card is a useful card advantage."
    assert list(results[1].roles[0].answers.values())[:4] == [
        "very_high",
        "high",
        "neutral",
        "low",
    ]
    assert evaluator.max_active == MAX_CONCURRENT_EVALUATIONS
    assert progress[0][:2] == (1, 10)
    assert progress[-1][0] == 10
    assert progress[-1][2] == 0


def test_context_key_stays_stable_across_revision_only_changes() -> None:
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
    commander = _cardset("commander")
    commander.zone = CardZone.COMMANDER
    core = _cardset("core")
    core.core = True
    subject = _cardset("subject")
    deck.cardsets = [commander, core, subject]

    first = _context_key(deck, subject.oracle_id, _brief("subject"))
    deck.revision = 4

    assert _context_key(deck, subject.oracle_id, _brief("subject")) == first


def test_evaluation_context_uses_only_starred_cards_and_excludes_subject() -> None:
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
    commander = _cardset("commander", type_line="Legendary Creature")
    commander.zone = CardZone.COMMANDER
    support = _cardset("support")
    support.core = True
    subject = _cardset("subject")
    subject.core = True
    filler = _cardset("filler")
    deck.cardsets = [commander, support, subject, filler]

    evaluation_input = _evaluation_input(
        deck,
        subject.oracle_id,
        _brief("subject"),
    )

    assert "Name: support" in evaluation_input
    assert "Name: filler" not in evaluation_input
    assert "Current Mana Curve:\n- 4: 1" in evaluation_input
    assert "Name: subject\nQuantity: 1" in evaluation_input


def test_card_brief_uses_face_oracle_text_and_creature_face_stats() -> None:
    brief = _card_brief(
        [
            _cardset(
                "grave-researcher",
                type_line="Creature // Sorcery",
                oracle_text=None,
                card_faces=[
                    CardFace(
                        name="Grave Researcher",
                        mana_cost="{1}{B}",
                        type_line="Creature — Skeleton Wizard",
                        oracle_text="When this enters, mill two cards.",
                        power="2",
                        toughness="2",
                    ),
                    CardFace(
                        name="Notion Rain",
                        mana_cost="{1}{U}{B}",
                        type_line="Sorcery",
                        oracle_text="Surveil 2, then draw two cards.",
                    ),
                ],
            )
        ]
    )

    assert brief == (
        "Name: grave-researcher\n"
        "Quantity: 1\n"
        "Zone Summary:\n"
        "- Mainboard: 1x\n"
        "Cost: None\n"
        "Type: Creature // Sorcery\n"
        "Power/Toughness: Grave Researcher: 2/2\n"
        "Oracle Text: Grave Researcher (Creature — Skeleton Wizard)\n"
        "When this enters, mill two cards.\n\n"
        "Notion Rain (Sorcery)\n"
        "Surveil 2, then draw two cards.\n"
        "Cardset Notes:\n"
        "- None"
    )


def test_card_brief_uses_top_level_power_toughness_for_normal_creatures() -> None:
    brief = _card_brief(
        [
            _cardset(
                "bear",
                type_line="Creature — Bear",
                oracle_text="Vigilance",
                power="2",
                toughness="2",
            )
        ]
    )

    assert brief == (
        "Name: bear\n"
        "Quantity: 1\n"
        "Zone Summary:\n"
        "- Mainboard: 1x\n"
        "Cost: None\n"
        "Type: Creature — Bear\n"
        "Power/Toughness: 2/2\n"
        "Oracle Text: Vigilance\n"
        "Cardset Notes:\n"
        "- None"
    )


def test_card_brief_includes_cardset_note_context() -> None:
    noted = _cardset("support")
    noted.note = "Only keep if the deck stays spell-heavy."

    brief = _card_brief([noted])

    assert "Cardset Notes:\n- Mainboard: Only keep if the deck stays spell-heavy." in brief


def test_overall_score_uses_shared_weighting_exponent_without_upper_clamp() -> None:
    role_scores = [
        CardRoleScoreRead.model_validate(
            {
                "role": role,
                "score": 100,
                "description": description,
                "answers": {},
            }
        )
        for role, description in (
            ("card_advantage", "Primary"),
            ("board_control", "Secondary"),
            ("payoff", "Tertiary"),
            ("engine_enabler", "Quaternary"),
            ("engine_support", "Quinary"),
        )
    ]

    expected = round(
        sum(
            role_score.score / ((index + 1) ** OVERALL_SCORE_WEIGHTING_EXPONENT)
            for index, role_score in enumerate(
                sorted(role_scores, key=lambda item: item.score, reverse=True)
            )
        )
    )

    assert expected > 100
    assert _calculate_overall_score(role_scores) == expected


def test_structured_role_outputs_include_role_description_but_not_per_answer_prose() -> None:
    score_schema = StructuredLLMaaJ.model_json_schema()
    assert set(score_schema["properties"]) == {*ROLE_NAMES, "overall_summary"}
    engine_support = score_schema["$defs"]["EngineSupportApplicableRole"]
    engine_support_answers_ref = engine_support["properties"]["answers"]["$ref"].split("/")[-1]
    engine_support_answers = score_schema["$defs"][engine_support_answers_ref]
    assert set(engine_support_answers["properties"]) == set(ROLE_RUBRICS["engine_support"])


def test_openai_role_evaluator_retries_transient_errors_with_exponential_backoff() -> None:
    payload = {role: "N/A" for role in ROLE_NAMES}
    payload["engine_enabler"] = {
        "description": "Starts the engine efficiently.",
        "answers": {
            "directness": QualitativeRating.HIGH,
            "reliability": QualitativeRating.HIGH,
            "synergy_density": QualitativeRating.NEUTRAL,
            "timing": QualitativeRating.HIGH,
        },
    }
    payload["overall_summary"] = "A strong enabler for this deck."
    result = StructuredLLMaaJ(**payload)

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

    tagged = asyncio.run(evaluator.evaluate(deck, "oracle", "{}"))

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
        async def evaluate(
            self, deck: Deck, oracle_id: str, card_context: str
        ) -> StructuredLLMaaJ:
            if oracle_id == "bad":
                raise RuntimeError("failed")
            return await super().evaluate(deck, oracle_id, card_context)

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
        from survail.modules.decks.evaluations.api.schemas import CardRoleEvaluationRead

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
