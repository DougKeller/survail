from typing import Protocol

from survail.domain.deck_description import deck_description_context
from survail.models import Deck
from survail.types import JsonObject


class DescriptionCache(Protocol):
    def get(self, key: str) -> JsonObject | None: ...

    def set(self, key: str, value: JsonObject, ttl_seconds: int) -> None: ...


class DescriptionGenerator(Protocol):
    def generate(self, context: str) -> str: ...


def description_cache_key(deck: Deck) -> str:
    return f"deck-description:{deck.id}:{deck.revision}"


def generate_deck_description(
    deck: Deck,
    cache: DescriptionCache,
    generator: DescriptionGenerator,
    ttl_seconds: int,
    *,
    refresh: bool = False,
) -> tuple[str, bool]:
    key = description_cache_key(deck)
    if not refresh:
        cached = cache.get(key)
        if cached is not None:
            description = cached.get("description")
            if isinstance(description, str) and description.strip():
                return description, True

    description = generator.generate(deck_description_context(deck)).strip()
    if not description:
        raise ValueError("Generated deck description is empty")
    cache.set(key, {"description": description}, ttl_seconds)
    return description, False
