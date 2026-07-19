import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from survail.core.models import Deck, DeckGuidanceProposal


class GuidanceProposalRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def locked_owned_deck(self, owner_id: uuid.UUID, deck_id: uuid.UUID) -> Deck | None:
        return self._db.scalar(
            select(Deck).where(Deck.id == deck_id, Deck.owner_id == owner_id).with_for_update()
        )

    def pending_proposal(
        self, owner_id: uuid.UUID, deck_id: uuid.UUID, proposal_id: uuid.UUID
    ) -> DeckGuidanceProposal | None:
        return self._db.scalar(
            select(DeckGuidanceProposal).where(
                DeckGuidanceProposal.id == proposal_id,
                DeckGuidanceProposal.deck_id == deck_id,
                DeckGuidanceProposal.owner_id == owner_id,
                DeckGuidanceProposal.status == "pending",
            )
        )

    def commit(self) -> None:
        self._db.commit()

    def refresh(self, value: object) -> None:
        self._db.refresh(value)
