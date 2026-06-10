from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import AfterValidator

from survail.catalog import CatalogQueryError, CatalogRepository
from survail.dependencies import CurrentUser, DbSession
from survail.domain.printing_preferences import (
    catalog_printing_selection,
    preferred_printing,
    snapshot_printing_selection,
)
from survail.integrations.scryfall import ScryfallClient
from survail.schemas import (
    CardSearchRead,
    CardSearchRequest,
    ImportPrintingPreference,
    ScryfallCardSnapshot,
)

router = APIRouter(prefix="/cards", tags=["cards"])


def _non_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("query must not be blank")
    return value.strip()


NonBlankQuery = Annotated[str, AfterValidator(_non_blank)]


@router.get("/search", response_model=CardSearchRead)
def search_cards(
    q: Annotated[NonBlankQuery, Query(min_length=1, max_length=500)],
    db: DbSession,
    current_user: CurrentUser,
    page: Annotated[int, Query(ge=1)] = 1,
) -> CardSearchRead:
    del current_user
    catalog = CatalogRepository(db)
    try:
        cards, _, has_more = catalog.search(q, page, page_size=300)
    except CatalogQueryError:
        client = ScryfallClient()
        try:
            cards, _, has_more = client.search(q, page)
        finally:
            client.close()
    selected = _preferred_unique_cards(cards, catalog, [])[:60]
    return CardSearchRead(cards=selected, total_cards=len(selected), has_more=has_more)


@router.post("/search", response_model=CardSearchRead)
def search_unique_cards(
    payload: CardSearchRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> CardSearchRead:
    del current_user
    catalog = CatalogRepository(db)
    try:
        cards, _, has_more = catalog.search(payload.query, page_size=300)
    except CatalogQueryError:
        client = ScryfallClient()
        try:
            cards, _, has_more = client.search(payload.query)
        finally:
            client.close()
    selected = _preferred_unique_cards(cards, catalog, payload.printing_preferences)[:60]
    return CardSearchRead(cards=selected, total_cards=len(selected), has_more=has_more)


def _preferred_unique_cards(
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


@router.get("/oracle/{oracle_id}/printings", response_model=list[ScryfallCardSnapshot])
def get_oracle_printings(
    oracle_id: str,
    db: DbSession,
    _: CurrentUser,
) -> list[ScryfallCardSnapshot]:
    catalog = CatalogRepository(db)
    return [
        printing
        for card in catalog.printing_records_by_oracle(oracle_id)
        if (printing := catalog.get_printing(card.id)) is not None
    ]


@router.get("/{printing_id}", response_model=ScryfallCardSnapshot)
def get_printing(
    printing_id: str,
    db: DbSession,
    _: CurrentUser,
) -> ScryfallCardSnapshot:
    card = CatalogRepository(db).get_printing(printing_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Printing not found in local catalog")
    return card
