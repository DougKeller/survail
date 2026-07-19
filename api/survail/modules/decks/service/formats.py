import re
from abc import ABC, abstractmethod
from dataclasses import dataclass

from survail.core.models import CardZone, Deck, DeckFormat
from survail.core.schemas import (
    BrawlDeckMetadata,
    CommanderDeckMetadata,
    DeckMetadata,
    GenericDeckMetadata,
    ScryfallCardSnapshot,
)
from survail.core.types import JsonObject


@dataclass(frozen=True)
class FormatRules:
    exact_size: int | None
    minimum_size: int | None
    max_copies: int
    max_sideboard: int
    commander_min: int
    commander_max: int
    max_companions: int
    companion_uses_sideboard_slot: bool


class FormatStrategy(ABC):
    rules: FormatRules
    metadata_kind: str

    @abstractmethod
    def parse_metadata(self, value: JsonObject) -> DeckMetadata:
        raise NotImplementedError

    @abstractmethod
    def sync_metadata(self, deck: Deck) -> None:
        raise NotImplementedError

    def metadata_matches(self, metadata: DeckMetadata) -> bool:
        return metadata.kind == self.metadata_kind

    def deckbuilding_fundamentals(self) -> tuple[str, ...]:
        return (
            "Maintain reliable mana, card advantage, and interaction appropriate to the format.",
            "Balance threats, answers, and mana against the deck's curve and game plan.",
            "Use varied removal that can answer the permanent types and strategies common in the "
            "format.",
        )

    def commander_ids(self, metadata: DeckMetadata) -> list[str]:
        return []

    def max_copies(self, card: ScryfallCardSnapshot) -> int:
        stated_limit = _stated_copy_limit(card)
        return stated_limit if stated_limit is not None else self.rules.max_copies

    def commander_error(
        self, card: ScryfallCardSnapshot, commanders: list[ScryfallCardSnapshot]
    ) -> str | None:
        return "This format does not allow commanders."

    def commander_pair_error(self, commanders: list[ScryfallCardSnapshot]) -> str | None:
        return None

    def commanders_can_pair(
        self, first: ScryfallCardSnapshot, second: ScryfallCardSnapshot
    ) -> bool:
        return False


class ConstructedStrategy(FormatStrategy):
    metadata_kind = "generic"
    rules = FormatRules(None, 60, 4, 15, 0, 0, 1, True)

    def parse_metadata(self, value: JsonObject) -> DeckMetadata:
        return GenericDeckMetadata.model_validate(value)

    def sync_metadata(self, deck: Deck) -> None:
        deck.metadata_json = GenericDeckMetadata().model_dump(mode="json")


class CommanderStrategy(FormatStrategy):
    metadata_kind = "commander"
    rules = FormatRules(100, None, 1, 0, 1, 2, 1, False)

    def parse_metadata(self, value: JsonObject) -> DeckMetadata:
        return CommanderDeckMetadata.model_validate(value)

    def sync_metadata(self, deck: Deck) -> None:
        deck.metadata_json = CommanderDeckMetadata(
            commander_oracle_ids=_commander_ids(deck)
        ).model_dump(mode="json")

    def commander_ids(self, metadata: DeckMetadata) -> list[str]:
        if not isinstance(metadata, CommanderDeckMetadata):
            return []
        return metadata.commander_oracle_ids

    def deckbuilding_fundamentals(self) -> tuple[str, ...]:
        return (
            "Meet Commander legality, singleton, deck-size, commander, and color-identity "
            "requirements.",
            "Start from the baseline template and adjust through play: about 38 lands, 10 to 12 "
            "mana ramp, 12 card advantage, 12 targeted disruption, 6 mass disruption, and "
            "roughly 30 plan cards split among enablers, payoffs, and enhancers. These targets "
            "mean lands plus mana ramp should total about 50. They "
            "exceed 100 because strong cards fill several roles at once; prefer overlap such as "
            "modal double-faced lands and flexible removal.",
            "Count roles strictly: card advantage must net extra cards, so cantrips and pure "
            "selection do not count toward the 12, and one-shot ritual mana does not count as "
            "ramp. Missing land drops is the easiest way to lose, so cut lands last.",
            "Diversify disruption by permanent type and effect, and vary mass disruption "
            "across creatures, artifacts and enchantments, and graveyards. Balance board wipes "
            "against the deck's own board: creature-heavy decks usually favor fewer, "
            "asymmetric, or noncreature wipes.",
            "Skew the curve low: roughly 9 one-drops, 18 two-drops, 15 threes, 10 fours, and "
            "about five each at five and at six-plus mana value, adjusted around the "
            "commander's cost.",
            "Balance plan cards around the commander's own role. A payoff or enhancer "
            "commander wants a deck dense with enablers; an enabler commander frees slots for "
            "payoffs. Keep enhancers scarce because they do nothing without the plan.",
            "Judge every recommendation against the current deck composition so it fills a need "
            "without creating an imbalance.",
        )

    def commander_error(
        self, card: ScryfallCardSnapshot, commanders: list[ScryfallCardSnapshot]
    ) -> str | None:
        if _is_standard_commander(card) or _can_be_commander(card):
            return None
        if len(commanders) == 2 and _is_background(card):
            return None
        return f"{card.name} is not eligible to be a commander."

    def commander_pair_error(self, commanders: list[ScryfallCardSnapshot]) -> str | None:
        if len(commanders) < 2:
            return None
        first, second = commanders
        if _commanders_can_pair(first, second):
            return None
        return f"{first.name} and {second.name} cannot be co-commanders."

    def commanders_can_pair(
        self, first: ScryfallCardSnapshot, second: ScryfallCardSnapshot
    ) -> bool:
        return _commanders_can_pair(first, second)


