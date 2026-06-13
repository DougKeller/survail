import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from survail.deck_agent.service import event_stream, start_run
from survail.dependencies import CurrentUser, DbSession
from survail.models import DeckGuidanceProposal
from survail.schemas import (
    DeckAgentEventRead,
    DeckAgentMessageCreate,
    DeckConversationRead,
    DeckGuidanceProposalDecision,
    DeckGuidanceProposalRead,
)
from survail.services.agent import (
    AgentDeckNotFoundError,
    AgentRouteService,
    ConversationNotFoundError,
    GuidanceProposalConflictError,
    GuidanceProposalNotFoundError,
)

router = APIRouter(prefix="/decks/{deck_id}/conversations", tags=["deck-agent"])
guidance_router = APIRouter(prefix="/decks/{deck_id}/guidance-proposals", tags=["deck-guidance"])


@router.post("", response_model=DeckConversationRead, status_code=201)
def create_conversation(
    deck_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> DeckConversationRead:
    try:
        conversation = AgentRouteService(db).create_conversation(user, deck_id)
    except AgentDeckNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return DeckConversationRead.model_validate(conversation, from_attributes=True)


@router.get("/{conversation_id}/events", response_model=list[DeckAgentEventRead])
def conversation_events(
    deck_id: uuid.UUID, conversation_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> list[DeckAgentEventRead]:
    try:
        events = AgentRouteService(db).conversation_events(user, deck_id, conversation_id)
    except (AgentDeckNotFoundError, ConversationNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return [
        DeckAgentEventRead(
            id=event.id,
            run_id=event.run_id,
            sequence=event.sequence,
            event_type=event.event_type,
            payload=event.payload,
            created_at=event.created_at,
        )
        for event in events
    ]


@router.post("/{conversation_id}/messages")
async def send_message(
    deck_id: uuid.UUID,
    conversation_id: uuid.UUID,
    payload: DeckAgentMessageCreate,
    db: DbSession,
    user: CurrentUser,
) -> StreamingResponse:
    try:
        AgentRouteService(db).require_owned_deck(user, deck_id)
    except AgentDeckNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    sink = await start_run(user.id, deck_id, conversation_id, payload.message)
    return StreamingResponse(event_stream(sink), media_type="text/event-stream")


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


@guidance_router.post("/{proposal_id}/approve", response_model=DeckGuidanceProposalRead)
def approve_guidance_proposal(
    deck_id: uuid.UUID,
    proposal_id: uuid.UUID,
    payload: DeckGuidanceProposalDecision,
    db: DbSession,
    user: CurrentUser,
) -> DeckGuidanceProposalRead:
    try:
        proposal = AgentRouteService(db).approve_guidance(
            user, deck_id, proposal_id, payload.expected_revision
        )
    except (AgentDeckNotFoundError, GuidanceProposalNotFoundError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GuidanceProposalConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _guidance_read(proposal)


@guidance_router.post("/{proposal_id}/reject", response_model=DeckGuidanceProposalRead)
def reject_guidance_proposal(
    deck_id: uuid.UUID,
    proposal_id: uuid.UUID,
    payload: DeckGuidanceProposalDecision,
    db: DbSession,
    user: CurrentUser,
) -> DeckGuidanceProposalRead:
    try:
        proposal = AgentRouteService(db).reject_guidance(
            user, deck_id, proposal_id, payload.expected_revision
        )
    except GuidanceProposalNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GuidanceProposalConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _guidance_read(proposal)
