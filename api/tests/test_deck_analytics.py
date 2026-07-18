import uuid

from survail.core.models import CardFinish, CardSet, CardZone, Deck, DeckFormat
from survail.core.schemas import CardFace, ScryfallCardSnapshot
from survail.modules.decks.evaluations.api.schemas import CardRoleEvaluationRead
from survail.modules.decks.service.analytics import (
    color_pip_counts,
    mana_curve_counts,
    role_distribution_counts,
    type_distribution_counts,
)


def _cardset(
    oracle_id: str,
    *,
    name: str,
    quantity: int,
    zone: CardZone = CardZone.MAINBOARD,
    mana_cost: str | None = None,
    cmc: float = 0,
    type_line: str = "Creature",
    card_faces: list[CardFace] | None = None,
) -> CardSet:
    snapshot = ScryfallCardSnapshot(
        id=f"printing-{oracle_id}",
        oracle_id=oracle_id,
        name=name,
        lang="en",
        layout="modal_dfc" if card_faces else "normal",
        mana_cost=mana_cost,
        cmc=cmc,
        type_line=type_line,
        oracle_text="Test rules text",
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
        quantity=quantity,
        zone=zone,
        finish=CardFinish.NONFOIL,
        printing_id=snapshot.id,
        oracle_id=oracle_id,
        card_name=name,
        set_code="tst",
        collector_number="1",
        note=None,
        core=False,
        tags=[],
        scryfall=snapshot.model_dump(mode="json"),
    )


def test_deck_analytics_excludes_lands_from_curve_and_counts_colorless_and_hybrid_pips() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Analytics",
        format=DeckFormat.COMMANDER,
        description="",
        goal="",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=1,
    )
    deck.cardsets = [
        _cardset("land", name="Forest", quantity=3, type_line="Basic Land"),
        _cardset("eldrazi", name="Thought-Knot Seer", quantity=2, mana_cost="{3}{C}", cmc=4),
        _cardset("hybrid", name="Kitchen Finks", quantity=1, mana_cost="{1}{G/W}{G/W}", cmc=3),
    ]

    assert mana_curve_counts(deck) == {"4": 2, "3": 1}
    assert color_pip_counts(deck) == {"W": 2, "G": 2, "C": 2}


def test_type_distribution_counts_multifaced_cards_in_each_matching_category() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Analytics",
        format=DeckFormat.COMMANDER,
        description="",
        goal="",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=1,
    )
    deck.cardsets = [
        _cardset(
            "mdfc",
            name="Disciple of Freyalise",
            quantity=1,
            type_line="Creature // Land",
            card_faces=[
                CardFace(name="Disciple of Freyalise", mana_cost="{2}{G}", type_line="Creature — Elf Druid"),
                CardFace(name="Garden of Freyalise", mana_cost="", type_line="Land"),
            ],
        )
    ]

    assert type_distribution_counts(deck) == {"Creature": 1, "Land": 1}


def test_role_distribution_counts_quantities_for_each_assigned_role() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Analytics",
        format=DeckFormat.MODERN,
        description="",
        goal="",
        metadata_json={"kind": "generic"},
        revision=1,
    )
    deck.cardsets = [
        _cardset("engine", name="Engine Card", quantity=2),
        _cardset("support", name="Support Card", quantity=1),
    ]
    evaluations = [
        CardRoleEvaluationRead.model_validate(
            {
                "oracle_id": "engine",
                "deck_revision": 1,
                "evaluator_version": "roles-v6",
                "overall_score": 120,
                "overall_comment": "",
                "cached": True,
                "roles": [
                    {"role": "enabler", "score": 80, "description": "", "answers": {}},
                    {"role": "payoff", "score": 70, "description": "", "answers": {}},
                ],
            },
            strict=False,
        ),
        CardRoleEvaluationRead.model_validate(
            {
                "oracle_id": "support",
                "deck_revision": 1,
                "evaluator_version": "roles-v6",
                "overall_score": 80,
                "overall_comment": "",
                "cached": True,
                "roles": [
                    {"role": "enhancer", "score": 80, "description": "", "answers": {}}
                ],
            },
            strict=False,
        ),
    ]

    assert role_distribution_counts(deck, evaluations) == {
        "enabler": 2,
        "payoff": 2,
        "enhancer": 1,
    }


def test_core_only_analytics_scope_uses_only_starred_cards() -> None:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Analytics",
        format=DeckFormat.COMMANDER,
        description="",
        goal="",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
        revision=1,
    )
    starred = _cardset("starred", name="Starred Spell", quantity=2, mana_cost="{1}{W}", cmc=2)
    starred.core = True
    unstarred = _cardset(
        "unstarred", name="Unstarred Spell", quantity=3, mana_cost="{2}{G}", cmc=3
    )
    deck.cardsets = [starred, unstarred]

    assert mana_curve_counts(deck, core_only=True) == {"2": 2}
    assert color_pip_counts(deck, core_only=True) == {"W": 2}