class BrawlStrategy(FormatStrategy):
    metadata_kind = "brawl"
    rules = FormatRules(60, None, 1, 0, 1, 1, 1, False)

    def parse_metadata(self, value: JsonObject) -> DeckMetadata:
        return BrawlDeckMetadata.model_validate(value)

    def sync_metadata(self, deck: Deck) -> None:
        commander_ids = _commander_ids(deck)
        deck.metadata_json = BrawlDeckMetadata(
            commander_oracle_id=commander_ids[0] if commander_ids else ""
        ).model_dump(mode="json")

    def commander_ids(self, metadata: DeckMetadata) -> list[str]:
        if not isinstance(metadata, BrawlDeckMetadata) or not metadata.commander_oracle_id:
            return []
        return [metadata.commander_oracle_id]

    def commander_error(
        self, card: ScryfallCardSnapshot, commanders: list[ScryfallCardSnapshot]
    ) -> str | None:
        del commanders
        if _is_legendary(card) and (_is_creature(card) or _is_planeswalker(card)):
            return None
        return f"{card.name} is not eligible to be a Brawl commander."


class VintageStrategy(ConstructedStrategy):
    def max_copies(self, card: ScryfallCardSnapshot) -> int:
        return 1 if card.legalities.get("vintage") == "restricted" else super().max_copies(card)


_CONSTRUCTED = ConstructedStrategy()
_STRATEGIES: dict[DeckFormat, FormatStrategy] = {
    DeckFormat.COMMANDER: CommanderStrategy(),
    DeckFormat.BRAWL: BrawlStrategy(),
    DeckFormat.STANDARD: _CONSTRUCTED,
    DeckFormat.MODERN: _CONSTRUCTED,
    DeckFormat.PIONEER: _CONSTRUCTED,
    DeckFormat.LEGACY: _CONSTRUCTED,
    DeckFormat.VINTAGE: VintageStrategy(),
    DeckFormat.PAUPER: _CONSTRUCTED,
}


def strategy_for(deck_format: DeckFormat) -> FormatStrategy:
    return _STRATEGIES[deck_format]


def _commander_ids(deck: Deck) -> list[str]:
    return list(
        dict.fromkeys(
            cardset.oracle_id for cardset in deck.cardsets if cardset.zone == CardZone.COMMANDER
        )
    )


_NAMED_COPY_LIMIT = re.compile(
    r"A deck can have (?:up to )?(?P<count>\w+) cards named ", re.IGNORECASE
)
_NUMBER_WORDS = {
    "seven": 7,
    "nine": 9,
    "twelve": 12,
}


def _stated_copy_limit(card: ScryfallCardSnapshot) -> int | None:
    text = card.oracle_text or ""
    if "A deck can have any number of cards named " in text:
        return 2**31 - 1
    match = _NAMED_COPY_LIMIT.search(text)
    if match is None:
        return None
    count = match.group("count").lower()
    return int(count) if count.isdigit() else _NUMBER_WORDS.get(count)


def _is_legendary(card: ScryfallCardSnapshot) -> bool:
    return "Legendary" in card.type_line


def _is_creature(card: ScryfallCardSnapshot) -> bool:
    return "Creature" in card.type_line


def _is_planeswalker(card: ScryfallCardSnapshot) -> bool:
    return "Planeswalker" in card.type_line


def _is_standard_commander(card: ScryfallCardSnapshot) -> bool:
    return _is_legendary(card) and _is_creature(card)


def _can_be_commander(card: ScryfallCardSnapshot) -> bool:
    return "can be your commander" in (card.oracle_text or "").lower()


def _is_background(card: ScryfallCardSnapshot) -> bool:
    return "Background" in card.type_line


def _has_keyword(card: ScryfallCardSnapshot, keyword: str) -> bool:
    return keyword in card.keywords


def _has_partner_with(card: ScryfallCardSnapshot, other: ScryfallCardSnapshot) -> bool:
    return f"Partner with {other.name}" in (card.oracle_text or "")


def _has_generic_partner(card: ScryfallCardSnapshot) -> bool:
    return _has_keyword(card, "Partner") and "Partner with " not in (card.oracle_text or "")


def _commanders_can_pair(first: ScryfallCardSnapshot, second: ScryfallCardSnapshot) -> bool:
    if _has_generic_partner(first) and _has_generic_partner(second):
        return True
    if _has_keyword(first, "Friends forever") and _has_keyword(second, "Friends forever"):
        return True
    if _has_partner_with(first, second) and _has_partner_with(second, first):
        return True
    if _has_keyword(first, "Choose a Background") and _is_background(second):
        return True
    if _has_keyword(second, "Choose a Background") and _is_background(first):
        return True
    if _has_keyword(first, "Doctor's companion") and "Time Lord Doctor" in second.type_line:
        return True
    return _has_keyword(second, "Doctor's companion") and "Time Lord Doctor" in first.type_line
