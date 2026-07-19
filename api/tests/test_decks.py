import uuid
from dataclasses import dataclass

import pytest
from pydantic import ValidationError

from survail.core.models import CardZone, DeckFormat
from survail.core.schemas import (
    CommanderDeckMetadata,
    DeckCreate,
    DeckOperationChangeCreate,
    DeckOperationCreate,
    DeckOperationRevertCreate,
    DeckUpdate,
    ScryfallCardSnapshot,
)
from survail.core.types import JsonObject
from survail.modules.decks.service.cardsets import set_cardset_note
from survail.modules.decks.service.validate import validate_deck


def snapshot(
    name: str,
    oracle_id: str,
    *,
    type_line: str = "Instant",
    colors: list[str] | None = None,
    legality: str = "legal",
    oracle_text: str | None = None,
    keywords: list[str] | None = None,
) -> JsonObject:
    return ScryfallCardSnapshot(
        id=f"printing-{oracle_id}",
        oracle_id=oracle_id,
        name=name,
        lang="en",
        layout="normal",
        cmc=1,
        type_line=type_line,
        colors=colors or [],
        color_identity=colors or [],
        oracle_text=oracle_text,
        keywords=keywords or [],
        legalities={deck_format.value: legality for deck_format in DeckFormat},
        set="tst",
        set_name="Test",
        collector_number="1",
        rarity="common",
        scryfall_uri="https://example.test/card",
    ).model_dump(mode="json")


@dataclass
class FakeCardSet:
    id: uuid.UUID
    quantity: int
    zone: CardZone
    oracle_id: str
    card_name: str
    scryfall: JsonObject


def card(
    name: str,
    oracle_id: str,
    quantity: int = 1,
    *,
    type_line: str = "Instant",
    colors: list[str] | None = None,
    legality: str = "legal",
    oracle_text: str | None = None,
    keywords: list[str] | None = None,
) -> FakeCardSet:
    return FakeCardSet(
        id=uuid.uuid4(),
        quantity=quantity,
        zone=CardZone.MAINBOARD,
        oracle_id=oracle_id,
        card_name=name,
        scryfall=snapshot(
            name,
            oracle_id,
            type_line=type_line,
            colors=colors,
            legality=legality,
            oracle_text=oracle_text,
            keywords=keywords,
        ),
    )


def test_commander_validation_accepts_valid_mono_color_deck() -> None:
    commander = card("Commander", "commander", type_line="Legendary Creature", colors=["U"])
    commander.zone = CardZone.COMMANDER
    islands = card("Island", "island", 99, type_line="Basic Land - Island", colors=["U"])

    count, errors = validate_deck(
        DeckFormat.COMMANDER,
        CommanderDeckMetadata(commander_oracle_ids=["commander"]),
        [commander, islands],
    )

    assert count == 100
    assert errors == []


def test_commander_validation_rejects_cards_outside_color_identity() -> None:
    commander = card("Commander", "commander", type_line="Legendary Creature", colors=["U"])
    commander.zone = CardZone.COMMANDER
    off_color = card("Lightning Bolt", "bolt", colors=["R"])

    _, errors = validate_deck(
        DeckFormat.COMMANDER,
        CommanderDeckMetadata(commander_oracle_ids=["commander"]),
        [commander, off_color],
    )

    assert any(
        error.code == "color_identity" and error.cardset_id == off_color.id for error in errors
    )
    assert next(error for error in errors if error.code == "color_identity").error_id == (
        "color_identity"
    )


def test_constructed_formats_do_not_apply_commander_color_identity() -> None:
    red_card = card("Lightning Bolt", "bolt", colors=["R"])

    _, errors = validate_deck(
        DeckFormat.MODERN,
        DeckCreate.model_validate(
            {"title": "Modern", "format": "modern", "metadata": {"kind": "generic"}}
        ).metadata,
        [red_card],
    )

    assert not any(error.code == "color_identity" for error in errors)


def test_copy_limits_aggregate_multiple_printings() -> None:
    commander = card("Commander", "commander", type_line="Legendary Creature", colors=["U"])
    first = card("Counterspell", "counterspell")
    second = card("Counterspell", "counterspell")

    _, errors = validate_deck(
        DeckFormat.COMMANDER,
        CommanderDeckMetadata(commander_oracle_ids=["commander"]),
        [commander, first, second],
    )

    assert sum(error.code == "copy_limit" for error in errors) == 1


def test_commander_count_uses_commander_zone() -> None:
    commander = card("Commander", "commander", type_line="Legendary Creature", colors=["U"])

    _, errors = validate_deck(
        DeckFormat.COMMANDER,
        CommanderDeckMetadata(commander_oracle_ids=["commander"]),
        [commander],
    )

    assert any(error.code == "commander_count" for error in errors)


