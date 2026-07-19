import uuid

from fastapi import APIRouter, HTTPException, status

from survail.core.dependencies import CurrentUser, DbSession
from survail.modules.decks.api.router import _deck_read
from survail.modules.decks.contracts import DeckRead
from survail.modules.decks.service.tags import (
    DeckTagConflictError,
    DeckTagNotFoundError,
    add_cardset_tag,
    create_deck_tag,
    delete_deck_tag,
    remove_cardset_tag,
    rename_deck_tag,
    reorder_deck_tags,
)
from survail.modules.decks.tags.api.schemas import (
    DeckTagCreate,
    DeckTagReorder,
    DeckTagUpdate,
)

router = APIRouter(prefix="/decks/{deck_id}", tags=["deck-tags"])


def _error(exc: DeckTagNotFoundError | DeckTagConflictError) -> HTTPException:
    code = 404 if isinstance(exc, DeckTagNotFoundError) else 409
    return HTTPException(status_code=code, detail=str(exc))


@router.post("/tags", response_model=DeckRead, status_code=status.HTTP_201_CREATED)
def create_tag(
    deck_id: uuid.UUID,
    payload: DeckTagCreate,
    db: DbSession,
    user: CurrentUser,
) -> DeckRead:
    try:
        tag = create_deck_tag(db, deck_id, user, name=payload.name)
    except (DeckTagNotFoundError, DeckTagConflictError) as exc:
        raise _error(exc) from exc
    return _deck_read(tag.deck)


@router.put("/tags/order", response_model=DeckRead)
def reorder_tags(
    deck_id: uuid.UUID,
    payload: DeckTagReorder,
    db: DbSession,
    user: CurrentUser,
) -> DeckRead:
    try:
        deck = reorder_deck_tags(db, deck_id, user, tag_ids=payload.tag_ids)
    except (DeckTagNotFoundError, DeckTagConflictError) as exc:
        raise _error(exc) from exc
    return _deck_read(deck)


@router.patch("/tags/{tag_id}", response_model=DeckRead)
def rename_tag(
    deck_id: uuid.UUID,
    tag_id: uuid.UUID,
    payload: DeckTagUpdate,
    db: DbSession,
    user: CurrentUser,
) -> DeckRead:
    try:
        tag = rename_deck_tag(db, deck_id, tag_id, user, name=payload.name)
    except (DeckTagNotFoundError, DeckTagConflictError) as exc:
        raise _error(exc) from exc
    return _deck_read(tag.deck)


@router.delete("/tags/{tag_id}", response_model=DeckRead)
def delete_tag(
    deck_id: uuid.UUID,
    tag_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
) -> DeckRead:
    try:
        deck = delete_deck_tag(db, deck_id, tag_id, user)
    except (DeckTagNotFoundError, DeckTagConflictError) as exc:
        raise _error(exc) from exc
    return _deck_read(deck)


@router.put("/cardsets/{cardset_id}/tags/{tag_id}", response_model=DeckRead)
def tag_cardset(
    deck_id: uuid.UUID,
    cardset_id: uuid.UUID,
    tag_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
) -> DeckRead:
    try:
        deck = add_cardset_tag(db, deck_id, cardset_id, tag_id, user)
    except (DeckTagNotFoundError, DeckTagConflictError) as exc:
        raise _error(exc) from exc
    return _deck_read(deck)


@router.delete("/cardsets/{cardset_id}/tags/{tag_id}", response_model=DeckRead)
def untag_cardset(
    deck_id: uuid.UUID,
    cardset_id: uuid.UUID,
    tag_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
) -> DeckRead:
    try:
        deck = remove_cardset_tag(db, deck_id, cardset_id, tag_id, user)
    except (DeckTagNotFoundError, DeckTagConflictError) as exc:
        raise _error(exc) from exc
    return _deck_read(deck)


__all__ = ["router"]
