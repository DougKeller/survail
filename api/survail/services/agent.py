import uuid
from collections.abc import Sequence

from sqlalchemy.orm import Session

from survail.models import DeckAgentEvent, DeckConversation, DeckGuidanceProposal, User
from survail.repositories.agent import AgentRepository


class AgentDeckNotFoundError(LookupError):
    pass


class ConversationNotFoundError(LookupError):
    pass


class GuidanceProposalNotFoundError(LookupError):
    pass


class GuidanceProposalConflictError(ValueError):
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

    def approve_guidance(
        self,
        user: User,
        deck_id: uuid.UUID,
        proposal_id: uuid.UUID,
        expected_revision: int,
    ) -> DeckGuidanceProposal:
        proposal = self._pending_guidance(user, deck_id, proposal_id)
        deck = self._repository.locked_owned_deck(user.id, deck_id)
        if deck is None:
            raise AgentDeckNotFoundError("Deck not found")
        if expected_revision != proposal.expected_revision or deck.revision != expected_revision:
            raise GuidanceProposalConflictError(f"Deck revision is {deck.revision}")
        if proposal.proposed_goal is not None:
            deck.goal = proposal.proposed_goal
        deck.revision += 1
        proposal.status = "approved"
        self._repository.commit()
        self._repository.refresh(proposal)
        return proposal

    def reject_guidance(
        self,
        user: User,
        deck_id: uuid.UUID,
        proposal_id: uuid.UUID,
        expected_revision: int,
    ) -> DeckGuidanceProposal:
        proposal = self._pending_guidance(user, deck_id, proposal_id)
        if expected_revision != proposal.expected_revision:
            raise GuidanceProposalConflictError("Proposal revision does not match")
        proposal.status = "rejected"
        self._repository.commit()
        self._repository.refresh(proposal)
        return proposal

    def _pending_guidance(
        self, user: User, deck_id: uuid.UUID, proposal_id: uuid.UUID
    ) -> DeckGuidanceProposal:
        proposal = self._repository.pending_guidance_proposal(user.id, deck_id, proposal_id)
        if proposal is None:
            raise GuidanceProposalNotFoundError("Pending guidance proposal not found")
        return proposal