def test_invalid_decks_return_errors_without_raising() -> None:
    count, errors = validate_deck(
        DeckFormat.COMMANDER,
        CommanderDeckMetadata(commander_oracle_ids=[]),
        [card("Black Lotus", "lotus", legality="banned")],
    )

    assert count == 1
    assert any(error.code == "commander_count" for error in errors)
    assert any(error.code == "format_legality" for error in errors)


def test_json_enum_values_are_accepted_without_general_type_coercion() -> None:
    deck = DeckCreate.model_validate(
        {
            "title": "Deck",
            "format": "commander",
            "metadata": {"kind": "commander", "commander_oracle_ids": []},
        }
    )
    change = DeckOperationChangeCreate.model_validate(
        {"printing_id": "printing", "quantity_delta": 1, "zone": "mainboard", "finish": "foil"}
    )

    assert deck.format == DeckFormat.COMMANDER
    assert change.zone == CardZone.MAINBOARD
    assert change.quantity_delta == 1


def test_operation_tags_are_cleaned_deduplicated_and_default_to_omitted() -> None:
    tagged = DeckOperationChangeCreate(
        printing_id="printing",
        quantity_delta=1,
        tags=[" Ramp ", "Ramp", "Removal"],
    )
    untagged = DeckOperationChangeCreate(printing_id="printing", quantity_delta=1)

    assert tagged.tags == ["Ramp", "Removal"]
    assert untagged.tags is None


def test_operation_note_is_trimmed() -> None:
    change = DeckOperationChangeCreate(
        printing_id="printing",
        quantity_delta=1,
        note="  save for combo turn  ",
    )

    assert change.note == "save for combo turn"


def test_considering_cards_do_not_affect_validation() -> None:
    commander = card("Commander", "commander", type_line="Legendary Creature", colors=["U"])
    commander.zone = CardZone.COMMANDER
    islands = card("Island", "island", 99, type_line="Basic Land - Island", colors=["U"])
    considering = card("Black Lotus", "lotus", 500, legality="banned")
    considering.zone = CardZone.CONSIDERING

    count, errors = validate_deck(
        DeckFormat.COMMANDER,
        CommanderDeckMetadata(commander_oracle_ids=["commander"]),
        [commander, islands, considering],
    )

    assert count == 100
    assert errors == []


def test_constructed_sideboard_limit_is_strategy_owned() -> None:
    main = card("Island", "island", 60, type_line="Basic Land - Island")
    sideboard = card("Counterspell", "counterspell", 16)
    sideboard.zone = CardZone.SIDEBOARD

    _, errors = validate_deck(
        DeckFormat.MODERN,
        DeckCreate.model_validate(
            {"title": "Modern", "format": "modern", "metadata": {"kind": "generic"}}
        ).metadata,
        [main, sideboard],
    )

    assert any(error.code == "sideboard_size" for error in errors)


def test_commander_must_be_eligible() -> None:
    commander = card("Ordinary Bear", "bear", type_line="Creature - Bear")
    commander.zone = CardZone.COMMANDER

    _, errors = validate_deck(
        DeckFormat.COMMANDER,
        CommanderDeckMetadata(commander_oracle_ids=["bear"]),
        [commander],
    )

    assert any(error.code == "commander_eligibility" for error in errors)


def test_choose_a_background_allows_matching_background() -> None:
    commander = card(
        "Agent",
        "agent",
        type_line="Legendary Creature - Human",
        keywords=["Choose a Background"],
    )
    commander.zone = CardZone.COMMANDER
    background = card(
        "Raised by Giants",
        "background",
        type_line="Legendary Enchantment - Background",
    )
    background.zone = CardZone.COMMANDER

    _, errors = validate_deck(
        DeckFormat.COMMANDER,
        CommanderDeckMetadata(commander_oracle_ids=["agent", "background"]),
        [commander, background],
    )

    assert not any(error.code in {"commander_eligibility", "commander_pair"} for error in errors)


def test_unrelated_legendary_creatures_cannot_be_co_commanders() -> None:
    first = card("First", "first", type_line="Legendary Creature")
    first.zone = CardZone.COMMANDER
    second = card("Second", "second", type_line="Legendary Creature")
    second.zone = CardZone.COMMANDER

    _, errors = validate_deck(
        DeckFormat.COMMANDER,
        CommanderDeckMetadata(commander_oracle_ids=["first", "second"]),
        [first, second],
    )

    assert any(error.code == "commander_pair" for error in errors)


def test_partner_with_does_not_pair_with_an_unrelated_partner() -> None:
    first = card(
        "Specific Partner",
        "specific",
        type_line="Legendary Creature",
        oracle_text="Partner with Missing Partner",
        keywords=["Partner"],
    )
    first.zone = CardZone.COMMANDER
    second = card(
        "Generic Partner",
        "generic",
        type_line="Legendary Creature",
        keywords=["Partner"],
    )
    second.zone = CardZone.COMMANDER

    _, errors = validate_deck(
        DeckFormat.COMMANDER,
        CommanderDeckMetadata(commander_oracle_ids=["specific", "generic"]),
        [first, second],
    )

    assert any(error.code == "commander_pair" for error in errors)


