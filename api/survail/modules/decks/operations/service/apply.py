import hashlib
import json
import uuid
from collections import defaultdict
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from survail.core.models import (
    CardFinish,
    CardSet,
    CardZone,
    Deck,
    DeckOperation,
    DeckOperationChange,
    DeckTag,
    User,
)
from survail.core.schemas import ScryfallCardSnapshot
from survail.modules.cards.repository.cards import CatalogRepository
from survail.modules.decks.operations.api.schemas import DeckOperationCreate
from survail.modules.decks.service.formats import strategy_for

CardSetIdentity = tuple[str, CardFinish, CardZone]


class DeckOperationError(ValueError):
    pass


class DeckOperationConflictError(DeckOperationError):
    pass


class PrintingCatalog(Protocol):
    def get_printing(self, printing_id: str) -> ScryfallCardSnapshot | None: ...


def apply_deck_operation(
    db: Session,
    deck_id: uuid.UUID,
    actor: User,
    payload: DeckOperationCreate,
) -> tuple[DeckOperation, Deck]:
    request_hash = _request_hash(payload)
    deck = _locked_deck(db, deck_id, actor.id)
    existing = db.scalar(
        select(DeckOperation)
        .options(selectinload(DeckOperation.changes))
        .where(
            DeckOperation.deck_id == deck_id,
            DeckOperation.client_operation_id == payload.client_operation_id,
        )
    )
    if existing is not None:
        if existing.request_hash != request_hash:
            raise DeckOperationConflictError(
                "client_operation_id was already used for another operation"
            )
        db.commit()
        return existing, deck

    if payload.expected_revision is not None and payload.expected_revision != deck.revision:
        raise DeckOperationConflictError(
            f"Deck revision is {deck.revision}, not {payload.expected_revision}"
        )

    deltas: dict[CardSetIdentity, int] = defaultdict(int)
    requested_tags: dict[CardSetIdentity, list[str]] = {}
    requested_notes: dict[CardSetIdentity, str] = {}
    for change in payload.changes:
        identity = (change.printing_id, change.finish, change.zone)
        deltas[identity] += change.quantity_delta
        if change.tags is not None:
            existing_tags = requested_tags.get(identity)
            if existing_tags is not None and existing_tags != change.tags:
                raise DeckOperationError("Operation contains conflicting tags for one cardset")
            requested_tags[identity] = change.tags
        if change.note is not None:
            existing_note = requested_notes.get(identity)
            if existing_note is not None and existing_note != change.note:
                raise DeckOperationError("Operation contains conflicting notes for one cardset")
            requested_notes[identity] = change.note
    deltas = {identity: delta for identity, delta in deltas.items() if delta != 0}
    if not deltas:
        raise DeckOperationError("Operation has no net changes")

    existing_cardsets = {
        (cardset.printing_id, cardset.finish, cardset.zone): cardset for cardset in deck.cardsets
    }
    catalog = CatalogRepository(db)
    _replace_incompatible_commanders(deck, deltas, requested_tags, requested_notes, catalog)

    operation = DeckOperation(
        deck_id=deck.id,
        actor_id=actor.id,
        client_operation_id=payload.client_operation_id,
        request_hash=request_hash,
        reason=payload.reason,
        revision_before=deck.revision,
        revision_after=deck.revision + 1,
    )
    db.add(operation)
    for identity, delta in sorted(deltas.items(), key=lambda item: str(item[0])):
        printing_id, finish, zone = identity
        cardset = existing_cardsets.get(identity)
        before = cardset.quantity if cardset is not None else 0
        tags_before = list(cardset.tags) if cardset is not None else []
        note_before = (cardset.note or "") if cardset is not None else ""
        after = before + delta
        tags_after = [] if after == 0 else requested_tags.get(identity, tags_before)
        note_after = "" if after == 0 else requested_notes.get(identity, note_before)
        if after < 0:
            raise DeckOperationError(
                f"Operation would make {printing_id}/{finish.value}/{zone.value} negative"
            )
        if cardset is None:
            card = catalog.get_printing(printing_id)
            if card is None:
                raise DeckOperationError(f"Printing not found in local catalog: {printing_id}")
            if finish.value not in card.finishes:
                raise DeckOperationError(
                    f"{finish.value} is unavailable for printing {printing_id}"
                )
            cardset = CardSet(
                deck_id=deck.id,
                quantity=after,
                zone=zone,
                finish=finish,
                printing_id=card.id,
                oracle_id=card.oracle_id,
                card_name=card.name,
                set_code=card.set,
                collector_number=card.collector_number,
                note=note_after or None,
                tags=tags_after,
                scryfall=card.model_dump(mode="json"),
            )
            if after > 0:
                db.add(cardset)
                deck.cardsets.append(cardset)
        elif after == 0:
            db.delete(cardset)
            deck.cardsets.remove(cardset)
        else:
            cardset.quantity = after
            cardset.tags = tags_after
            cardset.note = note_after or None

        if after > 0:
            _sync_visual_tags(deck, cardset, tags_after, db)

        operation.changes.append(
            DeckOperationChange(
                printing_id=printing_id,
                oracle_id=cardset.oracle_id,
                card_name=cardset.card_name,
                set_code=cardset.set_code,
                collector_number=cardset.collector_number,
                finish=finish,
                zone=zone,
                quantity_delta=delta,
                quantity_before=before,
                quantity_after=after,
                tags_before=tags_before,
                tags_after=tags_after,
            )
        )

    deck.revision += 1
    deck.updated_at = datetime.now(UTC)
    strategy_for(deck.format).sync_metadata(deck)
    db.commit()
    return operation, deck


