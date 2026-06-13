import re
from typing import Protocol

from survail.domain.deck_description import deck_description_context
from survail.models import Deck
from survail.types import JsonObject


class DescriptionCache(Protocol):
    def get(self, key: str) -> JsonObject | None: ...

    def set(self, key: str, value: JsonObject, ttl_seconds: int) -> None: ...


class DescriptionGenerator(Protocol):
    def generate(self, context: str) -> str: ...


DESCRIPTION_SCHEMA = re.compile(
    r"\A#{1,6}\s+Overview\s*\n"
    r"(?P<overview>.+?)\n\s*\n"
    r"#{1,6}\s+Gameplan\s*\n"
    r"(?P<gameplan>.+)\Z",
    re.DOTALL,
)
GAMEPLAN_ITEM_SCHEMA = re.compile(
    r"^[-*]\s*(Turns 1-3|Midgame|Lategame)\s*[-:]\s*(?P<content>.+?)\s*$"
)


def description_cache_key(deck: Deck) -> str:
    return f"deck-description:{deck.id}:{deck.revision}"


def current_generated_description(deck: Deck) -> str:
    if deck.generated_description_revision != deck.revision:
        return ""
    description = _normalize_description(deck.generated_description)
    return description if _valid_description_schema(description) else ""


def _valid_description_schema(description: str) -> bool:
    if len(description) > 1_200:
        return False
    match = DESCRIPTION_SCHEMA.fullmatch(description)
    if match is None:
        return False
    overview = _collapse_whitespace(match.group("overview"))
    if not overview:
        return False
    gameplan = _normalize_gameplan(match.group("gameplan"))
    return gameplan is not None


def _sentence_count(value: str) -> int:
    return len(re.findall(r"[.!?](?=\s|$)", value))


def _collapse_whitespace(value: str) -> str:
    return " ".join(segment.strip() for segment in value.splitlines() if segment.strip())


def _normalize_gameplan(gameplan: str) -> tuple[str, str, str] | None:
    normalized: dict[str, str] = {}
    for raw_line in gameplan.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        match = GAMEPLAN_ITEM_SCHEMA.fullmatch(line)
        if match is None:
            continue
        label = match.group(1)
        content = _collapse_whitespace(match.group("content"))
        if content:
            normalized[label] = content
    labels = ("Turns 1-3", "Midgame", "Lategame")
    if any(label not in normalized for label in labels):
        return None
    return (
        normalized["Turns 1-3"],
        normalized["Midgame"],
        normalized["Lategame"],
    )


def _normalize_description(description: str) -> str:
    stripped = description.replace("\r\n", "\n").strip()
    if not stripped:
        return ""
    match = DESCRIPTION_SCHEMA.fullmatch(stripped)
    if match is None:
        return stripped
    overview = _collapse_whitespace(match.group("overview"))
    gameplan = _normalize_gameplan(match.group("gameplan"))
    if not overview or gameplan is None:
        return stripped
    early, mid, late = gameplan
    return (
        "# Overview\n"
        f"{overview}\n\n"
        "# Gameplan\n"
        f"- Turns 1-3 - {early}\n"
        f"- Midgame - {mid}\n"
        f"- Lategame - {late}"
    )


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
            if isinstance(description, str):
                description = _normalize_description(description)
                if _valid_description_schema(description):
                    return description, True

    description = _normalize_description(generator.generate(deck_description_context(deck)))
    if not description:
        raise ValueError("Generated deck description is empty")
    if not _valid_description_schema(description):
        raise ValueError("Generated deck description does not follow the required markdown schema")
    cache.set(key, {"description": description}, ttl_seconds)
    return description, False
