from collections.abc import Sequence

from survail.domain.format_strategies import strategy_for
from survail.domain.validation_rules import (
    COMMON_RULES,
    CardSetLike,
    ValidationContext,
    ValidationError,
)
from survail.models import CardZone, Deck, DeckFormat
from survail.schemas import DeckMetadata
from survail.types import JsonObject, json_object


def validate_deck(
    deck_format: DeckFormat, metadata: DeckMetadata, cardsets: Sequence[CardSetLike]
) -> tuple[int, list[ValidationError]]:
    context = ValidationContext(
        deck_format=deck_format,
        metadata=metadata,
        strategy=strategy_for(deck_format),
        main_deck=[
            cardset
            for cardset in cardsets
            if cardset.zone in {CardZone.MAINBOARD, CardZone.COMMANDER}
        ],
        sideboard=[cardset for cardset in cardsets if cardset.zone == CardZone.SIDEBOARD],
        companion=[cardset for cardset in cardsets if cardset.zone == CardZone.COMPANION],
    )
    errors = [error for rule in COMMON_RULES for error in rule(context)]
    return context.card_count, errors


def deck_validation_summary(deck: Deck) -> JsonObject:
    metadata = strategy_for(deck.format).parse_metadata(deck.metadata_json)
    card_count, errors = validate_deck(deck.format, metadata, deck.cardsets)
    return json_object(
        {
            "valid": not errors,
            "card_count": card_count,
            "errors": [
                {
                    "error_id": error.error_id,
                    "code": error.code,
                    "message": error.message,
                    "cardset_id": str(error.cardset_id) if error.cardset_id is not None else None,
                }
                for error in errors
            ],
        }
    )