def test_commander_cardset_must_have_quantity_one() -> None:
    commander = card("Commander", "commander", 2, type_line="Legendary Creature")
    commander.zone = CardZone.COMMANDER

    _, errors = validate_deck(
        DeckFormat.COMMANDER,
        CommanderDeckMetadata(commander_oracle_ids=["commander"]),
        [commander],
    )

    assert any(error.code == "commander_quantity" for error in errors)


def test_brawl_allows_legendary_planeswalker_commander() -> None:
    commander = card("Teferi", "teferi", type_line="Legendary Planeswalker - Teferi")
    commander.zone = CardZone.COMMANDER

    _, errors = validate_deck(
        DeckFormat.BRAWL,
        DeckCreate.model_validate(
            {
                "title": "Brawl",
                "format": "brawl",
                "metadata": {"kind": "brawl", "commander_oracle_id": "teferi"},
            }
        ).metadata,
        [commander],
    )

    assert not any(error.code == "commander_eligibility" for error in errors)


def test_named_unlimited_copy_card_ignores_commander_copy_limit() -> None:
    commander = card("Commander", "commander", type_line="Legendary Creature")
    commander.zone = CardZone.COMMANDER
    rats = card(
        "Relentless Rats",
        "rats",
        99,
        type_line="Creature - Rat",
        oracle_text="A deck can have any number of cards named Relentless Rats.",
    )

    _, errors = validate_deck(
        DeckFormat.COMMANDER,
        CommanderDeckMetadata(commander_oracle_ids=["commander"]),
        [commander, rats],
    )

    assert not any(error.code == "copy_limit" for error in errors)


def test_companion_must_have_keyword() -> None:
    main = card("Island", "island", 60, type_line="Basic Land - Island")
    companion = card("Not a Companion", "not-companion")
    companion.zone = CardZone.COMPANION

    _, errors = validate_deck(
        DeckFormat.MODERN,
        DeckCreate.model_validate(
            {"title": "Modern", "format": "modern", "metadata": {"kind": "generic"}}
        ).metadata,
        [main, companion],
    )

    assert any(error.code == "companion_eligibility" for error in errors)


def test_constructed_companion_consumes_sideboard_slot() -> None:
    main = card("Island", "island", 60, type_line="Basic Land - Island")
    sideboard = card("Counterspell", "counterspell", 15)
    sideboard.zone = CardZone.SIDEBOARD
    companion = card("Kaheera", "kaheera", keywords=["Companion"])
    companion.zone = CardZone.COMPANION

    _, errors = validate_deck(
        DeckFormat.MODERN,
        DeckCreate.model_validate(
            {"title": "Modern", "format": "modern", "metadata": {"kind": "generic"}}
        ).metadata,
        [main, sideboard, companion],
    )

    assert any(error.code == "sideboard_size" for error in errors)


def test_operation_requests_accept_json_uuid_strings() -> None:
    operation_id = str(uuid.uuid4())

    operation = DeckOperationCreate.model_validate(
        {
            "client_operation_id": operation_id,
            "expected_revision": 0,
            "changes": [
                {
                    "printing_id": "printing",
                    "quantity_delta": 1,
                    "zone": "mainboard",
                    "finish": "nonfoil",
                }
            ],
        }
    )
    revert = DeckOperationRevertCreate.model_validate(
        {"client_operation_id": operation_id, "expected_revision": 1}
    )

    assert str(operation.client_operation_id) == operation_id
    assert str(revert.client_operation_id) == operation_id


def test_deck_goal_schema_is_strict_and_legacy_rubric_is_rejected() -> None:
    deck = DeckCreate.model_validate(
        {
            "title": "Deck",
            "format": "modern",
            "goal": "Win with artifacts.",
            "metadata": {"kind": "generic"},
        }
    )

    assert deck.goal == "Win with artifacts."
    with pytest.raises(ValidationError):
        DeckUpdate.model_validate(
            {"rubric": [{"description": "Adds interaction", "example": "Counters a spell"}]}
        )


def test_cardset_notes_are_trimmed_and_persisted() -> None:
    owner = uuid.uuid4()
    actor = type("Actor", (), {"id": owner})()
    deck = type("DeckRecord", (), {})()
    deck.id = uuid.uuid4()
    deck.owner_id = owner
    deck.updated_at = None
    cardset = type("CardsetRecord", (), {})()
    cardset.id = uuid.uuid4()
    cardset.note = None
    deck.cardsets = [cardset]

    class FakeDb:
        committed = False

        def scalar(self, statement: object) -> object:
            del statement
            return deck

        def commit(self) -> None:
            self.committed = True

    result = set_cardset_note(
        FakeDb(),
        deck.id,
        cardset.id,
        actor,
        note="  keep for post-wipe rebuild  ",
    )

    assert result is deck
    assert cardset.note == "keep for post-wipe rebuild"
