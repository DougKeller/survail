import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from survail.core.dependencies import CurrentUser, DbSession
from survail.modules.agent.api.schemas import (
    DeckAgentEventRead,
    DeckAgentMessageCreate,
    DeckConversationRead,
)
from survail.modules.agent.service.access import (
    AgentDeckNotFoundError,
    AgentRouteService,
    ConversationNotFoundError,
)
from survail.modules.agent.service.chat import event_stream, start_run

router = APIRouter(prefix="/decks/{deck_id}/conversations", tags=["deck-agent"])


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
