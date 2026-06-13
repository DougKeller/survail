import uuid
from collections.abc import Sequence

from sqlalchemy.orm import Session

from survail.core.models import DeckAgentEvent, DeckConversation, User
from survail.modules.agent.repository.conversations import AgentRepository


class AgentDeckNotFoundError(LookupError):
    pass


class ConversationNotFoundError(LookupError):
    pass


class AgentRouteService:
    def __init__(self, db: Session) -> None:
        self._repository = AgentRepository(db)

    def require_owned_deck(self, user: User, deck_id: uuid.UUID) -> None:
        if not self._repository.owned_deck_exists(user.id, deck_id):
            raise AgentDeckNotFoundError("Deck not found")

    def create_conversation(self, user: User, deck_id: uuid.UUID) -> DeckConversation:
        self.require_owned_deck(user, deck_id)
        conversation = DeckConversation(deck_id=deck_id, owner_id=user.id)
        self._repository.add_conversation(conversation)
        self._repository.commit()
        self._repository.refresh(conversation)
        return conversation

    def conversation_events(
        self, user: User, deck_id: uuid.UUID, conversation_id: uuid.UUID
    ) -> Sequence[DeckAgentEvent]:
        self.require_owned_deck(user, deck_id)
        if self._repository.owned_conversation(user.id, deck_id, conversation_id) is None:
            raise ConversationNotFoundError("Conversation not found")
        return self._repository.conversation_events(conversation_id)
