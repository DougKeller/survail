import uuid
from typing import cast

from fastapi.routing import APIRoute
from sqlalchemy.orm import Session

from survail.models import CardSet, Deck, DeckFormat, DeckOperation, DeckOperationChange, User
from survail.routes.decks import delete_deck, router


class FakeDeleteSession:
    def __init__(self, deck: Deck) -> None:
        self.deck = deck
        self.deleted: Deck | None = None
        self.committed = False

    def scalar(self, statement: object) -> Deck:
        del statement
        return self.deck

    def delete(self, instance: Deck) -> None:
        self.deleted = instance

    def commit(self) -> None:
        self.committed = True


def test_delete_deck_permanently_deletes_owned_deck() -> None:
    owner_id = uuid.uuid4()
    user = User(id=owner_id, discord_id="discord", username="owner")
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=owner_id,
        title="Deck",
        format=DeckFormat.MODERN,
        description="",
        metadata_json={"kind": "generic"},
    )
    fake_session = FakeDeleteSession(deck)

    response = delete_deck(deck.id, cast("Session", fake_session), user)

    assert response.status_code == 204
    assert fake_session.deleted is deck
    assert fake_session.committed


def test_deck_children_use_database_delete_cascades() -> None:
    assert next(iter(CardSet.__table__.c.deck_id.foreign_keys)).ondelete == "CASCADE"
    assert next(iter(DeckOperation.__table__.c.deck_id.foreign_keys)).ondelete == "CASCADE"
    assert (
        next(iter(DeckOperationChange.__table__.c.operation_id.foreign_keys)).ondelete == "CASCADE"
    )


def test_soft_delete_model_and_endpoints_are_removed() -> None:
    assert "deleted_at" not in Deck.__table__.c

    route_contracts = {
        (route.path, method)
        for route in router.routes
        if isinstance(route, APIRoute)
        for method in route.methods
    }
    assert ("/decks/deleted", "GET") not in route_contracts
    assert not any(path.endswith("/restore") for path, _method in route_contracts)
