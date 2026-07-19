import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from survail.core.models import CardSet, Deck, DeckTag, User


class DeckTagNotFoundError(LookupError):
    pass


class DeckTagConflictError(ValueError):
    pass


def create_deck_tag(
    db: Session,
    deck_id: uuid.UUID,
    actor: User,
    *,
    name: str,
) -> DeckTag:
    deck = _owned_deck(db, deck_id, actor.id)
    cleaned = _clean_name(name)
    _ensure_unique_name(deck, cleaned)
    tag = DeckTag(
        id=uuid.uuid4(),
        deck_id=deck.id,
        name=cleaned,
        position=len(deck.deck_tags),
    )
    deck.deck_tags.append(tag)
    db.add(tag)
    _commit(db, deck)
    return tag


def rename_deck_tag(
    db: Session,
    deck_id: uuid.UUID,
    tag_id: uuid.UUID,
    actor: User,
    *,
    name: str,
) -> DeckTag:
    deck = _owned_deck(db, deck_id, actor.id)
    tag = _tag(deck, tag_id)
    cleaned = _clean_name(name)
    _ensure_unique_name(deck, cleaned, except_id=tag.id)
    if tag.name != cleaned:
        previous_name = tag.name
        tag.name = cleaned
        for cardset in tag.cardsets:
            cardset.tags = [
                cleaned if value.casefold() == previous_name.casefold() else value
                for value in cardset.tags
            ]
        _commit(db, deck)
    return tag


def reorder_deck_tags(
    db: Session,
    deck_id: uuid.UUID,
    actor: User,
    *,
    tag_ids: list[uuid.UUID],
) -> Deck:
    deck = _owned_deck(db, deck_id, actor.id)
    current = {tag.id: tag for tag in deck.deck_tags}
    if len(tag_ids) != len(current) or set(tag_ids) != set(current):
        raise DeckTagConflictError("Reorder must contain every deck tag exactly once")
    ordered = [current[tag_id] for tag_id in tag_ids]
    if ordered == deck.deck_tags:
        return deck

    # Avoid transient collisions with the per-deck unique position constraint.
    offset = len(ordered) + 1
    for tag in ordered:
        tag.position += offset
    db.flush()
    for position, tag in enumerate(ordered):
        tag.position = position
    deck.deck_tags = ordered
    _commit(db, deck)
    return deck


def delete_deck_tag(
    db: Session,
    deck_id: uuid.UUID,
    tag_id: uuid.UUID,
    actor: User,
) -> Deck:
    deck = _owned_deck(db, deck_id, actor.id)
    tag = _tag(deck, tag_id)
    for cardset in list(tag.cardsets):
        cardset.tags = [value for value in cardset.tags if value.casefold() != tag.name.casefold()]
        cardset.deck_tags.remove(tag)
    deck.deck_tags.remove(tag)
    db.delete(tag)
    db.flush()
    for position, remaining in enumerate(deck.deck_tags):
        remaining.position = position
    _commit(db, deck)
    return deck


def add_cardset_tag(
    db: Session,
    deck_id: uuid.UUID,
    cardset_id: uuid.UUID,
    tag_id: uuid.UUID,
    actor: User,
) -> Deck:
    deck = _owned_deck(db, deck_id, actor.id)
    cardset = _cardset(deck, cardset_id)
    tag = _tag(deck, tag_id)
    if tag not in cardset.deck_tags:
        cardset.deck_tags.append(tag)
        if not any(value.casefold() == tag.name.casefold() for value in cardset.tags):
            cardset.tags = [*cardset.tags, tag.name]
        _commit(db, deck)
    return deck


def remove_cardset_tag(
    db: Session,
    deck_id: uuid.UUID,
    cardset_id: uuid.UUID,
    tag_id: uuid.UUID,
    actor: User,
) -> Deck:
    deck = _owned_deck(db, deck_id, actor.id)
    cardset = _cardset(deck, cardset_id)
    tag = _tag(deck, tag_id)
    if tag in cardset.deck_tags:
        cardset.deck_tags.remove(tag)
        cardset.tags = [value for value in cardset.tags if value.casefold() != tag.name.casefold()]
        _commit(db, deck)
    return deck


def _owned_deck(db: Session, deck_id: uuid.UUID, owner_id: uuid.UUID) -> Deck:
    deck = db.scalar(
        select(Deck)
        .options(
            selectinload(Deck.deck_tags).selectinload(DeckTag.cardsets),
            selectinload(Deck.cardsets).selectinload(CardSet.deck_tags),
        )
        .where(Deck.id == deck_id, Deck.owner_id == owner_id)
        .with_for_update()
    )
    if deck is None:
        raise DeckTagNotFoundError("Deck not found")
    return deck


def _tag(deck: Deck, tag_id: uuid.UUID) -> DeckTag:
    tag = next((candidate for candidate in deck.deck_tags if candidate.id == tag_id), None)
    if tag is None:
        raise DeckTagNotFoundError("Tag not found")
    return tag


def _cardset(deck: Deck, cardset_id: uuid.UUID) -> CardSet:
    cardset = next((candidate for candidate in deck.cardsets if candidate.id == cardset_id), None)
    if cardset is None:
        raise DeckTagNotFoundError("Cardset not found")
    return cardset


def _clean_name(name: str) -> str:
    cleaned = " ".join(name.split())
    if not cleaned:
        raise DeckTagConflictError("Tag name must not be blank")
    if len(cleaned) > 100:
        raise DeckTagConflictError("Tag name must be at most 100 characters")
    return cleaned


def _ensure_unique_name(
    deck: Deck,
    name: str,
    *,
    except_id: uuid.UUID | None = None,
) -> None:
    folded = name.casefold()
    if any(tag.id != except_id and tag.name.casefold() == folded for tag in deck.deck_tags):
        raise DeckTagConflictError(f'A tag named "{name}" already exists')


def _commit(db: Session, deck: Deck) -> None:
    deck.updated_at = datetime.now(UTC)
    db.commit()


__all__ = [
    "DeckTagConflictError",
    "DeckTagNotFoundError",
    "add_cardset_tag",
    "create_deck_tag",
    "delete_deck_tag",
    "remove_cardset_tag",
    "rename_deck_tag",
    "reorder_deck_tags",
]
