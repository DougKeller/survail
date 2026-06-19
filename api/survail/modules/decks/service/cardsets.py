import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from survail.core.models import Deck, User


class DeckCardSetNotFoundError(LookupError):
    pass


class DeckCoreCardLimitError(ValueError):
    pass


def set_cardset_core(
    db: Session,
    deck_id: uuid.UUID,
    cardset_id: uuid.UUID,
    actor: User,
    *,
    core: bool,
) -> Deck:
    deck = db.scalar(
        select(Deck)
        .options(selectinload(Deck.cardsets))
        .where(Deck.id == deck_id, Deck.owner_id == actor.id)
        .with_for_update()
    )
    if deck is None:
        raise DeckCardSetNotFoundError("Deck not found")

    cardset = next((item for item in deck.cardsets if item.id == cardset_id), None)
    if cardset is None:
        raise DeckCardSetNotFoundError("Cardset not found")
    if cardset.core == core:
        return deck
    if core and sum(1 for item in deck.cardsets if item.core and item.id != cardset.id) >= 15:
        raise DeckCoreCardLimitError("Decks may have at most 15 starred core cards")

    cardset.core = core
    deck.updated_at = datetime.now(UTC)
    db.commit()
    return deck


__all__ = ["DeckCardSetNotFoundError", "DeckCoreCardLimitError", "set_cardset_core"]
