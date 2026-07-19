import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from survail.core.models import CardSet, CardSetDeckTag, Deck, User


class DeckCardSetNotFoundError(LookupError):
    pass


def set_cardset_note(
    db: Session,
    deck_id: uuid.UUID,
    cardset_id: uuid.UUID,
    actor: User,
    *,
    note: str,
) -> Deck:
    deck = db.scalar(
        select(Deck)
        .options(
            selectinload(Deck.cardsets)
            .selectinload(CardSet.tag_links)
            .selectinload(CardSetDeckTag.deck_tag),
            selectinload(Deck.deck_tags),
        )
        .where(Deck.id == deck_id, Deck.owner_id == actor.id)
        .with_for_update()
    )
    if deck is None:
        raise DeckCardSetNotFoundError("Deck not found")

    cardset = next((item for item in deck.cardsets if item.id == cardset_id), None)
    if cardset is None:
        raise DeckCardSetNotFoundError("Cardset not found")
    next_note = note.strip()
    if (cardset.note or "") == next_note:
        return deck

    cardset.note = next_note or None
    deck.updated_at = datetime.now(UTC)
    db.commit()
    return deck


__all__ = [
    "DeckCardSetNotFoundError",
    "set_cardset_note",
]
