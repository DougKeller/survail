from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import AfterValidator

from survail.core.dependencies import CurrentUser, DbSession
from survail.core.schemas import ScryfallCardSnapshot
from survail.modules.cards.api.schemas import (
    CardSearchRead,
    CardSearchRequest,
)
from survail.modules.cards.service.search import (
    oracle_printings,
    preferred_unique_cards,
    printing_by_id,
)
from survail.modules.cards.service.search import (
    search_unique_cards as search_cards_service,
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
    selected, has_more = search_cards_service(db, q, [], page=page)
    return CardSearchRead(cards=selected, total_cards=len(selected), has_more=has_more)


@router.post("/search", response_model=CardSearchRead)
def search_unique_cards(
    payload: CardSearchRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> CardSearchRead:
    del current_user
    selected, has_more = search_cards_service(
        db,
        payload.query,
        payload.printing_preferences,
    )
    return CardSearchRead(cards=selected, total_cards=len(selected), has_more=has_more)


_preferred_unique_cards = preferred_unique_cards


@router.get("/oracle/{oracle_id}/printings", response_model=list[ScryfallCardSnapshot])
def get_oracle_printings(
    oracle_id: str,
    db: DbSession,
    _: CurrentUser,
) -> list[ScryfallCardSnapshot]:
    return oracle_printings(db, oracle_id)


@router.get("/{printing_id}", response_model=ScryfallCardSnapshot)
def get_printing(
    printing_id: str,
    db: DbSession,
    _: CurrentUser,
) -> ScryfallCardSnapshot:
    card = printing_by_id(db, printing_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Printing not found in local catalog")
    return card
