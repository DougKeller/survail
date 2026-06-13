import uuid
from collections import defaultdict
from dataclasses import dataclass

from survail.core.models import CardFinish, CardSet, CardZone, Deck, DeckFormat
from survail.core.schemas import ScryfallCardSnapshot
from survail.modules.decks.operations.service.apply import (
    CardSetIdentity,
    _replace_incompatible_commanders,
)


def snapshot(
    name: str,
    oracle_id: str,
    *,
    keywords: list[str] | None = None,
    oracle_text: str | None = None,
) -> ScryfallCardSnapshot:
    return ScryfallCardSnapshot(
        id=f"printing-{oracle_id}",
        oracle_id=oracle_id,
        name=name,
        lang="en",
        layout="normal",
        cmc=2,
        type_line="Legendary Creature",
        oracle_text=oracle_text,
        keywords=keywords or [],
        legalities={"commander": "legal"},
        set="tst",
        set_name="Test",
        collector_number="1",
        rarity="rare",
        finishes=["nonfoil"],
        scryfall_uri="https://example.test/card",
    )


def commander(
    card: ScryfallCardSnapshot,
    finish: CardFinish = CardFinish.NONFOIL,
) -> CardSet:
    return CardSet(
        id=uuid.uuid4(),
        deck_id=uuid.uuid4(),
        quantity=1,
        zone=CardZone.COMMANDER,
        finish=finish,
        printing_id=card.id,
        oracle_id=card.oracle_id,
        card_name=card.name,
        set_code=card.set,
        collector_number=card.collector_number,
        tags=["Commander"],
        scryfall=card.model_dump(mode="json"),
    )


def deck_with(
    existing: ScryfallCardSnapshot,
    deck_format: DeckFormat = DeckFormat.COMMANDER,
    finish: CardFinish = CardFinish.NONFOIL,
) -> Deck:
    result = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=deck_format,
        description="",
        metadata_json={"kind": "commander", "commander_oracle_ids": [existing.oracle_id]},
    )
    result.cardsets = [commander(existing, finish)]
    return result


@dataclass
class FakeCatalog:
    cards: dict[str, ScryfallCardSnapshot]

    def get_printing(self, printing_id: str) -> ScryfallCardSnapshot | None:
        return self.cards.get(printing_id)


def changes_for(incoming: ScryfallCardSnapshot) -> dict[CardSetIdentity, int]:
    return defaultdict(
        int,
        {(incoming.id, CardFinish.NONFOIL, CardZone.COMMANDER): 1},
    )


def test_incompatible_existing_commander_moves_to_mainboard() -> None:
    existing = snapshot("Existing", "existing")
    incoming = snapshot("Incoming", "incoming")
    deck = deck_with(existing)
    deltas = changes_for(incoming)
    tags: dict[CardSetIdentity, list[str]] = {}

    _replace_incompatible_commanders(deck, deltas, tags, FakeCatalog({incoming.id: incoming}))

    assert deltas[(existing.id, CardFinish.NONFOIL, CardZone.COMMANDER)] == -1
    assert deltas[(existing.id, CardFinish.NONFOIL, CardZone.MAINBOARD)] == 1
    assert tags[(existing.id, CardFinish.NONFOIL, CardZone.MAINBOARD)] == ["Commander"]


def test_compatible_partner_commander_remains_in_command_zone() -> None:
    existing = snapshot("Existing", "existing", keywords=["Partner"])
    incoming = snapshot("Incoming", "incoming", keywords=["Partner"])
    deck = deck_with(existing)
    deltas = changes_for(incoming)

    _replace_incompatible_commanders(deck, deltas, {}, FakeCatalog({incoming.id: incoming}))

    assert (existing.id, CardFinish.NONFOIL, CardZone.COMMANDER) not in deltas
    assert (existing.id, CardFinish.NONFOIL, CardZone.MAINBOARD) not in deltas


def test_brawl_always_replaces_existing_commander() -> None:
    existing = snapshot("Existing", "existing", keywords=["Partner"])
    incoming = snapshot("Incoming", "incoming", keywords=["Partner"])
    deck = deck_with(existing, DeckFormat.BRAWL)
    deltas = changes_for(incoming)

    _replace_incompatible_commanders(deck, deltas, {}, FakeCatalog({incoming.id: incoming}))

    assert deltas[(existing.id, CardFinish.NONFOIL, CardZone.COMMANDER)] == -1
    assert deltas[(existing.id, CardFinish.NONFOIL, CardZone.MAINBOARD)] == 1


def test_replacing_foil_commander_adds_missing_deltas_without_key_error() -> None:
    existing = snapshot("Existing", "existing")
    incoming = snapshot("Incoming", "incoming")
    deck = deck_with(existing, finish=CardFinish.FOIL)
    deltas = dict(changes_for(incoming))

    _replace_incompatible_commanders(deck, deltas, {}, FakeCatalog({incoming.id: incoming}))

    assert deltas[(existing.id, CardFinish.FOIL, CardZone.COMMANDER)] == -1
    assert deltas[(existing.id, CardFinish.FOIL, CardZone.MAINBOARD)] == 1
