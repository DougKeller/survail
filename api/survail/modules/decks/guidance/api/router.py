import uuid

from fastapi import APIRouter, HTTPException

from survail.core.dependencies import CurrentUser, DbSession
from survail.core.models import DeckGuidanceProposal
from survail.modules.decks.guidance.api.schemas import (
    DeckGuidanceProposalDecision,
    DeckGuidanceProposalRead,
)
from survail.modules.decks.guidance.service.proposals import (
    GuidanceDeckNotFoundError,
    GuidanceProposalConflictError,
    GuidanceProposalNotFoundError,
    GuidanceProposalService,
)

router = APIRouter(prefix="/decks/{deck_id}/guidance-proposals", tags=["deck-guidance"])


def _guidance_read(proposal: DeckGuidanceProposal) -> DeckGuidanceProposalRead:
    return DeckGuidanceProposalRead(
        id=proposal.id,
        deck_id=proposal.deck_id,
        expected_revision=proposal.expected_revision,
        reason=proposal.reason,
        proposed_goal=proposal.proposed_goal,
        status=proposal.status,
        created_at=proposal.created_at,
        updated_at=proposal.updated_at,
    )


@router.post("/{proposal_id}/approve", response_model=DeckGuidanceProposalRead)
def approve_guidance_proposal(
    deck_id: uuid.UUID,
    proposal_id: uuid.UUID,
    payload: DeckGuidanceProposalDecision,
    db: DbSession,
    user: CurrentUser,
) -> DeckGuidanceProposalRead:
    try:
        proposal = GuidanceProposalService(db).approve(
            user, deck_id, proposal_id, payload.expected_revision
        )
    except (GuidanceDeckNotFoundError, GuidanceProposalNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GuidanceProposalConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _guidance_read(proposal)


@router.post("/{proposal_id}/reject", response_model=DeckGuidanceProposalRead)
def reject_guidance_proposal(
    deck_id: uuid.UUID,
    proposal_id: uuid.UUID,
    payload: DeckGuidanceProposalDecision,
    db: DbSession,
    user: CurrentUser,
) -> DeckGuidanceProposalRead:
    try:
        proposal = GuidanceProposalService(db).reject(
            user, deck_id, proposal_id, payload.expected_revision
        )
    except GuidanceProposalNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GuidanceProposalConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _guidance_read(proposal)
