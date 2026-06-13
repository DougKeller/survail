import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

from survail.core.models import CardZone, DeckFormat
from survail.core.schemas import DeckMetadata, ScryfallCardSnapshot
from survail.core.types import JsonObject
from survail.modules.decks.service.formats import FormatStrategy


class CardSetLike(Protocol):
    id: uuid.UUID
    quantity: int
    zone: CardZone
    oracle_id: str
    card_name: str
    scryfall: JsonObject


@dataclass(frozen=True)
class ValidationError:
    code: str
    message: str
    cardset_id: uuid.UUID | None = None

    @property
    def error_id(self) -> str:
        return self.code


@dataclass(frozen=True)
class ValidationContext:
    deck_format: DeckFormat
    metadata: DeckMetadata
    strategy: FormatStrategy
    main_deck: list[CardSetLike]
    sideboard: list[CardSetLike]
    companion: list[CardSetLike]

    @property
    def playable_cards(self) -> list[CardSetLike]:
        return self.main_deck + self.sideboard + self.companion

    @property
    def card_count(self) -> int:
        return sum(cardset.quantity for cardset in self.main_deck)


ValidationRule = Callable[[ValidationContext], list[ValidationError]]


def validate_size(context: ValidationContext) -> list[ValidationError]:
    rules = context.strategy.rules
    if rules.exact_size is not None and context.card_count != rules.exact_size:
        return [
            ValidationError("deck_size", f"Deck must contain exactly {rules.exact_size} cards.")
        ]
    if rules.minimum_size is not None and context.card_count < rules.minimum_size:
        return [
            ValidationError("deck_size", f"Deck must contain at least {rules.minimum_size} cards.")
        ]
    return []


def validate_sideboard(context: ValidationContext) -> list[ValidationError]:
    sideboard_count = sum(cardset.quantity for cardset in context.sideboard)
    if context.strategy.rules.companion_uses_sideboard_slot:
        sideboard_count += sum(cardset.quantity for cardset in context.companion)
    if sideboard_count <= context.strategy.rules.max_sideboard:
        return []
    return [
        ValidationError(
            "sideboard_size",
            f"{context.deck_format.value} sideboards cannot exceed "
            f"{context.strategy.rules.max_sideboard} cards.",
        )
    ]


def validate_copy_limits(context: ValidationContext) -> list[ValidationError]:
    quantities: dict[str, int] = {}
    first_cardset: dict[str, CardSetLike] = {}
    snapshots: dict[str, ScryfallCardSnapshot] = {}
    for cardset in context.playable_cards:
        quantities[cardset.oracle_id] = quantities.get(cardset.oracle_id, 0) + cardset.quantity
        first_cardset.setdefault(cardset.oracle_id, cardset)
        snapshots.setdefault(
            cardset.oracle_id, ScryfallCardSnapshot.model_validate(cardset.scryfall, strict=False)
        )

    errors: list[ValidationError] = []
    for oracle_id, quantity in quantities.items():
        card = snapshots[oracle_id]
        max_copies = context.strategy.max_copies(card)
        if "Basic Land" not in card.type_line and quantity > max_copies:
            cardset = first_cardset[oracle_id]
            errors.append(
                ValidationError(
                    "copy_limit",
                    f"{cardset.card_name} exceeds the {max_copies}-copy limit across printings.",
                    cardset.id,
                )
            )
    return errors


def validate_legality(context: ValidationContext) -> list[ValidationError]:
    errors: list[ValidationError] = []
    for cardset in context.playable_cards:
        card = ScryfallCardSnapshot.model_validate(cardset.scryfall, strict=False)
        legality = card.legalities.get(context.deck_format.value)
        if legality not in {"legal", "restricted"}:
            errors.append(
                ValidationError(
                    "format_legality",
                    f"{cardset.card_name} is {legality or 'not legal'} "
                    f"in {context.deck_format.value}.",
                    cardset.id,
                )
            )
    return errors


def validate_companion(context: ValidationContext) -> list[ValidationError]:
    companion_count = sum(cardset.quantity for cardset in context.companion)
    errors: list[ValidationError] = []
    if companion_count > context.strategy.rules.max_companions:
        errors.append(
            ValidationError(
                "companion_count",
                f"{context.deck_format.value} decks cannot have more than "
                f"{context.strategy.rules.max_companions} companion.",
            )
        )
    for cardset in context.companion:
        card = ScryfallCardSnapshot.model_validate(cardset.scryfall, strict=False)
        if "Companion" not in card.keywords:
            errors.append(
                ValidationError(
                    "companion_eligibility",
                    f"{cardset.card_name} does not have companion.",
                    cardset.id,
                )
            )
    return errors


def validate_commanders(context: ValidationContext) -> list[ValidationError]:
    rules = context.strategy.rules
    if rules.commander_max == 0:
        return []
    commander_cards = [
        cardset for cardset in context.main_deck if cardset.zone == CardZone.COMMANDER
    ]
    commander_count = sum(cardset.quantity for cardset in commander_cards)
    if not rules.commander_min <= commander_count <= rules.commander_max:
        return [
            ValidationError(
                "commander_count",
                f"{context.deck_format.value} decks require between "
                f"{rules.commander_min} and {rules.commander_max} commanders.",
            )
        ]

    errors = [
        ValidationError(
            "commander_quantity",
            f"{cardset.card_name} must appear exactly once as a commander.",
            cardset.id,
        )
        for cardset in commander_cards
        if cardset.quantity != 1
    ]
    commander_snapshots = [
        ScryfallCardSnapshot.model_validate(cardset.scryfall, strict=False)
        for cardset in commander_cards
    ]
    for cardset, snapshot in zip(commander_cards, commander_snapshots, strict=True):
        eligibility_error = context.strategy.commander_error(snapshot, commander_snapshots)
        if eligibility_error is not None:
            errors.append(ValidationError("commander_eligibility", eligibility_error, cardset.id))
    pair_error = context.strategy.commander_pair_error(commander_snapshots)
    if pair_error is not None:
        errors.append(ValidationError("commander_pair", pair_error))

    commander_ids = context.strategy.commander_ids(context.metadata)
    present_ids = {cardset.oracle_id for cardset in commander_cards}
    if any(commander_id not in present_ids for commander_id in commander_ids):
        errors.append(ValidationError("commander_missing", "All commanders must be in the deck."))
    if any(oracle_id not in commander_ids for oracle_id in present_ids):
        errors.append(
            ValidationError(
                "commander_metadata",
                "Commander metadata must identify every card in the commander zone.",
            )
        )
    allowed_colors: set[str] = set()
    for commander in commander_cards:
        allowed_colors.update(
            ScryfallCardSnapshot.model_validate(commander.scryfall, strict=False).color_identity
        )
    for cardset in context.playable_cards:
        colors = set(
            ScryfallCardSnapshot.model_validate(cardset.scryfall, strict=False).color_identity
        )
        if not colors.issubset(allowed_colors):
            errors.append(
                ValidationError(
                    "color_identity",
                    f"{cardset.card_name} is outside the commander's color identity.",
                    cardset.id,
                )
            )
    return errors


COMMON_RULES: tuple[ValidationRule, ...] = (
    validate_size,
    validate_sideboard,
    validate_copy_limits,
    validate_legality,
    validate_companion,
    validate_commanders,
)
