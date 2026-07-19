import uuid
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from openai import APIConnectionError, APIStatusError, APITimeoutError, RateLimitError

from survail.core.config import get_settings
from survail.core.dependencies import CurrentUser, DbSession
from survail.core.models import CardSet, Deck, DeckOperation, User
from survail.core.schemas import DeckMetadata, ScryfallCardSnapshot
from survail.integrations.cache import get_cache
from survail.integrations.openai.descriptions import OpenAIDeckDescriptionGenerator
from survail.modules.decks.api.schemas import (
    AnalyticsBucketRead,
    CardSetRead,
    DeckAnalyticsRead,
    DeckCreate,
    DeckRead,
    DeckTagRead,
    DeckUpdate,
    DeckValidationRead,
    GeneratedDeckDescriptionContentRead,
    GeneratedDeckDescriptionRead,
    MissingRoleEvaluationCardRead,
    RoleDistributionRead,
    ValidationErrorRead,
)
from survail.modules.decks.contracts import CloneDeckRequest
from survail.modules.decks.evaluations.service.run import EvaluationService
from survail.modules.decks.operations.contracts import (
    DeckOperationChangeRead,
    DeckOperationRead,
)
from survail.modules.decks.service.analytics import (
    CARD_TYPE_LABELS,
    COLOR_LABELS,
    color_pip_counts,
    mana_curve_counts,
    mana_curve_sort_key,
    nonland_total_cards,
    percentage_buckets,
    role_distribution_counts,
    scoped_card_name_map,
    scoped_unique_oracle_ids,
    tag_distribution_counts,
    total_cards,
    type_distribution_counts,
)
from survail.modules.decks.service.describe import (
    current_generated_description,
    generate_deck_description,
)
from survail.modules.decks.service.formats import strategy_for
from survail.modules.decks.service.manage import (
    DeckMetadataError,
    DeckNotFoundError,
    DeckService,
)
from survail.modules.decks.service.samples import (
    SampleCatalogIncompleteError,
    create_sample_commander_deck,
)
from survail.modules.decks.service.validate import validate_deck

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


def _owned_deck(db: DbSession, user: User, deck_id: uuid.UUID) -> Deck:
    try:
        return DeckService(db).owned(user, deck_id)
    except DeckNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


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
        note=cardset.note or "",
        tags=cardset.tags,
        tag_ids=[tag.id for tag in sorted(cardset.deck_tags, key=lambda tag: tag.position)],
        tag_weights={link.deck_tag.id: link.weight for link in cardset.tag_links},
        scryfall=ScryfallCardSnapshot.model_validate(cardset.scryfall, strict=False),
    )


