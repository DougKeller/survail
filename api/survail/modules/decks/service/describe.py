import json
from typing import Protocol

from survail.core.models import Deck
from survail.core.types import JsonObject
from survail.integrations.openai.schemas import StructuredDeckDescription
from survail.modules.decks.service.context import deck_description_context

__all__ = [
    "StructuredDeckDescription",
    "current_generated_description",
    "generate_deck_description",
]


class DescriptionCache(Protocol):
    def get(self, key: str) -> JsonObject | None: ...

    def set(self, key: str, value: JsonObject, ttl_seconds: int) -> None: ...


class DescriptionGenerator(Protocol):
    def generate(self, context: str) -> "StructuredDeckDescription": ...



def description_cache_key(deck: Deck) -> str:
    return f"deck-description:{deck.id}:{deck.revision}"


def current_generated_description(deck: Deck) -> StructuredDeckDescription | None:
    if deck.generated_description_revision != deck.revision:
        return None
    return _normalize_description(deck.generated_description)


def _valid_description_schema(description: StructuredDeckDescription | None) -> bool:
    if description is None:
        return False
    if len(_description_text(description)) > 1_800:
        return False
    if not _collapse_whitespace(description.overview):
        return False
    if not _collapse_whitespace(description.early_game):
        return False
    if not _collapse_whitespace(description.midgame):
        return False
    return bool(_collapse_whitespace(description.lategame))


def _collapse_whitespace(value: str) -> str:
    return " ".join(segment.strip() for segment in value.splitlines() if segment.strip())


def _description_payload(description: StructuredDeckDescription) -> JsonObject:
    return {
        "overview": description.overview,
        "early_game": description.early_game,
        "midgame": description.midgame,
        "lategame": description.lategame,
    }


def _description_text(description: StructuredDeckDescription) -> str:
    return "\n".join(
        [
            description.overview,
            description.early_game,
            description.midgame,
            description.lategame,
        ]
    )


def _normalized_structured(description: StructuredDeckDescription) -> StructuredDeckDescription:
    return StructuredDeckDescription(
        overview=_collapse_whitespace(description.overview),
        early_game=_collapse_whitespace(description.early_game),
        midgame=_collapse_whitespace(description.midgame),
        lategame=_collapse_whitespace(description.lategame),
    )


def _structured_from_mapping(payload: object) -> StructuredDeckDescription | None:
    if not isinstance(payload, dict):
        return None
    overview = payload.get("overview")
    early_game = payload.get("early_game")
    midgame = payload.get("midgame")
    lategame = payload.get("lategame")
    if not (
        isinstance(overview, str)
        and isinstance(early_game, str)
        and isinstance(midgame, str)
        and isinstance(lategame, str)
    ):
        return None
    description = _normalized_structured(
        StructuredDeckDescription(
            overview=overview,
            early_game=early_game,
            midgame=midgame,
            lategame=lategame,
        )
    )
    return description if _valid_description_schema(description) else None


def _normalize_description(description: str) -> StructuredDeckDescription | None:
    stripped = description.replace("\r\n", "\n").strip()
    if not stripped:
        return None
    try:
        structured = _structured_from_mapping(json.loads(stripped))
    except ValueError:
        structured = None
    return structured


def generate_deck_description(
    deck: Deck,
    cache: DescriptionCache,
    generator: DescriptionGenerator,
    ttl_seconds: int,
    *,
    refresh: bool = False,
) -> tuple[StructuredDeckDescription, bool]:
    key = description_cache_key(deck)
    if not refresh:
        cached = cache.get(key)
        if cached is not None:
            cached_description = cached.get("description")
            normalized_cached = _structured_from_mapping(cached_description)
            if normalized_cached is not None and _valid_description_schema(normalized_cached):
                return normalized_cached, True
    description = _normalized_structured(generator.generate(deck_description_context(deck)))
    if not _valid_description_schema(description):
        raise ValueError("Generated deck description is empty")
    cache.set(key, {"description": _description_payload(description)}, ttl_seconds)
    return description, False
