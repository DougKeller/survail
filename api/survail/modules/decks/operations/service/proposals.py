import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from survail.core.models import DeckOperation, DeckOperationProposal, User


class OperationProposalNotFoundError(LookupError):
    pass


class OperationProposalRevisionError(ValueError):
    pass


class OperationProposalService:
    def __init__(self, db: Session) -> None:
        self._db = db

    def pending(
        self,
        user: User,
        deck_id: uuid.UUID,
        proposal_id: uuid.UUID,
        expected_revision: int,
    ) -> DeckOperationProposal:
        proposal = self._db.scalar(
            select(DeckOperationProposal).where(
                DeckOperationProposal.id == proposal_id,
                DeckOperationProposal.deck_id == deck_id,
                DeckOperationProposal.owner_id == user.id,
                DeckOperationProposal.status == "pending",
            )
        )
        if proposal is None:
            raise OperationProposalNotFoundError("Pending operation proposal not found")
        if expected_revision != proposal.expected_revision:
            raise OperationProposalRevisionError("Proposal revision does not match")
        return proposal

    def stale(self, proposal: DeckOperationProposal) -> None:
        proposal.status = "stale"
        self._db.commit()

    def applied(
        self, proposal: DeckOperationProposal, operation: DeckOperation
    ) -> DeckOperationProposal:
        proposal.status = "applied"
        proposal.operation_id = operation.id
        self._db.commit()
        return proposal

    def reject(
        self,
        user: User,
        deck_id: uuid.UUID,
        proposal_id: uuid.UUID,
        expected_revision: int,
    ) -> DeckOperationProposal:
        proposal = self.pending(user, deck_id, proposal_id, expected_revision)
        proposal.status = "rejected"
        self._db.commit()
        self._db.refresh(proposal)
        return proposal
