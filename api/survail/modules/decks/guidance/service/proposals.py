import uuid

from sqlalchemy.orm import Session

from survail.core.models import DeckGuidanceProposal, User
from survail.modules.decks.guidance.repository.proposals import GuidanceProposalRepository


class GuidanceDeckNotFoundError(LookupError):
    pass


class GuidanceProposalNotFoundError(LookupError):
    pass


class GuidanceProposalConflictError(ValueError):
    pass


class GuidanceProposalService:
    def __init__(self, db: Session) -> None:
        self._repository = GuidanceProposalRepository(db)

    def approve(
        self,
        user: User,
        deck_id: uuid.UUID,
        proposal_id: uuid.UUID,
        expected_revision: int,
    ) -> DeckGuidanceProposal:
        proposal = self._pending_proposal(user, deck_id, proposal_id)
        deck = self._repository.locked_owned_deck(user.id, deck_id)
        if deck is None:
            raise GuidanceDeckNotFoundError("Deck not found")
        if expected_revision != proposal.expected_revision or deck.revision != expected_revision:
            raise GuidanceProposalConflictError(f"Deck revision is {deck.revision}")
        if proposal.proposed_goal is not None:
            deck.goal = proposal.proposed_goal
        deck.revision += 1
        proposal.status = "approved"
        self._repository.commit()
        self._repository.refresh(proposal)
        return proposal

    def reject(
        self,
        user: User,
        deck_id: uuid.UUID,
        proposal_id: uuid.UUID,
        expected_revision: int,
    ) -> DeckGuidanceProposal:
        proposal = self._pending_proposal(user, deck_id, proposal_id)
        if expected_revision != proposal.expected_revision:
            raise GuidanceProposalConflictError("Proposal revision does not match")
        proposal.status = "rejected"
        self._repository.commit()
        self._repository.refresh(proposal)
        return proposal

    def _pending_proposal(
        self, user: User, deck_id: uuid.UUID, proposal_id: uuid.UUID
    ) -> DeckGuidanceProposal:
        proposal = self._repository.pending_proposal(user.id, deck_id, proposal_id)
        if proposal is None:
            raise GuidanceProposalNotFoundError("Pending guidance proposal not found")
        return proposal
