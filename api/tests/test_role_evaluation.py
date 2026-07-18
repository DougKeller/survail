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
    _deck_shape,
    _evaluation_input,
    _referenced_card_context,
    _retry_delay,
    _role_score_from_llmaaj,
    evaluate_oracle_ids,
)


class FakeDb:
    def __init__(self, cached: list[CardRoleEvaluation] | None = None) -> None:
        self.cached = cached or []
        self.added: list[CardRoleEvaluation] = []

    def scalars(self, statement: object) -> list[CardRoleEvaluation]:
        del statement
        return self.cached

    def scalar(self, statement: object) -> None:
        del statement
        return None

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

    async def evaluate(
        self, deck: Deck, oracle_id: str, card_context: str, references: str
    ) -> StructuredLLMaaJ:
        del deck, oracle_id, card_context, references

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
        payload["mass_disruption"] = applicable("mass_disruption")
        payload["overall_summary"] = (
            "Overall: This card is a useful card advantage. "
            "This card is a useful mass disruption."
        )
        return StructuredLLMaaJ(**payload)


def _cardset(
    oracle_id: str,
    *,
    type_line: str = "Sorcery",
    oracle_text: str | None = "Draw two cards. Destroy all creatures.",
    mana_cost: str | None = None,
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
        mana_cost=mana_cost,
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
        "Cost: None\n"
        "Type: Sorcery\n"
        "Power/Toughness: None\n"
        "Oracle Text: Draw two cards. Destroy all creatures."
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
        context_key=_context_key(deck, "0", _brief("0"), "None"),
        evaluator_version="roles-v10",
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
                "role": "mass_disruption",
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
        "Overall: This card is a useful card advantage. This card is a useful mass disruption."
    )
    assert [role.role for role in results[1].roles] == ["card_advantage", "mass_disruption"]
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

    first = _context_key(deck, subject.oracle_id, _brief("subject"), "None")
    deck.revision = 4

    assert _context_key(deck, subject.oracle_id, _brief("subject"), "None") == first


def test_evaluation_context_is_decklist_agnostic() -> None:
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
    deck.cardsets = [commander, support, subject]

    evaluation_input = _evaluation_input(
        deck,
        subject.oracle_id,
        _brief("subject"),
        "None",
    )

    assert "Name: commander" in evaluation_input
    assert "Name: support" not in evaluation_input
    assert "Mana Curve" not in evaluation_input
    assert "Deck shape (rough shares in coarse bands):" in evaluation_input
    assert "- Sorceries: most" in evaluation_input
    assert "Cards referenced by the North Star or card notes:\nNone" in evaluation_input
    assert f"Card under evaluation:\n{_brief('subject')}" in evaluation_input


def test_referenced_card_context_expands_goal_mentions_from_deck() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=DeckFormat.COMMANDER,
        description="",
        goal="Recur lands with [[commander]] and dig with [[Unknown Card]].",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=3,
    )
    commander = _cardset("commander", type_line="Legendary Creature")
    commander.zone = CardZone.COMMANDER
    subject = _cardset("subject")
    subject.note = "Sacrifice fodder for [[payoff]]."
    payoff = _cardset("payoff", type_line="Enchantment")
    deck.cardsets = [commander, subject, payoff]

    references = _referenced_card_context(cast("Session", FakeDb()), deck, subject.oracle_id)

    assert "Name: commander" in references
    assert "Type: Legendary Creature" in references
    assert "Name: Unknown Card\nOracle Text: (card not found)" in references
    assert "Name: payoff" in references


def test_referenced_card_context_ignores_other_cards_notes() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=DeckFormat.COMMANDER,
        description="",
        goal="Win through attrition.",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=3,
    )
    subject = _cardset("subject")
    other = _cardset("other")
    other.note = "Pairs with [[commander]]."
    deck.cardsets = [subject, other]

    references = _referenced_card_context(cast("Session", FakeDb()), deck, subject.oracle_id)

    assert references == "None"


def test_deck_shape_uses_coarse_bands_stable_under_small_swaps() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=DeckFormat.COMMANDER,
        description="",
        goal="Enchantment value.",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=1,
    )
    enchantments = [
        _cardset(f"enchantment-{index}", type_line="Enchantment") for index in range(12)
    ]
    creatures = [_cardset(f"creature-{index}", type_line="Creature — Bear") for index in range(4)]
    lands = [_cardset(f"land-{index}", type_line="Land") for index in range(4)]
    considering = _cardset("considering-card", type_line="Instant")
    considering.zone = CardZone.CONSIDERING
    deck.cardsets = [*enchantments, *creatures, *lands, considering]

    shape = _deck_shape(deck)

    assert shape == (
        "- Creatures: some\n"
        "- Enchantments: most\n"
        "- Lands: some\n"
        "Prominent subtypes:\n"
        "- Bear: some"
    )

    deck.cardsets = [*enchantments[:11], *creatures, *lands, _cardset("swap", type_line="Enchantment")]

    assert _deck_shape(deck) == shape


