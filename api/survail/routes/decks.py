import uuid
from typing import Annotated

import httpx
from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from survail.catalog import CatalogRepository
from survail.dependencies import CurrentUser, DbSession
from survail.domain.deck_description_service import generate_deck_description
from survail.domain.deck_operations import (
    DeckOperationConflictError,
    DeckOperationError,
    apply_deck_operation,
)
from survail.domain.decks import validate_deck
from survail.domain.format_strategies import strategy_for
from survail.integrations.cache import get_cache
from survail.integrations.openai_descriptions import OpenAIDeckDescriptionGenerator
from survail.models import CardFinish, CardSet, CardZone, Deck, DeckFormat, DeckOperation, User
from survail.schemas import (
    CardSetRead,
    CloneDeckRequest,
    CommanderDeckMetadata,
    DeckCreate,
    DeckMetadata,
    DeckOperationChangeCreate,
    DeckOperationChangeRead,
    DeckOperationCreate,
    DeckOperationRead,
    DeckOperationResult,
    DeckOperationRevertCreate,
    DeckRead,
    DeckUpdate,
    DeckValidationRead,
    GeneratedDeckDescriptionRead,
    ScryfallCardSnapshot,
    ValidationErrorRead,
)
from survail.settings import get_settings

router = APIRouter(prefix="/decks", tags=["decks"])

SAMPLE_COMMANDER = "Talrand, Sky Summoner"
SAMPLE_CARDS: dict[str, int] = {
    "Island": 36,
    "Sol Ring": 1,
    "Arcane Signet": 1,
    "Mind Stone": 1,
    "Sky Diamond": 1,
    "Thought Vessel": 1,
    "Wayfarer's Bauble": 1,
    "Counterspell": 1,
    "Negate": 1,
    "Arcane Denial": 1,
    "Disdainful Stroke": 1,
    "Essence Scatter": 1,
    "Exclude": 1,
    "Rewind": 1,
    "Saw It Coming": 1,
    "Swan Song": 1,
    "Pongify": 1,
    "Rapid Hybridization": 1,
    "Reality Shift": 1,
    "Resculpt": 1,
    "Ravenform": 1,
    "Into the Roil": 1,
    "Blink of an Eye": 1,
    "Aetherize": 1,
    "Engulf the Shore": 1,
    "Evacuation": 1,
    "Opt": 1,
    "Consider": 1,
    "Brainstorm": 1,
    "Ponder": 1,
    "Preordain": 1,
    "Impulse": 1,
    "Frantic Search": 1,
    "Behold the Multiverse": 1,
    "Chemister's Insight": 1,
    "Fact or Fiction": 1,
    "Treasure Cruise": 1,
    "Dig Through Time": 1,
    "Mystic Remora": 1,
    "Bident of Thassa": 1,
    "Coastal Piracy": 1,
    "Reconnaissance Mission": 1,
    "Favorable Winds": 1,
    "Gravitational Shift": 1,
    "Shark Typhoon": 1,
    "Murmuring Mystic": 1,
    "Archmage Emeritus": 1,
    "Wavebreak Hippocamp": 1,
    "Deekah, Fractal Theorist": 1,
    "Docent of Perfection": 1,
    "Metallurgic Summonings": 1,
    "Stormtide Leviathan": 1,
    "Hullbreaker Horror": 1,
    "Scourge of Fleets": 1,
    "Windreader Sphinx": 1,
    "Curiosity": 1,
    "Keep Watch": 1,
    "Distant Melody": 1,
    "High Tide": 1,
    "Merchant Scroll": 1,
    "Mystical Tutor": 1,
    "Solve the Equation": 1,
    "Reliquary Tower": 1,
    "Myriad Landscape": 1,
}


def _owned_deck(db: Session, user: User, deck_id: uuid.UUID) -> Deck:
    deck = db.scalar(
        select(Deck)
        .options(selectinload(Deck.cardsets))
        .where(Deck.id == deck_id, Deck.owner_id == user.id)
    )
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck


def _metadata(deck: Deck) -> DeckMetadata:
    return strategy_for(deck.format).parse_metadata(deck.metadata_json)


def _cardset_read(cardset: CardSet) -> CardSetRead:
    return CardSetRead(
        id=cardset.id,
        quantity=cardset.quantity,
        zone=cardset.zone,
        finish=cardset.finish,
        printing_id=cardset.printing_id,
        oracle_id=cardset.oracle_id,
        card_name=cardset.card_name,
        set_code=cardset.set_code,
        collector_number=cardset.collector_number,
        tags=cardset.tags,
        scryfall=ScryfallCardSnapshot.model_validate(cardset.scryfall, strict=False),
    )


