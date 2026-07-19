import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status

from survail.core.dependencies import CurrentUser, DbSession
from survail.core.models import DeckOperation, DeckOperationProposal
from survail.core.schemas import DeckOperationProposalChangeRead
from survail.modules.decks.api.router import (
    _deck_read,
    _operation_read,
    _validation_read,
)
from survail.modules.decks.contracts import DeckRead
from survail.modules.decks.evaluations.service.run import score_added_cards
from survail.modules.decks.operations.api.schemas import (
    CardSetNoteUpdate,
    DeckOperationCreate,
    DeckOperationProposalDecision,
    DeckOperationProposalRead,
    DeckOperationRead,
    DeckOperationResult,
    DeckOperationRevertCreate,
)
from survail.modules.decks.operations.service.apply import (
    DeckOperationConflictError,
    DeckOperationError,
    apply_deck_operation,
)
from survail.modules.decks.operations.service.proposals import (
    OperationProposalNotFoundError,
    OperationProposalRevisionError,
    OperationProposalService,
)
from survail.modules.decks.service.cardsets import (
    DeckCardSetNotFoundError,
    set_cardset_note,
)
from survail.modules.decks.service.manage import (
    DeckNotFoundError,
    DeckOperationNotFoundError,
    DeckService,
)

router = APIRouter(prefix="/decks", tags=["deck-operations"])


def _queue_added_card_scoring(
    background_tasks: BackgroundTasks,
    operation: DeckOperation,
    deck_id: uuid.UUID,
    owner_id: uuid.UUID,
) -> None:
    oracle_ids = list(
        dict.fromkeys(change.oracle_id for change in operation.changes if change.quantity_delta > 0)
    )
    if oracle_ids:
        background_tasks.add_task(score_added_cards, deck_id, owner_id, oracle_ids)


def _operation_proposal_read(proposal: DeckOperationProposal) -> DeckOperationProposalRead:
    raw_items = proposal.changes.get("items", [])
    items = raw_items if isinstance(raw_items, list) else []
    return DeckOperationProposalRead(
        id=proposal.id,
        deck_id=proposal.deck_id,
        expected_revision=proposal.expected_revision,
        reason=proposal.reason,
        status=proposal.status,
        operation_id=proposal.operation_id,
        changes=[
            DeckOperationProposalChangeRead.model_validate(item, strict=False) for item in items
        ],
        created_at=proposal.created_at,
        updated_at=proposal.updated_at,
    )


@router.post(
    "/{deck_id}/operations",
    response_model=DeckOperationResult,
    status_code=status.HTTP_201_CREATED,
)
def apply_operation(
    deck_id: uuid.UUID,
    payload: DeckOperationCreate,
    background_tasks: BackgroundTasks,
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
    _queue_added_card_scoring(background_tasks, operation, deck.id, user.id)
    result = DeckOperationResult(
        operation=_operation_read(operation),
        deck=_deck_read(deck),
        validation=_validation_read(deck),
    )
    return result


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
    background_tasks: BackgroundTasks,
    db: DbSession,
    user: CurrentUser,
) -> DeckOperationResult:
    try:
        revert_payload = DeckService(db).revert_payload(user, deck_id, operation_id, payload)
    except (DeckNotFoundError, DeckOperationNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return apply_operation(deck_id, revert_payload, background_tasks, db, user)


@router.post(
    "/{deck_id}/operation-proposals/{proposal_id}/approve",
    response_model=DeckOperationResult,
)
def approve_operation_proposal(
    deck_id: uuid.UUID,
    proposal_id: uuid.UUID,
    payload: DeckOperationProposalDecision,
    background_tasks: BackgroundTasks,
    db: DbSession,
    user: CurrentUser,
) -> DeckOperationResult:
    proposal_service = OperationProposalService(db)
    try:
        proposal = proposal_service.pending(user, deck_id, proposal_id, payload.expected_revision)
    except OperationProposalNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OperationProposalRevisionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    try:
        operation_payload = DeckOperationCreate.model_validate(
            {
                "client_operation_id": uuid.uuid4(),
                "expected_revision": proposal.expected_revision,
                "reason": proposal.reason,
                "changes": proposal.changes.get("items", []),
            },
            strict=False,
        )
        operation, deck = apply_deck_operation(db, deck_id, user, operation_payload)
    except DeckOperationConflictError as exc:
        proposal_service.stale(proposal)
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except DeckOperationError as exc:
        proposal_service.stale(proposal)
        error_status = 404 if str(exc) == "Deck not found" else 422
        raise HTTPException(status_code=error_status, detail=str(exc)) from exc
    proposal_service.applied(proposal, operation)
    _queue_added_card_scoring(background_tasks, operation, deck.id, user.id)
    result = DeckOperationResult(
        operation=_operation_read(operation),
        deck=_deck_read(deck),
        validation=_validation_read(deck),
    )
    return result


@router.post(
    "/{deck_id}/operation-proposals/{proposal_id}/reject",
    response_model=DeckOperationProposalRead,
)
def reject_operation_proposal(
    deck_id: uuid.UUID,
    proposal_id: uuid.UUID,
    payload: DeckOperationProposalDecision,
    db: DbSession,
    user: CurrentUser,
) -> DeckOperationProposalRead:
    try:
        proposal = OperationProposalService(db).reject(
            user, deck_id, proposal_id, payload.expected_revision
        )
    except OperationProposalNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except OperationProposalRevisionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _operation_proposal_read(proposal)


@router.patch("/{deck_id}/cardsets/{cardset_id}/note", response_model=DeckRead)
def update_cardset_note(
    deck_id: uuid.UUID,
    cardset_id: uuid.UUID,
    payload: CardSetNoteUpdate,
    db: DbSession,
    user: CurrentUser,
) -> DeckRead:
    try:
        deck = set_cardset_note(db, deck_id, cardset_id, user, note=payload.note)
    except DeckCardSetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _deck_read(deck)