def _deck_read(deck: Deck) -> DeckRead:
    generated_description = current_generated_description(deck)
    return DeckRead(
        id=deck.id,
        title=deck.title,
        format=deck.format,
        description=deck.description,
        goal=deck.goal or "",
        generated_description=(
            None
            if generated_description is None
            else GeneratedDeckDescriptionContentRead(
                overview=generated_description.overview,
                early_game=generated_description.early_game,
                midgame=generated_description.midgame,
                lategame=generated_description.lategame,
            )
        ),
        metadata=_metadata(deck),
        cardsets=[_cardset_read(cardset) for cardset in deck.cardsets],
        tags=[
            DeckTagRead(id=tag.id, name=tag.name, position=tag.position, target=tag.target)
            for tag in deck.deck_tags
        ],
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


def _analytics_read(deck: Deck, user: User, db: DbSession) -> DeckAnalyticsRead:
    scoped_oracle_ids = scoped_unique_oracle_ids(deck)
    cached_evaluations = EvaluationService(db).cached_current(user, deck.id)
    role_counts = role_distribution_counts(deck, cached_evaluations)
    mana_curve = mana_curve_counts(deck)
    color_distribution = color_pip_counts(deck)
    type_distribution = type_distribution_counts(deck)
    tag_distribution = tag_distribution_counts(deck)
    total_nonland_cards = nonland_total_cards(deck)
    evaluated_ids = {evaluation.oracle_id for evaluation in cached_evaluations}
    missing_ids = [oracle_id for oracle_id in scoped_oracle_ids if oracle_id not in evaluated_ids]
    card_names = scoped_card_name_map(deck)
    if not deck.goal.strip():
        role_message = "Set a Goal / North Star to evaluate cards and populate role distribution."
        role_available = False
    elif missing_ids:
        role_message = (
            "Role distribution only includes cards with current cached evaluations. "
            "Run card evaluation to complete it."
        )
        role_available = True
    else:
        role_message = None
        role_available = True
    return DeckAnalyticsRead(
        total_cards=total_cards(deck),
        unique_cards=len(scoped_oracle_ids),
        nonland_cards=total_nonland_cards,
        mana_curve=[
            AnalyticsBucketRead.model_validate(bucket, strict=False)
            for bucket in percentage_buckets(
                mana_curve,
                order=sorted(mana_curve, key=mana_curve_sort_key),
                denominator=total_nonland_cards,
            )
        ],
        color_distribution=[
            AnalyticsBucketRead.model_validate(bucket, strict=False)
            for bucket in percentage_buckets(
                color_distribution,
                labels=COLOR_LABELS,
                order=tuple(COLOR_LABELS),
            )
        ],
        type_distribution=[
            AnalyticsBucketRead.model_validate(bucket, strict=False)
            for bucket in percentage_buckets(
                type_distribution,
                order=(*CARD_TYPE_LABELS, "Other"),
            )
        ],
        tag_distribution=[
            AnalyticsBucketRead.model_validate(bucket, strict=False)
            for bucket in percentage_buckets(
                tag_distribution,
                labels={
                    "untagged": "Untagged",
                    **{str(tag.id): tag.name for tag in deck.deck_tags},
                },
                order=("untagged", *(str(tag.id) for tag in deck.deck_tags)),
            )
        ],
        role_distribution=RoleDistributionRead(
            available=role_available,
            complete=deck.goal.strip() != "" and not missing_ids,
            evaluated_cards=len(evaluated_ids),
            total_cards=len(scoped_oracle_ids),
            unevaluated_cards=len(missing_ids),
            message=role_message,
            buckets=[
                AnalyticsBucketRead.model_validate(bucket, strict=False)
                for bucket in percentage_buckets(role_counts)
            ],
            missing_cards=[
                MissingRoleEvaluationCardRead(oracle_id=oracle_id, card_name=card_names[oracle_id])
                for oracle_id in missing_ids
            ],
        ),
    )


@router.get("", response_model=list[DeckRead])
def list_decks(db: DbSession, user: CurrentUser) -> list[DeckRead]:
    return [_deck_read(deck) for deck in DeckService(db).list_owned(user)]


@router.post("", response_model=DeckRead, status_code=status.HTTP_201_CREATED)
def create_deck(
    payload: DeckCreate,
    db: DbSession,
    user: CurrentUser,
) -> DeckRead:
    return _deck_read(DeckService(db).create(user, payload))


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
    try:
        return _deck_read(DeckService(db).update(user, deck_id, payload))
    except DeckNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DeckMetadataError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(
    deck_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
) -> Response:
    try:
        DeckService(db).delete(user, deck_id)
    except DeckNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{deck_id}/validation", response_model=DeckValidationRead)
def validation(
    deck_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
) -> DeckValidationRead:
    deck = _owned_deck(db, user, deck_id)
    return _validation_read(deck)


@router.get("/{deck_id}/analytics", response_model=DeckAnalyticsRead)
def analytics(
    deck_id: uuid.UUID,
    db: DbSession,
    user: CurrentUser,
) -> DeckAnalyticsRead:
    deck = _owned_deck(db, user, deck_id)
    return _analytics_read(deck, user, db)


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
    except (RateLimitError, APITimeoutError, APIConnectionError, APIStatusError) as exc:
        raise HTTPException(
            status_code=502, detail=f"Could not generate deck description: {exc}"
        ) from exc
    DeckService(db).store_generated_description(deck, description)
    return GeneratedDeckDescriptionRead(
        deck_id=deck.id,
        revision=deck.revision,
        description=GeneratedDeckDescriptionContentRead(
            overview=description.overview,
            early_game=description.early_game,
            midgame=description.midgame,
            lategame=description.lategame,
        ),
        cached=cached,
    )


@router.post("/sample/commander", response_model=DeckRead, status_code=status.HTTP_201_CREATED)
def create_sample_commander(
    payload: CloneDeckRequest,
    db: DbSession,
    user: CurrentUser,
) -> DeckRead:
    try:
        return _deck_read(create_sample_commander_deck(db, user, payload))
    except SampleCatalogIncompleteError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
