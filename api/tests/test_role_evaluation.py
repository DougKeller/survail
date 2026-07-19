import asyncio
import json
import math
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import cast

import pytest
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ClauseElement

from survail.core.models import (
    CardFinish,
    CardRoleEvaluation,
    CardSet,
    CardZone,
    CatalogCard,
    Deck,
    DeckFormat,
)
from survail.core.schemas import CardFace, ScryfallCardSnapshot
from survail.modules.decks.evaluations.api.schemas import CardRoleScoreRead
from survail.modules.decks.evaluations.service.evaluator import (
    EVALUATOR_VERSION,
    MAX_CONCURRENT_EVALUATIONS,
    OVERALL_SCORE_WEIGHTING_EXPONENT,
    ROLE_DEFINITIONS,
    ROLE_NAMES,
    ROLE_RUBRICS,
    DSPyRoleEvaluator,
    QualitativeRating,
    ReferencedCardNotFoundError,
    StructuredLLMaaJ,
    _calculate_overall_score,
    _card_brief,
    _context_key,
    _deck_shape,
    _evaluation_input_with_rubrics,
    _evaluation_instructions,
    _prompt_version,
    _referenced_card_context,
    _referenced_card_contexts,
    _role_json,
    _role_score_from_llmaaj,
    evaluate_oracle_ids,
)

TEST_PROMPT_VERSION = "test-prompt-version"


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
    prompt_version: str = TEST_PROMPT_VERSION
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
                "answers": dict(zip(ROLE_RUBRICS[role], ratings, strict=True)),
            }

        payload = dict.fromkeys(ROLE_NAMES, "N/A")
        payload["card_advantage"] = applicable("card_advantage")
        payload["mass_disruption"] = applicable("mass_disruption")
        payload["overall_summary"] = (
            "Overall: This card is a useful card advantage. This card is a useful mass disruption."
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


def test_role_evaluations_derive_numeric_scores_and_cache_by_deck_and_oracle() -> None:
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
        context_key=_context_key(
            deck,
            "0",
            _brief("0"),
            "None",
            prompt_version=TEST_PROMPT_VERSION,
        ),
        evaluator_version=EVALUATOR_VERSION,
        prompt_version=TEST_PROMPT_VERSION,
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
    assert results[0].prompt_version == TEST_PROMPT_VERSION
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


def test_cached_evaluation_survives_goal_prompt_and_card_context_changes() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=DeckFormat.COMMANDER,
        description="",
        goal="A completely different goal using [[A Missing Catalog Card]].",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=99,
    )
    subject = _cardset("subject")
    deck.cardsets = [subject]
    cached = CardRoleEvaluation(
        deck_id=deck.id,
        deck_revision=1,
        context_key="old-context",
        evaluator_version="old-evaluator",
        prompt_version="old-prompt",
        oracle_id=subject.oracle_id,
        overall_comment="Still cached.",
        roles=[],
    )
    db = FakeDb([cached])
    evaluator = FakeEvaluator(prompt_version="new-prompt")

    result = asyncio.run(
        evaluate_oracle_ids(cast("Session", db), deck, [subject.oracle_id], evaluator)
    )

    assert result[0].cached is True
    assert result[0].deck_revision == 1
    assert result[0].prompt_version == "old-prompt"
    assert evaluator.max_active == 0


def test_force_regeneration_overwrites_the_deck_oracle_cache_entry() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=DeckFormat.COMMANDER,
        description="",
        goal="Control the board.",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=8,
    )
    subject = _cardset("subject")
    deck.cardsets = [subject]
    cached = CardRoleEvaluation(
        deck_id=deck.id,
        deck_revision=1,
        context_key="old-context",
        evaluator_version="old-evaluator",
        prompt_version="old-prompt",
        oracle_id=subject.oracle_id,
        overall_comment="Old result.",
        roles=[],
    )
    db = FakeDb([cached])
    evaluator = FakeEvaluator(prompt_version="new-prompt")

    result = asyncio.run(
        evaluate_oracle_ids(
            cast("Session", db),
            deck,
            [subject.oracle_id],
            evaluator,
            force=True,
        )
    )

    assert result[0].cached is False
    assert result[0].deck_revision == 8
    assert result[0].prompt_version == "new-prompt"
    assert cached.deck_revision == 8
    assert cached.prompt_version == "new-prompt"
    assert cached.overall_comment == result[0].overall_comment
    assert db.added == []


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
    context_card = _cardset("context")
    subject = _cardset("subject")
    deck.cardsets = [commander, context_card, subject]

    first = _context_key(deck, subject.oracle_id, _brief("subject"), "None")
    deck.revision = 4

    assert _context_key(deck, subject.oracle_id, _brief("subject"), "None") == first


def test_context_key_changes_with_prompt_artifact() -> None:
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
    subject = _cardset("subject")
    deck.cardsets = [subject]

    first = _context_key(
        deck,
        subject.oracle_id,
        _brief("subject"),
        "None",
        prompt_version="gepa-first",
    )
    second = _context_key(
        deck,
        subject.oracle_id,
        _brief("subject"),
        "None",
        prompt_version="gepa-second",
    )

    assert first != second


