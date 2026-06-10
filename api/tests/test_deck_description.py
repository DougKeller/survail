import uuid
from collections.abc import Callable
from dataclasses import dataclass, field

import httpx

from survail.domain.deck_description import deck_description_context
from survail.domain.deck_description_service import (
    description_cache_key,
    generate_deck_description,
)
from survail.integrations.openai_descriptions import DeckDescriptionClient
from survail.models import CardSet, CardZone, Deck, DeckFormat
from survail.schemas import ScryfallCardSnapshot
from survail.types import JsonObject


def snapshot(
    name: str,
    oracle_id: str,
    *,
    mana_cost: str,
    type_line: str,
    oracle_text: str,
) -> JsonObject:
    return ScryfallCardSnapshot(
        id=f"printing-{oracle_id}",
        oracle_id=oracle_id,
        name=name,
        lang="en",
        layout="normal",
        mana_cost=mana_cost,
        cmc=2,
        type_line=type_line,
        oracle_text=oracle_text,
        legalities={deck_format.value: "legal" for deck_format in DeckFormat},
        set="tst",
        set_name="Test",
        collector_number="1",
        rarity="common",
        scryfall_uri="https://example.test/card",
    ).model_dump(mode="json")


def cardset(
    name: str,
    oracle_id: str,
    *,
    quantity: int,
    zone: CardZone,
    mana_cost: str,
    type_line: str,
    oracle_text: str,
) -> CardSet:
    return CardSet(
        id=uuid.uuid4(),
        deck_id=uuid.uuid4(),
        quantity=quantity,
        zone=zone,
        printing_id=f"printing-{oracle_id}",
        oracle_id=oracle_id,
        card_name=name,
        set_code="tst",
        collector_number="1",
        tags=[],
        scryfall=snapshot(
            name,
            oracle_id,
            mana_cost=mana_cost,
            type_line=type_line,
            oracle_text=oracle_text,
        ),
    )


def deck(revision: int = 3) -> Deck:
    result = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Ignored title",
        format=DeckFormat.COMMANDER,
        description="Ignored existing description",
        metadata_json={"kind": "commander", "commander_oracle_ids": ["commander"]},
        revision=revision,
    )
    result.cardsets = [
        cardset(
            "Talrand, Sky Summoner",
            "commander",
            quantity=1,
            zone=CardZone.COMMANDER,
            mana_cost="{2}{U}{U}",
            type_line="Legendary Creature - Merfolk Wizard",
            oracle_text="Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake.",
        ),
        cardset(
            "Counterspell",
            "counterspell",
            quantity=1,
            zone=CardZone.MAINBOARD,
            mana_cost="{U}{U}",
            type_line="Instant",
            oracle_text="Counter target spell.",
        ),
    ]
    return result


@dataclass
class FakeCache:
    values: dict[str, JsonObject] = field(default_factory=dict)
    writes: list[tuple[str, JsonObject, int]] = field(default_factory=list)

    def get(self, key: str) -> JsonObject | None:
        return self.values.get(key)

    def set(self, key: str, value: JsonObject, ttl_seconds: int) -> None:
        self.values[key] = value
        self.writes.append((key, value, ttl_seconds))


@dataclass
class FakeGenerator:
    description: str = "This deck makes Drakes and protects them."
    contexts: list[str] = field(default_factory=list)

    def generate(self, context: str) -> str:
        self.contexts.append(context)
        return self.description


def test_description_context_includes_format_commander_and_card_details() -> None:
    context = deck_description_context(deck())

    assert "Name: Commander" in context
    assert "Deck size: exactly 100 cards" in context
    assert "[Commander] 1x Talrand, Sky Summoner" in context
    assert "Mana cost: {2}{U}{U}" in context
    assert "Type: Legendary Creature - Merfolk Wizard" in context
    assert "Whenever you cast an instant or sorcery spell" in context
    assert "[Mainboard] 1x Counterspell" in context
    assert "Ignored title" not in context
    assert "Ignored existing description" not in context


def test_description_is_cached_by_deck_id_and_revision() -> None:
    subject = deck(revision=7)
    cache = FakeCache()
    generator = FakeGenerator()

    description, cached = generate_deck_description(subject, cache, generator, 600)
    second_description, second_cached = generate_deck_description(subject, cache, generator, 600)

    assert description == second_description
    assert not cached
    assert second_cached
    assert len(generator.contexts) == 1
    assert cache.writes == [
        (
            f"deck-description:{subject.id}:7",
            {"description": generator.description},
            600,
        )
    ]
    assert description_cache_key(deck(revision=8)).endswith(":8")


def test_refresh_bypasses_and_overwrites_revision_cache() -> None:
    subject = deck(revision=7)
    key = description_cache_key(subject)
    cache = FakeCache(values={key: {"description": "Old description"}})
    generator = FakeGenerator(description="New description")

    description, cached = generate_deck_description(
        subject,
        cache,
        generator,
        600,
        refresh=True,
    )

    assert description == "New description"
    assert not cached
    assert len(generator.contexts) == 1
    assert cache.values[key] == {"description": "New description"}


def test_openai_client_parses_responses_output_text() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://api.openai.com/v1/responses"
        assert "[[Ephemerate]]" in request.read().decode()
        return httpx.Response(200, json={"output_text": "  A focused spellslinger deck.  "})

    client = DeckDescriptionClient(
        "test-key",
        "test-model",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    assert client.generate("context") == "A focused spellslinger deck."


def test_openai_client_retries_transient_errors() -> None:
    attempts = 0
    delays: list[float] = []

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        del request
        attempts += 1
        if attempts == 1:
            return httpx.Response(429, headers={"retry-after": "2"})
        return httpx.Response(200, json={"output_text": "Description"})

    sleep: Callable[[float], None] = delays.append
    client = DeckDescriptionClient(
        "test-key",
        "test-model",
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
        sleep=sleep,
    )

    assert client.generate("context") == "Description"
    assert attempts == 2
    assert delays == [2]
