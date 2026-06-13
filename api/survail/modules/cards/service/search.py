from sqlalchemy.orm import Session

from survail.core.schemas import ImportPrintingPreference, ScryfallCardSnapshot
from survail.integrations.scryfall.client import ScryfallClient
from survail.modules.cards.repository.cards import CatalogQueryError, CatalogRepository
from survail.modules.cards.service.printings import (
    catalog_printing_selection,
    preferred_printing,
    snapshot_printing_selection,
)


def search_unique_cards(
    db: Session,
    query: str,
    preferences: list[ImportPrintingPreference],
    *,
    page: int = 1,
) -> tuple[list[ScryfallCardSnapshot], bool]:
    catalog = CatalogRepository(db)
    try:
        cards, _, has_more = catalog.search(query, page, page_size=300)
    except CatalogQueryError:
        client = ScryfallClient()
        try:
            cards, _, has_more = client.search(query, page)
        finally:
            client.close()
    selected = preferred_unique_cards(cards, catalog, preferences)[:60]
    return selected, has_more


def oracle_printings(db: Session, oracle_id: str) -> list[ScryfallCardSnapshot]:
    catalog = CatalogRepository(db)
    return [
        printing
        for card in catalog.printing_records_by_oracle(oracle_id)
        if (printing := catalog.get_printing(card.id)) is not None
    ]


def printing_by_id(db: Session, printing_id: str) -> ScryfallCardSnapshot | None:
    return CatalogRepository(db).get_printing(printing_id)


def preferred_unique_cards(
    cards: list[ScryfallCardSnapshot],
    catalog: CatalogRepository,
    preferences: list[ImportPrintingPreference],
) -> list[ScryfallCardSnapshot]:
    oracle_ids = list(dict.fromkeys(card.oracle_id for card in cards))
    selected: list[ScryfallCardSnapshot] = []
    for oracle_id in oracle_ids:
        selections = [
            catalog_printing_selection(card)
            for card in catalog.printing_records_by_oracle(oracle_id)
        ]
        if not selections:
            selections = [
                snapshot_printing_selection(card) for card in cards if card.oracle_id == oracle_id
            ]
        selection, _ = preferred_printing(selections, preferences)
        selected.append(selection.card)
    return selected