def test_prompt_version_hashes_the_exact_artifact(tmp_path: Path) -> None:
    artifact = tmp_path / "program.json"
    artifact.write_text('{"instructions":"first"}')
    first = _prompt_version(artifact)
    artifact.write_text('{"instructions":"second"}')

    assert first.startswith("gepa-")
    assert _prompt_version(artifact) != first


def test_evaluation_context_only_contains_goal_mentions_card_and_static_rubrics() -> None:
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
    subject = _cardset("subject")
    deck.cardsets = [commander, support, subject]

    evaluation_input = _evaluation_input_with_rubrics(
        deck,
        subject.oracle_id,
        _brief("subject"),
        _brief("mentioned-card"),
    )

    assert "North Star:\nControl the board and accumulate cards." in evaluation_input
    assert "Name: mentioned-card" in evaluation_input
    assert "Name: commander" not in evaluation_input
    assert "Name: support" not in evaluation_input
    assert "Commander:" not in evaluation_input
    assert "Deck shape" not in evaluation_input
    assert f"Card under evaluation:\n{_brief('subject')}" in evaluation_input
    assert "Role definitions and rubrics:" in evaluation_input
    rubric_payload = json.loads(evaluation_input.split("Role definitions and rubrics:\n", 1)[1])
    assert rubric_payload["card_advantage"]["definition"] == ROLE_DEFINITIONS["card_advantage"]

    instructions = _evaluation_instructions()
    assert "deck shape" not in instructions.casefold()
    assert "deck's own board" not in instructions.casefold()


def _catalog_card(name: str, *, type_line: str = "Sorcery") -> CatalogCard:
    snapshot = ScryfallCardSnapshot(
        id=f"cat-{name}",
        oracle_id=f"oracle-{name}",
        name=name,
        lang="en",
        layout="normal",
        cmc=2,
        type_line=type_line,
        oracle_text="Do a relevant thing.",
        legalities={"commander": "legal"},
        set="tst",
        set_name="Test",
        collector_number="1",
        rarity="rare",
        scryfall_uri="https://example.test/card",
    )
    return CatalogCard(snapshot=snapshot.model_dump(mode="json"))


class CatalogFakeDb(FakeDb):
    """Resolves referenced-card lookups from a catalog, like the real Session."""

    def __init__(self, catalog: dict[str, CatalogCard]) -> None:
        super().__init__()
        for name, card in catalog.items():
            card.name = name
        self._catalog = {name.lower(): card for name, card in catalog.items()}
        self.catalog_round_trips = 0

    def scalar(self, statement: object) -> CatalogCard | None:
        self.catalog_round_trips += 1
        compiled = cast("ClauseElement", statement).compile()
        for value in compiled.params.values():
            card = self._catalog.get(str(value).lower())
            if card is not None:
                return card
        return None

    def scalars(self, statement: object) -> list[object]:
        del statement
        self.catalog_round_trips += 1
        return list(self._catalog.values())

    def execute(self, statement: object) -> list[tuple[str, CatalogCard]]:
        del statement
        self.catalog_round_trips += 1
        return [(card.name, card) for card in self._catalog.values()]


def test_referenced_card_context_expands_goal_mentions_from_the_catalog() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=DeckFormat.COMMANDER,
        description="",
        goal="Recur lands with [[Ramunap Excavator]].",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=3,
    )
    subject = _cardset("subject")
    subject.note = "Sacrifice fodder for [[Victimize]]."
    deck.cardsets = [subject]
    db = CatalogFakeDb(
        {
            "Ramunap Excavator": _catalog_card("Ramunap Excavator", type_line="Creature — Cat"),
            "Victimize": _catalog_card("Victimize"),
        }
    )

    references = _referenced_card_context(cast("Session", db), deck, subject.oracle_id)

    assert "Name: Ramunap Excavator" in references
    assert "Type: Creature — Cat" in references
    assert "Name: Victimize" in references


def test_referenced_card_contexts_resolve_shared_mentions_once_per_load() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=DeckFormat.COMMANDER,
        description="",
        goal="Recur lands with [[Ramunap Excavator]].",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=3,
    )
    first = _cardset("first")
    first.note = "Sacrifice fodder for [[Victimize]]."
    second = _cardset("second")
    deck.cardsets = [first, second]
    db = CatalogFakeDb(
        {
            "Ramunap Excavator": _catalog_card("Ramunap Excavator"),
            "Victimize": _catalog_card("Victimize"),
        }
    )
    contexts = _referenced_card_contexts(
        cast("Session", db), deck, [first.oracle_id, second.oracle_id]
    )

    assert db.catalog_round_trips == 1
    assert "Name: Victimize" in contexts[first.oracle_id]
    assert "Name: Victimize" not in contexts[second.oracle_id]


