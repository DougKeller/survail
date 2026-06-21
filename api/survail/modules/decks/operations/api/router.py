import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from survail.core.dependencies import CurrentUser, DbSession
from survail.core.models import DeckOperationProposal
from survail.modules.decks.api.router import (
    _deck_read,
    _operation_read,
    _validation_read,
)
from survail.modules.decks.contracts import DeckRead
from survail.modules.decks.operations.api.schemas import (
    CardSetCoreUpdate,
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
from survail.modules.decks.service.cardsets import (
    DeckCardSetNotFoundError,
    DeckCoreCardLimitError,
    set_cardset_core,
    set_cardset_note,
)
from survail.modules.decks.service.manage import (
    DeckNotFoundError,
    DeckOperationNotFoundError,
    DeckService,
)

router = APIRouter(prefix="/decks", tags=["deck-operations"])


def _operation_proposal_read(proposal: DeckOperationProposal) -> DeckOperationProposalRead:
    items = proposal.changes.get("items", [])
    return DeckOperationProposalRead(
        id=proposal.id,
        deck_id=proposal.deck_id,
        expected_revision=proposal.expected_revision,
        reason=proposal.reason,
        status=proposal.status,
        operation_id=proposal.operation_id,
        changes=items if isinstance(items, list) else [],
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


@router.post(
    "/{deck_id}/operation-proposals/{proposal_id}/approve",
    response_model=DeckOperationResult,
)
def approve_operation_proposal(
    deck_id: uuid.UUID,
    proposal_id: uuid.UUID,
    payload: DeckOperationProposalDecision,
    db: DbSession,
    user: CurrentUser,
) -> DeckOperationResult:
    proposal = db.scalar(
        select(DeckOperationProposal).where(
            DeckOperationProposal.id == proposal_id,
            DeckOperationProposal.deck_id == deck_id,
            DeckOperationProposal.owner_id == user.id,
            DeckOperationProposal.status == "pending",
        )
    )
    if proposal is None:
        raise HTTPException(status_code=404, detail="Pending operation proposal not found")
    if payload.expected_revision != proposal.expected_revision:
        raise HTTPException(status_code=409, detail="Proposal revision does not match")
    try:
        operation_payload = DeckOperationCreate(
            client_operation_id=uuid.uuid4(),
            expected_revision=proposal.expected_revision,
            reason=proposal.reason,
            changes=proposal.changes.get("items", []),
        )
        operation, deck = apply_deck_operation(db, deck_id, user, operation_payload)
    except DeckOperationConflictError as exc:
        proposal.status = "stale"
        db.commit()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except DeckOperationError as exc:
        proposal.status = "stale"
        db.commit()
        error_status = 404 if str(exc) == "Deck not found" else 422
        raise HTTPException(status_code=error_status, detail=str(exc)) from exc
    proposal.status = "applied"
    proposal.operation_id = operation.id
    db.commit()
    db.refresh(proposal)
    return DeckOperationResult(
        operation=_operation_read(operation),
        deck=_deck_read(deck),
        validation=_validation_read(deck),
    )


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
    proposal = db.scalar(
        select(DeckOperationProposal).where(
            DeckOperationProposal.id == proposal_id,
            DeckOperationProposal.deck_id == deck_id,
            DeckOperationProposal.owner_id == user.id,
            DeckOperationProposal.status == "pending",
        )
    )
    if proposal is None:
        raise HTTPException(status_code=404, detail="Pending operation proposal not found")
    if payload.expected_revision != proposal.expected_revision:
        raise HTTPException(status_code=409, detail="Proposal revision does not match")
    proposal.status = "rejected"
    db.commit()
    db.refresh(proposal)
    return _operation_proposal_read(proposal)


@router.patch("/{deck_id}/cardsets/{cardset_id}/core", response_model=DeckRead)
def update_cardset_core(
    deck_id: uuid.UUID,
    cardset_id: uuid.UUID,
    payload: CardSetCoreUpdate,
    db: DbSession,
    user: CurrentUser,
) -> DeckRead:
    try:
        deck = set_cardset_core(db, deck_id, cardset_id, user, core=payload.core)
    except DeckCardSetNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DeckCoreCardLimitError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _deck_read(deck)


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
