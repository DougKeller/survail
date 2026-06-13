from typing import cast

from fastapi.routing import APIRoute

from survail.catalog import CatalogRepository
from survail.main import app
from survail.routes.cards import _preferred_unique_cards
from survail.schemas import NonUniversesBeyondPreference, ScryfallCardSnapshot


class EmptyPrintingCatalog:
    def printing_records_by_oracle(self, oracle_id: str) -> list[object]:
        del oracle_id
        return []


def snapshot(printing_id: str, oracle_id: str, *, universes_beyond: bool) -> ScryfallCardSnapshot:
    return ScryfallCardSnapshot(
        id=printing_id,
        oracle_id=oracle_id,
        name="Sol Ring",
        lang="en",
        layout="normal",
        cmc=1,
        type_line="Artifact",
        legalities={},
        set="tst",
        set_name="Test",
        collector_number="1",
        rarity="uncommon",
        finishes=["nonfoil"],
        universes_beyond=universes_beyond,
        scryfall_uri="https://example.test/card",
    )


def test_search_returns_one_preferred_printing_per_oracle_card() -> None:
    catalog = cast("CatalogRepository", EmptyPrintingCatalog())

    cards = _preferred_unique_cards(
        [
            snapshot("ub", "ring", universes_beyond=True),
            snapshot("non-ub", "ring", universes_beyond=False),
            snapshot("other", "other", universes_beyond=False),
        ],
        catalog,
        [NonUniversesBeyondPreference(kind="non_universes_beyond")],
    )

    assert [card.id for card in cards] == ["non-ub", "other"]


def test_semantic_search_is_not_exposed_as_a_public_card_route() -> None:
    paths = {route.path for route in app.routes if isinstance(route, APIRoute)}

    assert "/cards/semantic-search" not in paths