def test_deck_shape_includes_pips_legendary_and_skips_basic_land_subtypes() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=DeckFormat.COMMANDER,
        description="",
        goal="Vampire aggression.",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=1,
    )
    vampires = [
        _cardset(f"vampire-{index}", type_line="Creature — Vampire", mana_cost="{1}{B}")
        for index in range(7)
    ]
    hybrid = _cardset("hybrid", type_line="Legendary Creature — Vampire", mana_cost="{B/G}")
    swamps = [
        _cardset(f"swamp-{index}", type_line="Basic Land — Swamp") for index in range(2)
    ]
    deck.cardsets = [*vampires, hybrid, *swamps]

    assert _deck_shape(deck) == (
        "- Creatures: most\n"
        "- Lands: some\n"
        "- Legendary: some\n"
        "Color pips:\n"
        "- Black: most\n"
        "- Green: some\n"
        "Prominent subtypes:\n"
        "- Vampire: most"
    )


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
        "Cost: None\n"
        "Type: Creature // Sorcery\n"
        "Power/Toughness: Grave Researcher: 2/2\n"
        "Oracle Text: Grave Researcher (Creature — Skeleton Wizard)\n"
        "When this enters, mill two cards.\n\n"
        "Notion Rain (Sorcery)\n"
        "Surveil 2, then draw two cards."
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
        "Cost: None\n"
        "Type: Creature — Bear\n"
        "Power/Toughness: 2/2\n"
        "Oracle Text: Vigilance"
    )


def test_card_brief_includes_cardset_note_context() -> None:
    noted = _cardset("support")
    noted.note = "Only keep if the deck stays spell-heavy."

    brief = _card_brief([noted])

    assert "Notes:\n- Only keep if the deck stays spell-heavy." in brief


def _role_score(role: str, score: int, description: str) -> CardRoleScoreRead:
    return CardRoleScoreRead.model_validate(
        {"role": role, "score": score, "description": description, "answers": {}}
    )


def test_overall_score_is_bounded_and_led_by_the_best_role() -> None:
    perfect_everywhere = [
        _role_score(role, 100, "Perfect")
        for role in ("card_advantage", "mass_disruption", "payoff", "enabler", "enhancer")
    ]
    assert _calculate_overall_score(perfect_everywhere) == 100

    strong_pair = [
        _role_score("card_advantage", 90, "Primary"),
        _role_score("mass_disruption", 80, "Secondary"),
    ]
    expected_bonus = ((80 - 50) / 50) / (2**OVERALL_SCORE_WEIGHTING_EXPONENT)
    assert _calculate_overall_score(strong_pair) == round(90 + (100 - 90) * expected_bonus)
    assert _calculate_overall_score(strong_pair) == 91


def test_overall_score_ignores_secondary_roles_at_or_below_the_neutral_baseline() -> None:
    padded = [
        _role_score("card_advantage", 90, "Primary"),
        _role_score("enabler", 50, "Baseline secondary"),
        _role_score("enhancer", 35, "Weak tertiary"),
    ]
    assert _calculate_overall_score(padded) == 90


def test_role_gate_drops_roles_whose_defining_criterion_rates_low() -> None:
    def llmaaj_with_net_gain(rating: QualitativeRating) -> StructuredLLMaaJ:
        payload = {role: "N/A" for role in ROLE_NAMES}
        payload["card_advantage"] = {
            "description": "Marginal draw effect.",
            "answers": {
                "net_gain": rating,
                "repeatability": QualitativeRating.HIGH,
                "reliability": QualitativeRating.HIGH,
                "quality": QualitativeRating.HIGH,
                "floor": QualitativeRating.HIGH,
            },
        }
        payload["overall_summary"] = "A marginal draw effect."
        return StructuredLLMaaJ(**payload)

    gated = _role_score_from_llmaaj(
        "card_advantage", llmaaj_with_net_gain(QualitativeRating.LOW), is_land=False
    )
    kept = _role_score_from_llmaaj(
        "card_advantage", llmaaj_with_net_gain(QualitativeRating.NEUTRAL), is_land=False
    )

    assert gated is None
    assert kept is not None
    assert kept.role == "card_advantage"


def test_structured_role_outputs_include_role_description_but_not_per_answer_prose() -> None:
    score_schema = StructuredLLMaaJ.model_json_schema()
    assert set(score_schema["properties"]) == {*ROLE_NAMES, "overall_summary"}
    enhancer = score_schema["$defs"]["EnhancerApplicableRole"]
    enhancer_answers_ref = enhancer["properties"]["answers"]["$ref"].split("/")[-1]
    enhancer_answers = score_schema["$defs"][enhancer_answers_ref]
    assert set(enhancer_answers["properties"]) == set(ROLE_RUBRICS["enhancer"])


def test_openai_role_evaluator_retries_transient_errors_with_exponential_backoff() -> None:
    payload = {role: "N/A" for role in ROLE_NAMES}
    payload["enabler"] = {
        "description": "Starts the plan efficiently.",
        "answers": {
            "directness": QualitativeRating.HIGH,
            "reliability": QualitativeRating.HIGH,
            "resilience": QualitativeRating.NEUTRAL,
            "timing": QualitativeRating.HIGH,
            "breadth": QualitativeRating.NEUTRAL,
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

    tagged = asyncio.run(evaluator.evaluate(deck, "oracle", "{}", "None"))

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
            self, deck: Deck, oracle_id: str, card_context: str, references: str
        ) -> StructuredLLMaaJ:
            if oracle_id == "bad":
                raise RuntimeError("failed")
            return await super().evaluate(deck, oracle_id, card_context, references)

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
