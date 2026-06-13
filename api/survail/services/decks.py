import uuid
from collections.abc import Sequence

from sqlalchemy.orm import Session

from survail.domain.format_strategies import strategy_for
from survail.models import Deck, DeckOperation, User
from survail.repositories.decks import DeckRepository
from survail.schemas import (
    DeckCreate,
    DeckOperationChangeCreate,
    DeckOperationCreate,
    DeckOperationRevertCreate,
    DeckUpdate,
)


class DeckNotFoundError(LookupError):
    pass


class DeckMetadataError(ValueError):
    pass


class DeckOperationNotFoundError(LookupError):
    pass


class DeckService:
    def __init__(self, db: Session) -> None:
        self._repository = DeckRepository(db)

    def owned(self, user: User, deck_id: uuid.UUID) -> Deck:
        deck = self._repository.owned(user.id, deck_id)
        if deck is None:
            raise DeckNotFoundError("Deck not found")
        return deck

    def list_owned(self, user: User) -> Sequence[Deck]:
        return self._repository.list_owned(user.id)

    def create(self, user: User, payload: DeckCreate) -> Deck:
        deck = Deck(
            owner_id=user.id,
            title=payload.title,
            format=payload.format,
            description=payload.description,
            goal=payload.goal,
            metadata_json=payload.metadata.model_dump(mode="json"),
        )
        self._repository.add(deck)
        self._repository.commit()
        return self.owned(user, deck.id)

    def update(self, user: User, deck_id: uuid.UUID, payload: DeckUpdate) -> Deck:
        deck = self.owned(user, deck_id)
        if payload.title is not None:
            deck.title = payload.title
        if payload.description is not None:
            deck.description = payload.description
        guidance_updated = payload.goal is not None and payload.goal != deck.goal
        if payload.goal is not None:
            deck.goal = payload.goal
        if payload.metadata is not None:
            strategy = strategy_for(deck.format)
            if not strategy.metadata_matches(payload.metadata):
                raise DeckMetadataError(
                    f"{deck.format.value} decks require {strategy.metadata_kind} metadata"
                )
            deck.metadata_json = payload.metadata.model_dump(mode="json")
        if guidance_updated:
            deck.revision += 1
        self._repository.commit()
        return self.owned(user, deck_id)

    def delete(self, user: User, deck_id: uuid.UUID) -> None:
        self._repository.delete(self.owned(user, deck_id))
        self._repository.commit()

    def store_generated_description(self, deck: Deck, description: str) -> None:
        deck.generated_description = description
        deck.generated_description_revision = deck.revision
        self._repository.commit()

    def operation_history(
        self, user: User, deck_id: uuid.UUID, *, limit: int, offset: int
    ) -> Sequence[DeckOperation]:
        self.owned(user, deck_id)
        return self._repository.operation_history(deck_id, limit=limit, offset=offset)

    def revert_payload(
        self,
        user: User,
        deck_id: uuid.UUID,
        operation_id: uuid.UUID,
        payload: DeckOperationRevertCreate,
    ) -> DeckOperationCreate:
        self.owned(user, deck_id)
        original = self._repository.operation(deck_id, operation_id)
        if original is None:
            raise DeckOperationNotFoundError("Deck operation not found")
        return DeckOperationCreate(
            client_operation_id=payload.client_operation_id,
            expected_revision=payload.expected_revision,
            reason=payload.reason or f"Revert operation {original.id}",
            changes=[
                DeckOperationChangeCreate(
                    printing_id=change.printing_id,
                    quantity_delta=-change.quantity_delta,
                    zone=change.zone,
                    finish=change.finish,
                    tags=change.tags_before,
                )
                for change in original.changes
            ],
        )