def _deck_read(deck: Deck) -> DeckRead:
    return DeckRead(
        id=deck.id,
        title=deck.title,
        format=deck.format,
        description=deck.description,
        metadata=_metadata(deck),
        cardsets=[_cardset_read(cardset) for cardset in deck.cardsets],
        is_sample=deck.is_sample,
        revision=deck.revision,
        created_at=deck.created_at,
        updated_at=deck.updated_at,
    )


def _operation_read(operation: DeckOperation) -> DeckOperationRead:
    return DeckOperationRead(
        id=operation.id,
        deck_id=operation.deck_id,
        actor_id=operation.actor_id,
        client_operation_id=operation.client_operation_id,
        reason=operation.reason,
        revision_before=operation.revision_before,
        revision_after=operation.revision_after,
        created_at=operation.created_at,
        changes=[
            DeckOperationChangeRead(
                printing_id=change.printing_id,
                oracle_id=change.oracle_id,
                card_name=change.card_name,
                set_code=change.set_code,
                collector_number=change.collector_number,
                finish=change.finish,
                zone=change.zone,
                quantity_delta=change.quantity_delta,
                quantity_before=change.quantity_before,
                quantity_after=change.quantity_after,
                tags_before=change.tags_before,
                tags_after=change.tags_after,
            )
            for change in operation.changes
        ],
    )


def _validation_read(deck: Deck) -> DeckValidationRead:
    count, errors = validate_deck(deck.format, _metadata(deck), deck.cardsets)
    return DeckValidationRead(
        valid=not errors,
        card_count=count,
        errors=[
            ValidationErrorRead(
                error_id=error.error_id,
                code=error.code,
                message=error.message,
                cardset_id=error.cardset_id,
            )
            for error in errors
        ],
    )


@router.get("", response_model=list[DeckRead])
def list_decks(db: DbSession, user: CurrentUser) -> list[DeckRead]:
    decks = db.scalars(
        select(Deck)
        .options(selectinload(Deck.cardsets))
        .where(Deck.owner_id == user.id)
        .order_by(Deck.updated_at.desc())
    )
    return [_deck_read(deck) for deck in decks]


@router.post("", response_model=DeckRead, status_code=status.HTTP_201_CREATED)
def create_deck(
    payload: DeckCreate,
    db: DbSession,
    user: CurrentUser,
) -> DeckRead:
    deck = Deck(
        owner_id=user.id,
        title=payload.title,
        format=payload.format,
        description=payload.description,
        metadata_json=payload.metadata.model_dump(mode="json"),
    )
    db.add(deck)
    db.commit()
    return _deck_read(_owned_deck(db, user, deck.id))


@router.get("/{deck_id}", response_model=DeckRead)
def get_deck(
    deck_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
) -> DeckRead:
    return _deck_read(_owned_deck(db, user, deck_id))


@router.patch("/{deck_id}", response_model=DeckRead)
def update_deck(
    deck_id: uuid.UUID,
    payload: DeckUpdate,
    db: DbSession,
    user: CurrentUser,
) -> DeckRead:
    deck = _owned_deck(db, user, deck_id)
    if payload.title is not None:
        deck.title = payload.title
    if payload.description is not None:
        deck.description = payload.description
    if payload.metadata is not None:
        strategy = strategy_for(deck.format)
        if not strategy.metadata_matches(payload.metadata):
            raise HTTPException(
                status_code=422,
                detail=f"{deck.format.value} decks require {strategy.metadata_kind} metadata",
            )
        deck.metadata_json = payload.metadata.model_dump(mode="json")
    db.commit()
    return _deck_read(_owned_deck(db, user, deck_id))


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(
    deck_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
) -> Response:
    deck = _owned_deck(db, user, deck_id)
    db.delete(deck)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{deck_id}/operations",
    response_model=DeckOperationResult,
    status_code=status.HTTP_201_CREATED,
)
def apply_operation(
    deck_id: uuid.UUID,
    payload: DeckOperationCreate,
    db: DbSession,
    user: CurrentUser,
) -> DeckOperationResult:
    try:
        operation, deck = apply_deck_operation(db, deck_id, user, payload)
    except DeckOperationConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except DeckOperationError as exc:
        error_status = 404 if str(exc) == "Deck not found" else 422
        raise HTTPException(status_code=error_status, detail=str(exc)) from exc
    return DeckOperationResult(
        operation=_operation_read(operation),
        deck=_deck_read(deck),
        validation=_validation_read(deck),
    )


