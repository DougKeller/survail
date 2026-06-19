import uuid
from collections.abc import Awaitable, Callable, Sequence

from sqlalchemy.orm import Session

from survail.core.config import get_settings
from survail.core.models import Deck, User
from survail.modules.decks.evaluations.api.schemas import CardRoleEvaluationRead
from survail.modules.decks.evaluations.service.evaluator import (
    EvaluationProgress,
    OpenAIRoleEvaluator,
    evaluate_oracle_ids,
    read_cached_oracle_ids,
)
from survail.modules.decks.repository.decks import DeckRepository

GOAL_REQUIRED_DETAIL = "Set a Goal / North Star before evaluating cards."
ProgressCallback = Callable[[EvaluationProgress], Awaitable[None]]
ResultCallback = Callable[[CardRoleEvaluationRead], Awaitable[None]]


class EvaluationDeckNotFoundError(LookupError):
    pass


class EvaluationGoalRequiredError(ValueError):
    pass


class EvaluationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._decks = DeckRepository(db)

    async def current(
        self,
        user: User,
        deck_id: uuid.UUID,
        progress: ProgressCallback | None = None,
        result: ResultCallback | None = None,
    ) -> list[CardRoleEvaluationRead]:
        deck = self._owned_deck(user, deck_id)
        oracle_ids = list(dict.fromkeys(cardset.oracle_id for cardset in deck.cardsets))
        return await evaluate_oracle_ids(
            self._db, deck, oracle_ids, self._evaluator(), progress, result
        )

    def require_evaluable_deck(self, user: User, deck_id: uuid.UUID) -> Deck:
        return self._owned_deck(user, deck_id)

    async def selected(
        self, user: User, deck_id: uuid.UUID, oracle_ids: Sequence[str]
    ) -> list[CardRoleEvaluationRead]:
        deck = self._owned_deck(user, deck_id)
        return await evaluate_oracle_ids(self._db, deck, list(oracle_ids), self._evaluator())

    def cached_current(self, user: User, deck_id: uuid.UUID) -> list[CardRoleEvaluationRead]:
        deck = self._owned_deck_allowing_blank_goal(user, deck_id)
        oracle_ids = list(dict.fromkeys(cardset.oracle_id for cardset in deck.cardsets))
        return read_cached_oracle_ids(self._db, deck, oracle_ids)

    async def one(self, user: User, deck_id: uuid.UUID, oracle_id: str) -> CardRoleEvaluationRead:
        return (await self.selected(user, deck_id, [oracle_id]))[0]

    def _owned_deck(self, user: User, deck_id: uuid.UUID) -> Deck:
        deck = self._owned_deck_allowing_blank_goal(user, deck_id)
        if not deck.goal or not deck.goal.strip():
            raise EvaluationGoalRequiredError(GOAL_REQUIRED_DETAIL)
        return deck

    def _owned_deck_allowing_blank_goal(self, user: User, deck_id: uuid.UUID) -> Deck:
        deck = self._decks.owned(user.id, deck_id)
        if deck is None:
            raise EvaluationDeckNotFoundError("Deck not found")
        return deck

    def _evaluator(self) -> OpenAIRoleEvaluator | None:
        settings = get_settings()
        if not settings.openai_api_key:
            return None
        return OpenAIRoleEvaluator(settings.openai_api_key, settings.openai_role_evaluation_model)