def test_referenced_card_context_fails_on_an_unknown_reference() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=DeckFormat.COMMANDER,
        description="",
        goal="Dig with [[Definitely Not A Real Card]].",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=3,
    )
    subject = _cardset("subject")
    deck.cardsets = [subject]

    with pytest.raises(ReferencedCardNotFoundError, match="Definitely Not A Real Card"):
        _referenced_card_context(cast("Session", CatalogFakeDb({})), deck, subject.oracle_id)


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
        "- Creatures: some\n- Enchantments: most\n- Lands: some\nProminent subtypes:\n- Bear: some"
    )

    deck.cardsets = [
        *enchantments[:11],
        *creatures,
        *lands,
        _cardset("swap", type_line="Enchantment"),
    ]

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
    swamps = [_cardset(f"swamp-{index}", type_line="Basic Land — Swamp") for index in range(2)]
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


def test_overall_score_adds_rank_discounted_role_scores() -> None:
    perfect_everywhere = [
        _role_score(role, 100, "Perfect")
        for role in ("card_advantage", "mass_disruption", "payoff", "enabler", "enhancer")
    ]
    expected = round(
        sum(
            role.score / math.pow(rank, OVERALL_SCORE_WEIGHTING_EXPONENT)
            for rank, role in enumerate(perfect_everywhere, start=1)
        )
    )
    assert expected > 100
    assert _calculate_overall_score(perfect_everywhere) == expected

    strong_pair = [
        _role_score("card_advantage", 90, "Primary"),
        _role_score("mass_disruption", 80, "Secondary"),
    ]
    assert _calculate_overall_score(strong_pair) == round(
        90 + 80 / math.pow(2, OVERALL_SCORE_WEIGHTING_EXPONENT)
    )
    assert _calculate_overall_score(strong_pair) == 104


def test_overall_score_rewards_even_modest_additional_roles() -> None:
    padded = [
        _role_score("card_advantage", 90, "Primary"),
        _role_score("enabler", 50, "Baseline secondary"),
        _role_score("enhancer", 35, "Weak tertiary"),
    ]
    assert _calculate_overall_score(padded) == round(
        90
        + 50 / math.pow(2, OVERALL_SCORE_WEIGHTING_EXPONENT)
        + 35 / math.pow(3, OVERALL_SCORE_WEIGHTING_EXPONENT)
    )
    assert _calculate_overall_score(padded) == 101


def test_low_defining_criterion_does_not_drop_an_applicable_role() -> None:
    def llmaaj_with_net_gain(rating: QualitativeRating) -> StructuredLLMaaJ:
        payload = dict.fromkeys(ROLE_NAMES, "N/A")
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

    role_score = _role_score_from_llmaaj(
        "card_advantage", llmaaj_with_net_gain(QualitativeRating.LOW), is_land=False
    )

    assert role_score is not None
    assert role_score.role == "card_advantage"
    assert _role_json(role_score)["score"] == 65


def test_structured_role_outputs_include_role_description_but_not_per_answer_prose() -> None:
    score_schema = StructuredLLMaaJ.model_json_schema()
    assert set(score_schema["properties"]) == {*ROLE_NAMES, "overall_summary"}
    enhancer = score_schema["$defs"]["EnhancerApplicableRole"]
    enhancer_answers_ref = enhancer["properties"]["answers"]["$ref"].split("/")[-1]
    enhancer_answers = score_schema["$defs"][enhancer_answers_ref]
    assert set(enhancer_answers["properties"]) == set(ROLE_RUBRICS["enhancer"])


def test_structured_role_output_accepts_json_rating_strings_from_dspy() -> None:
    payload: dict[str, object] = dict.fromkeys(ROLE_NAMES, "N/A")
    payload["card_selection"] = {
        "description": "Selects a permanent from the milled cards.",
        "answers": {
            "access": "high",
            "efficiency": "high",
            "range": "neutral",
            "setup_value": "high",
            "timing": "high",
        },
    }
    payload["overall_summary"] = "Efficient card selection with graveyard setup value."

    result = StructuredLLMaaJ.model_validate(payload)

    card_selection = result.card_selection
    assert card_selection.answers.access is QualitativeRating.HIGH


def test_dspy_role_evaluator_runs_the_structured_program() -> None:
    payload = dict.fromkeys(ROLE_NAMES, "N/A")
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

    class FakeProgram:
        context = ""

        async def acall(self, *, evaluation_context: str) -> object:
            self.context = evaluation_context
            return type("Prediction", (), {"evaluation": result})()

    evaluator = DSPyRoleEvaluator("test-key", "test-model")
    program = FakeProgram()
    evaluator._program = cast("object", program)
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
    assert "Role definitions and rubrics:" in program.context


def test_evaluator_guidelines_do_not_name_labeled_cards() -> None:
    golden_path = Path(__file__).parents[1] / "scripts" / "judge_eval_golden.json"
    golden = json.loads(golden_path.read_text())
    labeled_names = {name for deck in golden["decks"].values() for name in deck["cards"]}
    guidelines = _evaluation_instructions() + json.dumps(
        {"definitions": ROLE_DEFINITIONS, "rubrics": ROLE_RUBRICS}
    )

    assert not sorted(name for name in labeled_names if name.casefold() in guidelines.casefold())


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
