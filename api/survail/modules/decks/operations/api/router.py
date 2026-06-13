import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from survail.core.dependencies import CurrentUser, DbSession
from survail.modules.decks.api.router import (
    _deck_read,
    _operation_read,
    _validation_read,
)
from survail.modules.decks.operations.api.schemas import (
    DeckOperationCreate,
    DeckOperationRead,
    DeckOperationResult,
    DeckOperationRevertCreate,
)
from survail.modules.decks.operations.service.apply import (
    DeckOperationConflictError,
    DeckOperationError,
    apply_deck_operation,
)
from survail.modules.decks.service.manage import (
    DeckNotFoundError,
    DeckOperationNotFoundError,
    DeckService,
)

router = APIRouter(prefix="/decks", tags=["deck-operations"])


@router.post(
    "/{deck_id}/operations",
    response_model=DeckOperationResult,
    status_code=status.HTTP_201_CREATED,
)
def apply_operation(
    deck_id: uuid.UUID,
    payload: DeckOperationCreate,
    db: DbSession,
    user: CurrentUser,
) -> DeckOperationResult:
    try:
        operation, deck = apply_deck_operation(db, deck_id, user, payload)
    except DeckOperationConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except DeckOperationError as exc:
        error_status = 404 if str(exc) == "Deck not found" else 422
        raise HTTPException(status_code=error_status, detail=str(exc)) from exc
    return DeckOperationResult(
        operation=_operation_read(operation),
        deck=_deck_read(deck),
        validation=_validation_read(deck),
    )


@router.get("/{deck_id}/operations", response_model=list[DeckOperationRead])
def operation_history(
    deck_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[DeckOperationRead]:
    try:
        operations = DeckService(db).operation_history(user, deck_id, limit=limit, offset=offset)
    except DeckNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [_operation_read(operation) for operation in operations]


@router.post(
    "/{deck_id}/operations/{operation_id}/revert",
    response_model=DeckOperationResult,
    status_code=status.HTTP_201_CREATED,
)
def revert_operation(
    deck_id: uuid.UUID,
    operation_id: uuid.UUID,
    payload: DeckOperationRevertCreate,
    db: DbSession,
    user: CurrentUser,
) -> DeckOperationResult:
    try:
        revert_payload = DeckService(db).revert_payload(user, deck_id, operation_id, payload)
    except (DeckNotFoundError, DeckOperationNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return apply_operation(deck_id, revert_payload, db, user)
