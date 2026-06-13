import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from survail.core.models import Deck, DeckAgentEvent, DeckConversation


class AgentRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def owned_deck_exists(self, owner_id: uuid.UUID, deck_id: uuid.UUID) -> bool:
        return (
            self._db.scalar(select(Deck.id).where(Deck.id == deck_id, Deck.owner_id == owner_id))
            is not None
        )

    def locked_owned_deck(self, owner_id: uuid.UUID, deck_id: uuid.UUID) -> Deck | None:
        return self._db.scalar(
            select(Deck).where(Deck.id == deck_id, Deck.owner_id == owner_id).with_for_update()
        )

    def add_conversation(self, conversation: DeckConversation) -> None:
        self._db.add(conversation)

    def owned_conversation(
        self, owner_id: uuid.UUID, deck_id: uuid.UUID, conversation_id: uuid.UUID
    ) -> DeckConversation | None:
        return self._db.scalar(
            select(DeckConversation).where(
                DeckConversation.id == conversation_id,
                DeckConversation.deck_id == deck_id,
                DeckConversation.owner_id == owner_id,
            )
        )

    def conversation_events(self, conversation_id: uuid.UUID) -> Sequence[DeckAgentEvent]:
        return list(
            self._db.scalars(
                select(DeckAgentEvent)
                .where(DeckAgentEvent.conversation_id == conversation_id)
                .order_by(DeckAgentEvent.created_at, DeckAgentEvent.sequence)
            )
        )

    def commit(self) -> None:
        self._db.commit()

    def refresh(self, value: object) -> None:
        self._db.refresh(value)
