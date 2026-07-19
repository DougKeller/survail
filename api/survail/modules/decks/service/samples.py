import uuid

from sqlalchemy.orm import Session

from survail.core.models import CardFinish, CardZone, Deck, DeckFormat, User
from survail.core.schemas import CommanderDeckMetadata
from survail.modules.cards.repository.cards import CatalogRepository
from survail.modules.decks.contracts import CloneDeckRequest
from survail.modules.decks.operations.contracts import (
    DeckOperationChangeCreate,
    DeckOperationCreate,
)
from survail.modules.decks.operations.service.apply import apply_deck_operation

SAMPLE_COMMANDER = "Talrand, Sky Summoner"
SAMPLE_CARDS: dict[str, int] = {
    "Island": 36,
    "Sol Ring": 1,
    "Arcane Signet": 1,
    "Mind Stone": 1,
    "Sky Diamond": 1,
    "Thought Vessel": 1,
    "Wayfarer's Bauble": 1,
    "Counterspell": 1,
    "Negate": 1,
    "Arcane Denial": 1,
    "Disdainful Stroke": 1,
    "Essence Scatter": 1,
    "Exclude": 1,
    "Rewind": 1,
    "Saw It Coming": 1,
    "Swan Song": 1,
    "Pongify": 1,
    "Rapid Hybridization": 1,
    "Reality Shift": 1,
    "Resculpt": 1,
    "Ravenform": 1,
    "Into the Roil": 1,
    "Blink of an Eye": 1,
    "Aetherize": 1,
    "Engulf the Shore": 1,
    "Evacuation": 1,
    "Opt": 1,
    "Consider": 1,
    "Brainstorm": 1,
    "Ponder": 1,
    "Preordain": 1,
    "Impulse": 1,
    "Frantic Search": 1,
    "Behold the Multiverse": 1,
    "Chemister's Insight": 1,
    "Fact or Fiction": 1,
    "Treasure Cruise": 1,
    "Dig Through Time": 1,
    "Mystic Remora": 1,
    "Bident of Thassa": 1,
    "Coastal Piracy": 1,
    "Reconnaissance Mission": 1,
    "Favorable Winds": 1,
    "Gravitational Shift": 1,
    "Shark Typhoon": 1,
    "Murmuring Mystic": 1,
    "Archmage Emeritus": 1,
    "Wavebreak Hippocamp": 1,
    "Deekah, Fractal Theorist": 1,
    "Docent of Perfection": 1,
    "Metallurgic Summonings": 1,
    "Stormtide Leviathan": 1,
    "Hullbreaker Horror": 1,
    "Scourge of Fleets": 1,
    "Windreader Sphinx": 1,
    "Curiosity": 1,
    "Keep Watch": 1,
    "Distant Melody": 1,
    "High Tide": 1,
    "Merchant Scroll": 1,
    "Mystical Tutor": 1,
    "Solve the Equation": 1,
    "Reliquary Tower": 1,
    "Myriad Landscape": 1,
}


class SampleCatalogIncompleteError(LookupError):
    pass


def create_sample_commander_deck(db: Session, user: User, payload: CloneDeckRequest) -> Deck:
    catalog = CatalogRepository(db)
    commander = catalog.exact_name(SAMPLE_COMMANDER)
    resolved = [(catalog.exact_name(name), quantity) for name, quantity in SAMPLE_CARDS.items()]
    if commander is None or any(card is None for card, _ in resolved):
        raise SampleCatalogIncompleteError("Local card catalog is incomplete; run setup.sh")
    resolved_cards = [(card, quantity) for card, quantity in resolved if card is not None]
    deck = Deck(
        owner_id=user.id,
        title=payload.title or "Talrand Starter",
        format=DeckFormat.COMMANDER,
        description="A sample mono-blue spellslinger Commander deck.",
        metadata_json=CommanderDeckMetadata(commander_oracle_ids=[commander.oracle_id]).model_dump(
            mode="json"
        ),
        is_sample=True,
    )
    db.add(deck)
    db.flush()
    all_cards = [(commander, 1, CardZone.COMMANDER)] + [
        (card, quantity, CardZone.MAINBOARD) for card, quantity in resolved_cards
    ]
    _operation, updated_deck = apply_deck_operation(
        db,
        deck.id,
        user,
        DeckOperationCreate(
            client_operation_id=uuid.uuid4(),
            reason="Create sample Commander deck",
            expected_revision=0,
            changes=[
                DeckOperationChangeCreate(
                    printing_id=card.id,
                    quantity_delta=quantity,
                    zone=zone,
                    finish=CardFinish(card.finishes[0]),
                )
                for card, quantity, zone in all_cards
            ],
        ),
    )
    return updated_deck
