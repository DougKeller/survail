import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from survail.core.models import CardSet, CardSetDeckTag, Deck, DeckOperation


class DeckRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def owned(self, owner_id: uuid.UUID, deck_id: uuid.UUID) -> Deck | None:
        return self._db.scalar(
            select(Deck)
            .options(
                selectinload(Deck.cardsets)
                .selectinload(CardSet.tag_links)
                .selectinload(CardSetDeckTag.deck_tag),
                selectinload(Deck.deck_tags),
            )
            .where(Deck.id == deck_id, Deck.owner_id == owner_id)
        )

    def list_owned(self, owner_id: uuid.UUID) -> Sequence[Deck]:
        return list(
            self._db.scalars(
                select(Deck)
                .options(
                    selectinload(Deck.cardsets)
                    .selectinload(CardSet.tag_links)
                    .selectinload(CardSetDeckTag.deck_tag),
                    selectinload(Deck.deck_tags),
                )
                .where(Deck.owner_id == owner_id)
                .order_by(Deck.updated_at.desc())
            )
        )

    def add(self, deck: Deck) -> None:
        self._db.add(deck)

    def delete(self, deck: Deck) -> None:
        self._db.delete(deck)

    def commit(self) -> None:
        self._db.commit()

    def flush(self) -> None:
        self._db.flush()

    def rollback(self) -> None:
        self._db.rollback()

    def operation(self, deck_id: uuid.UUID, operation_id: uuid.UUID) -> DeckOperation | None:
        return self._db.scalar(
            select(DeckOperation)
            .options(selectinload(DeckOperation.changes))
            .where(DeckOperation.id == operation_id, DeckOperation.deck_id == deck_id)
        )

    def operation_history(
        self, deck_id: uuid.UUID, *, limit: int, offset: int
    ) -> Sequence[DeckOperation]:
        return list(
            self._db.scalars(
                select(DeckOperation)
                .options(selectinload(DeckOperation.changes))
                .where(DeckOperation.deck_id == deck_id)
                .order_by(DeckOperation.revision_after.desc())
                .offset(offset)
                .limit(limit)
            )
        )