def _replace_incompatible_commanders(
    deck: Deck,
    deltas: dict[CardSetIdentity, int],
    requested_tags: dict[CardSetIdentity, list[str]],
    requested_notes: dict[CardSetIdentity, str],
    catalog: PrintingCatalog,
) -> None:
    incoming = []
    for (printing_id, _finish, zone), delta in deltas.items():
        if zone != CardZone.COMMANDER or delta <= 0:
            continue
        card = catalog.get_printing(printing_id)
        if card is not None:
            incoming.append(card)
    if not incoming:
        return

    strategy = strategy_for(deck.format)
    existing_identities: Mapping[CardSetIdentity, CardSet] = {
        (cardset.printing_id, cardset.finish, cardset.zone): cardset for cardset in deck.cardsets
    }
    for existing in list(deck.cardsets):
        if existing.zone != CardZone.COMMANDER:
            continue
        commander_identity = (existing.printing_id, existing.finish, CardZone.COMMANDER)
        if existing.quantity + deltas.get(commander_identity, 0) <= 0:
            continue
        existing_snapshot = ScryfallCardSnapshot.model_validate(existing.scryfall, strict=False)
        distinct_incoming = [card for card in incoming if card.oracle_id != existing.oracle_id]
        if not distinct_incoming or all(
            strategy.commanders_can_pair(existing_snapshot, card) for card in distinct_incoming
        ):
            continue
        mainboard_identity = (existing.printing_id, existing.finish, CardZone.MAINBOARD)
        deltas[commander_identity] = deltas.get(commander_identity, 0) - existing.quantity
        deltas[mainboard_identity] = deltas.get(mainboard_identity, 0) + existing.quantity
        if mainboard_identity not in existing_identities:
            requested_tags.setdefault(mainboard_identity, list(existing.tags))
            if existing.note:
                requested_notes.setdefault(mainboard_identity, existing.note)


def _locked_deck(db: Session, deck_id: uuid.UUID, owner_id: uuid.UUID) -> Deck:
    deck = db.scalar(
        select(Deck)
        .options(
            selectinload(Deck.cardsets).selectinload(CardSet.deck_tags),
            selectinload(Deck.deck_tags),
        )
        .where(Deck.id == deck_id, Deck.owner_id == owner_id)
        .with_for_update()
    )
    if deck is None:
        raise DeckOperationError("Deck not found")
    return deck


def _sync_visual_tags(
    deck: Deck,
    cardset: CardSet,
    names: list[str],
    db: Session,
) -> None:
    tags_by_name = {tag.name.casefold(): tag for tag in deck.deck_tags}
    selected: list[DeckTag] = []
    for name in names:
        tag = tags_by_name.get(name.casefold())
        if tag is None:
            tag = DeckTag(
                id=uuid.uuid4(),
                deck_id=deck.id,
                name=name,
                position=len(deck.deck_tags),
            )
            deck.deck_tags.append(tag)
            db.add(tag)
            tags_by_name[name.casefold()] = tag
        selected.append(tag)
    cardset.deck_tags = selected


def _request_hash(payload: DeckOperationCreate) -> str:
    canonical = json.dumps(
        payload.model_dump(mode="json", exclude={"client_operation_id"}),
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()
