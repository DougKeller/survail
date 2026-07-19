import uuid
from typing import cast

import pytest
from fastapi.routing import APIRoute
from sqlalchemy.orm import Session

from survail.core.models import (
    CardSet,
    CardZone,
    Deck,
    DeckFormat,
    DeckTag,
    User,
    cardset_deck_tags,
)
from survail.modules.decks.operations.service.apply import _sync_visual_tags
from survail.modules.decks.service.context import _cardset_placement_line
from survail.modules.decks.service.tags import (
    DeckTagConflictError,
    DeckTagNotFoundError,
    add_cardset_tag,
    create_deck_tag,
    delete_deck_tag,
    remove_cardset_tag,
    rename_deck_tag,
    reorder_deck_tags,
    update_deck_tag,
)
from survail.modules.decks.tags.api.router import router
from survail.modules.decks.tags.api.schemas import (
    CardsetTagUpdate,
    DeckTagCreate,
    DeckTagUpdate,
)


class FakeTagSession:
    def __init__(self, deck: Deck) -> None:
        self.deck = deck
        self.deleted: list[object] = []
        self.commits = 0

    def scalar(self, statement: object) -> Deck:
        del statement
        return self.deck

    def add(self, instance: object) -> None:
        del instance

    def delete(self, instance: object) -> None:
        self.deleted.append(instance)

    def flush(self) -> None:
        pass

    def commit(self) -> None:
        self.commits += 1


def _deck() -> tuple[Deck, User, CardSet]:
    owner = User(id=uuid.uuid4(), discord_id="discord", username="owner")
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=owner.id,
        title="Tagged deck",
        format=DeckFormat.MODERN,
        metadata_json={"kind": "generic"},
    )
    cardset = CardSet(
        id=uuid.uuid4(),
        deck_id=deck.id,
        quantity=4,
        zone=CardZone.MAINBOARD,
        printing_id="printing",
        oracle_id="oracle",
        card_name="Card",
        set_code="set",
        collector_number="1",
        tags=[],
        scryfall={},
    )
    deck.cardsets = [cardset]
    deck.deck_tags = []
    return deck, owner, cardset


def _session(deck: Deck) -> Session:
    return cast("Session", FakeTagSession(deck))


def test_tag_lifecycle_preserves_stable_id_and_order() -> None:
    deck, owner, _cardset = _deck()
    db = _session(deck)

    ramp = create_deck_tag(db, deck.id, owner, name=" Ramp ")
    draw = create_deck_tag(db, deck.id, owner, name="Draw")
    original_id = ramp.id
    rename_deck_tag(db, deck.id, ramp.id, owner, name="Acceleration")
    reorder_deck_tags(db, deck.id, owner, tag_ids=[draw.id, ramp.id])
    update_deck_tag(db, deck.id, ramp.id, owner, target=12.5)

    assert ramp.id == original_id
    assert ramp.name == "Acceleration"
    assert [(tag.name, tag.position) for tag in deck.deck_tags] == [
        ("Draw", 0),
        ("Acceleration", 1),
    ]
    assert draw.target == 0
    assert ramp.target == 12.5


def test_tag_relations_are_database_cascaded() -> None:
    assert next(iter(DeckTag.__table__.c.deck_id.foreign_keys)).ondelete == "CASCADE"
    assert next(iter(cardset_deck_tags.c.cardset_id.foreign_keys)).ondelete == "CASCADE"
    assert next(iter(cardset_deck_tags.c.deck_tag_id.foreign_keys)).ondelete == "CASCADE"


def test_tag_api_exposes_deck_and_whole_stack_mutations() -> None:
    routes = {
        (route.path, method)
        for route in router.routes
        if isinstance(route, APIRoute)
        for method in route.methods
    }
    assert ("/decks/{deck_id}/tags", "POST") in routes
    assert ("/decks/{deck_id}/tags/order", "PUT") in routes
    assert ("/decks/{deck_id}/tags/{tag_id}", "PATCH") in routes
    assert ("/decks/{deck_id}/tags/{tag_id}", "DELETE") in routes
    cardset_tag_path = "/decks/{deck_id}/cardsets/{cardset_id}/tags/{tag_id}"
    assert (cardset_tag_path, "PUT") in routes
    assert (cardset_tag_path, "PATCH") in routes
    assert (cardset_tag_path, "DELETE") in routes


def test_tag_names_are_unique_per_deck_case_insensitively() -> None:
    deck, owner, _cardset = _deck()
    db = _session(deck)
    create_deck_tag(db, deck.id, owner, name="Ramp")

    with pytest.raises(DeckTagConflictError, match="already exists"):
        create_deck_tag(db, deck.id, owner, name=" ramp ")