@router.get("/{deck_id}/operations", response_model=list[DeckOperationRead])
def operation_history(
    deck_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[DeckOperationRead]:
    _owned_deck(db, user, deck_id)
    operations = db.scalars(
        select(DeckOperation)
        .options(selectinload(DeckOperation.changes))
        .where(DeckOperation.deck_id == deck_id)
        .order_by(DeckOperation.revision_after.desc())
        .offset(offset)
        .limit(limit)
    )
    return [_operation_read(operation) for operation in operations]


@router.post(
    "/{deck_id}/operations/{operation_id}/revert",
    response_model=DeckOperationResult,
    status_code=status.HTTP_201_CREATED,
)
def revert_operation(
    deck_id: uuid.UUID,
    operation_id: uuid.UUID,
    payload: DeckOperationRevertCreate,
    db: DbSession,
    user: CurrentUser,
) -> DeckOperationResult:
    _owned_deck(db, user, deck_id)
    original = db.scalar(
        select(DeckOperation)
        .options(selectinload(DeckOperation.changes))
        .where(DeckOperation.id == operation_id, DeckOperation.deck_id == deck_id)
    )
    if original is None:
        raise HTTPException(status_code=404, detail="Deck operation not found")
    revert_payload = DeckOperationCreate(
        client_operation_id=payload.client_operation_id,
        expected_revision=payload.expected_revision,
        reason=payload.reason or f"Revert operation {original.id}",
        changes=[
            DeckOperationChangeCreate(
                printing_id=change.printing_id,
                quantity_delta=-change.quantity_delta,
                zone=change.zone,
                finish=change.finish,
                tags=change.tags_before,
            )
            for change in original.changes
        ],
    )
    return apply_operation(deck_id, revert_payload, db, user)


@router.get("/{deck_id}/validation", response_model=DeckValidationRead)
def validation(
    deck_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
) -> DeckValidationRead:
    deck = _owned_deck(db, user, deck_id)
    return _validation_read(deck)


@router.post("/{deck_id}/generate-description", response_model=GeneratedDeckDescriptionRead)
def generate_description(
    deck_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
    refresh: Annotated[bool, Query()] = False,
) -> GeneratedDeckDescriptionRead:
    deck = _owned_deck(db, user, deck_id)
    settings = get_settings()
    generator = OpenAIDeckDescriptionGenerator(
        settings.openai_api_key,
        settings.openai_description_model,
    )
    try:
        description, cached = generate_deck_description(
            deck,
            get_cache(),
            generator,
            settings.deck_description_cache_ttl_seconds,
            refresh=refresh,
        )
    except ValueError as exc:
        status_code = 503 if str(exc) == "OPENAI_API_KEY is required" else 502
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail=f"Could not generate deck description: {exc}"
        ) from exc
    return GeneratedDeckDescriptionRead(
        deck_id=deck.id,
        revision=deck.revision,
        description=description,
        cached=cached,
    )


@router.post("/sample/commander", response_model=DeckRead, status_code=status.HTTP_201_CREATED)
def create_sample_commander(
    payload: CloneDeckRequest,
    db: DbSession,
    user: CurrentUser,
) -> DeckRead:
    catalog = CatalogRepository(db)
    commander = catalog.exact_name(SAMPLE_COMMANDER)
    resolved = [(catalog.exact_name(name), quantity) for name, quantity in SAMPLE_CARDS.items()]
    if commander is None or any(card is None for card, _ in resolved):
        raise HTTPException(
            status_code=503, detail="Local card catalog is incomplete; run setup.sh"
        )
    resolved_cards = [(card, quantity) for card, quantity in resolved if card is not None]
    deck = Deck(
        owner_id=user.id,
        title=payload.title or "Talrand Starter",
        format=DeckFormat.COMMANDER,
        description="A sample mono-blue spellslinger Commander deck.",
        metadata_json=CommanderDeckMetadata(commander_oracle_ids=[commander.oracle_id]).model_dump(
            mode="json"
        ),
        is_sample=True,
    )
    db.add(deck)
    db.flush()
    all_cards = [(commander, 1, CardZone.COMMANDER)] + [
        (card, quantity, CardZone.MAINBOARD) for card, quantity in resolved_cards
    ]
    operation, updated_deck = apply_deck_operation(
        db,
        deck.id,
        user,
        DeckOperationCreate(
            client_operation_id=uuid.uuid4(),
            reason="Create sample Commander deck",
            expected_revision=0,
            changes=[
                DeckOperationChangeCreate(
                    printing_id=card.id,
                    quantity_delta=quantity,
                    zone=zone,
                    finish=CardFinish(card.finishes[0]),
                )
                for card, quantity, zone in all_cards
            ],
        ),
    )
    del operation
    return _deck_read(updated_deck)