def test_reorder_requires_every_deck_tag_exactly_once() -> None:
    deck, owner, _cardset = _deck()
    db = _session(deck)
    create_deck_tag(db, deck.id, owner, name="Ramp")
    create_deck_tag(db, deck.id, owner, name="Draw")

    with pytest.raises(DeckTagConflictError, match="exactly once"):
        reorder_deck_tags(db, deck.id, owner, tag_ids=[deck.deck_tags[0].id])


def test_cardset_tag_is_idempotent_and_applies_to_the_whole_stack() -> None:
    deck, owner, cardset = _deck()
    db = _session(deck)
    tag = create_deck_tag(db, deck.id, owner, name="Graveyard")

    add_cardset_tag(db, deck.id, cardset.id, tag.id, owner, weight=0.5)
    add_cardset_tag(db, deck.id, cardset.id, tag.id, owner, weight=0.25)

    assert cardset.quantity == 4
    assert cardset.deck_tags == [tag]
    assert tag.cardsets == [cardset]
    assert cardset.tag_links[0].weight == 0.25

    remove_cardset_tag(db, deck.id, cardset.id, tag.id, owner)
    remove_cardset_tag(db, deck.id, cardset.id, tag.id, owner)
    assert cardset.deck_tags == []


def test_cardset_tag_rejects_unsupported_weights() -> None:
    deck, owner, cardset = _deck()
    tag = create_deck_tag(_session(deck), deck.id, owner, name="Graveyard")

    with pytest.raises(DeckTagConflictError, match="must be one of"):
        add_cardset_tag(
            _session(deck),
            deck.id,
            cardset.id,
            tag.id,
            owner,
            weight=0.6,
        )


def test_tag_payloads_default_metadata_and_validate_partial_updates() -> None:
    assert DeckTagCreate(name="Ramp").target == 0
    assert DeckTagUpdate(target=8).model_dump(exclude_none=True) == {"target": 8.0}
    assert CardsetTagUpdate().weight == 1
    for weight in (0.25, 0.5, 0.75, 1):
        assert CardsetTagUpdate(weight=weight).weight == weight
    with pytest.raises(ValueError, match="at least one"):
        DeckTagUpdate()
    with pytest.raises(ValueError, match="weight must be one of"):
        CardsetTagUpdate(weight=0.6)


def test_deleting_tag_removes_it_from_every_cardset() -> None:
    deck, owner, cardset = _deck()
    db = _session(deck)
    tag = create_deck_tag(db, deck.id, owner, name="Graveyard")
    add_cardset_tag(db, deck.id, cardset.id, tag.id, owner)

    delete_deck_tag(db, deck.id, tag.id, owner)

    assert deck.deck_tags == []
    assert cardset.deck_tags == []
    assert cast("FakeTagSession", db).deleted == [tag]


def test_cardset_cannot_receive_tag_owned_by_another_deck() -> None:
    deck, owner, cardset = _deck()
    foreign_tag = DeckTag(id=uuid.uuid4(), deck_id=uuid.uuid4(), name="Foreign", position=0)
    deck.deck_tags = [foreign_tag]

    with pytest.raises(DeckTagNotFoundError, match="Tag not found"):
        add_cardset_tag(_session(deck), deck.id, cardset.id, uuid.uuid4(), owner)


def test_visual_tags_are_excluded_from_llm_context() -> None:
    _subject, _owner, cardset = _deck()
    cardset.tags = ["Secret visual tag"]

    assert _cardset_placement_line(cardset) == "- Mainboard: 4x"


def test_legacy_operation_tags_reuse_stable_deck_tag_ids() -> None:
    deck, _owner, cardset = _deck()
    db = _session(deck)
    other = CardSet(
        id=uuid.uuid4(),
        deck_id=deck.id,
        quantity=1,
        zone=CardZone.CONSIDERING,
        printing_id="other-printing",
        oracle_id="other-oracle",
        card_name="Other",
        set_code="set",
        collector_number="2",
        tags=["ramp"],
        scryfall={},
    )

    _sync_visual_tags(deck, cardset, ["Ramp"], db)
    original_id = deck.deck_tags[0].id
    cardset.tag_links[0].weight = 0.5
    _sync_visual_tags(deck, other, ["ramp"], db)
    _sync_visual_tags(deck, cardset, ["Ramp"], db)

    assert len(deck.deck_tags) == 1
    assert deck.deck_tags[0].id == original_id
    assert cardset.deck_tags == other.deck_tags == [deck.deck_tags[0]]
    assert cardset.tag_links[0].weight == 0.5
