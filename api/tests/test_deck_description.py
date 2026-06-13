import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast

import httpx
import pytest
from sqlalchemy.orm import Session

from survail.deck_agent.service import _agent_prompt
from survail.domain.deck_description import deck_description_context
from survail.domain.deck_description_service import (
    current_generated_description,
    description_cache_key,
    generate_deck_description,
)
from survail.integrations.openai_descriptions import DeckDescriptionClient
from survail.models import CardFinish, CardSet, CardZone, Deck, DeckFormat, User
from survail.routes import decks as deck_routes
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
        finish=CardFinish.NONFOIL,
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
        is_sample=False,
        revision=revision,
        generated_description="",
        generated_description_revision=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
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
    description: str = (
        "# Overview\n"
        "This deck makes Drakes and wins through combat. [[Talrand, Sky Summoner]] rewards "
        "efficient spells. [[Counterspell]] protects the plan. Creature-heavy pressure can expose "
        "the deck.\n\n"
        "# Gameplan\n"
        "- Turns 1-3 - Develop mana and hold interaction.\n"
        "- Midgame - Cast [[Talrand, Sky Summoner]] and build a Drake army.\n"
        "- Lategame - Protect the board and win through combat."
    )
    contexts: list[str] = field(default_factory=list)

    def generate(self, context: str) -> str:
        self.contexts.append(context)
        return self.description


def test_description_context_includes_format_commander_and_card_details() -> None:
    context = deck_description_context(deck())

    assert "Name: Commander" in context
    assert "Deck size: exactly 100 cards" in context
    assert "Format deckbuilding fundamentals (advisory, not rubric criteria)" in context
    assert "lands plus mana ramp should total about 50" in context
    assert "asymmetric, or noncreature wipes" in context
    assert "Current validation" in context
    assert '"error_id": "deck_size"' in context
    assert "[Commander] 1x Talrand, Sky Summoner" in context
    assert "Mana cost: {2}{U}{U}" in context
    assert "Type: Legendary Creature - Merfolk Wizard" in context
    assert "Whenever you cast an instant or sorcery spell" in context
    assert "[Mainboard] 1x Counterspell" in context
    assert "Ignored title" not in context
    assert "Ignored existing description" not in context


def test_agent_prompt_includes_current_validation_errors() -> None:
    subject = deck()
    subject.goal = "Make Drakes and protect them."
    prompt = _agent_prompt(subject, "", "What is missing?")

    assert "Current deck validation results" in prompt
    assert '"error_id": "deck_size"' in prompt
    assert "Make Drakes and protect them." in prompt
    assert "Format deckbuilding fundamentals" in prompt
    assert "lands plus mana ramp should total about 50" in prompt
    assert "What is missing?" in prompt


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
    generator = FakeGenerator()

    description, cached = generate_deck_description(
        subject,
        cache,
        generator,
        600,
        refresh=True,
    )

    assert description == generator.description
    assert not cached
    assert len(generator.contexts) == 1
    assert cache.values[key] == {"description": generator.description}


def test_invalid_cached_description_is_replaced() -> None:
    subject = deck(revision=7)
    key = description_cache_key(subject)
    cache = FakeCache(values={key: {"description": "Legacy unstructured description."}})
    generator = FakeGenerator()

    description, cached = generate_deck_description(subject, cache, generator, 600)

    assert description == generator.description
    assert not cached
    assert len(generator.contexts) == 1
    assert cache.values[key] == {"description": generator.description}


def test_generated_description_must_follow_concise_markdown_schema() -> None:
    subject = deck()
    cache = FakeCache()

    with pytest.raises(ValueError, match="required markdown schema"):
        generate_deck_description(
            subject,
            cache,
            FakeGenerator(description="A verbose unstructured overview."),
            600,
        )

    assert cache.writes == []


def test_generated_description_normalizes_heading_levels_and_wrapped_lines() -> None:
    subject = deck()
    cache = FakeCache()
    generator = FakeGenerator(
        description=(
            "## Overview\n"
            "This deck makes Drakes and wins through combat.\n"
            "[[Talrand, Sky Summoner]] rewards efficient spells.\n"
            "[[Counterspell]] protects the plan.\n"
            "Creature-heavy pressure can expose the deck.\n\n"
            "## Gameplan\n"
            "- Turns 1-3: Develop mana and hold interaction.\n"
            "- Midgame: Cast [[Talrand, Sky Summoner]] and build a Drake army.\n"
            "- Lategame: Protect the board and win through combat.\n"
        )
    )

    description, cached = generate_deck_description(subject, cache, generator, 600)

    assert not cached
    assert description == FakeGenerator().description
    assert cache.writes == [
        (description_cache_key(subject), {"description": FakeGenerator().description}, 600)
    ]


def test_generated_description_is_current_only_at_its_generated_revision() -> None:
    subject = deck(revision=7)
    subject.generated_description = FakeGenerator().description
    subject.generated_description_revision = 7

    assert current_generated_description(subject) == FakeGenerator().description

    subject.revision = 8

    assert current_generated_description(subject) == ""


def test_current_generated_description_hides_legacy_unstructured_text() -> None:
    subject = deck(revision=7)
    subject.generated_description = "Legacy unstructured description."
    subject.generated_description_revision = 7

    assert current_generated_description(subject) == ""


def test_current_generated_description_normalizes_valid_legacy_markdown_shape() -> None:
    subject = deck(revision=7)
    subject.generated_description = (
        "## Overview\n"
        "This deck makes Drakes and wins through combat.\n"
        "[[Talrand, Sky Summoner]] rewards efficient spells.\n"
        "[[Counterspell]] protects the plan.\n"
        "Creature-heavy pressure can expose the deck.\n\n"
        "## Gameplan\n"
        "- Turns 1-3: Develop mana and hold interaction.\n"
        "- Midgame: Cast [[Talrand, Sky Summoner]] and build a Drake army.\n"
        "- Lategame: Protect the board and win through combat.\n"
    )
    subject.generated_description_revision = 7

    assert current_generated_description(subject) == FakeGenerator().description


def test_deck_read_preserves_manual_description_but_hides_stale_generated_description() -> None:
    subject = deck(revision=8)
    subject.description = "Manual notes"
    subject.generated_description = "Old generated overview"
    subject.generated_description_revision = 7

    result = deck_routes._deck_read(subject)

    assert result.description == "Manual notes"
    assert result.generated_description == ""


def test_generate_description_persists_text_and_current_revision(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    subject = deck(revision=9)

    @dataclass
    class FakeDb:
        commits: int = 0

        def commit(self) -> None:
            self.commits += 1

    db = FakeDb()
    monkeypatch.setattr(deck_routes, "_owned_deck", lambda db, user, deck_id: subject)
    monkeypatch.setattr(
        deck_routes,
        "get_settings",
        lambda: SimpleNamespace(
            openai_api_key="test",
            openai_description_model="test-model",
            deck_description_cache_ttl_seconds=600,
        ),
    )
    monkeypatch.setattr(deck_routes, "OpenAIDeckDescriptionGenerator", lambda key, model: object())
    monkeypatch.setattr(deck_routes, "get_cache", object)
    monkeypatch.setattr(
        deck_routes,
        "generate_deck_description",
        lambda deck, cache, generator, ttl, refresh: ("Generated overview", False),
    )

    result = deck_routes.generate_description(
        subject.id,
        cast("Session", db),
        cast("User", object()),
        False,
    )

    assert result.description == "Generated overview"
    assert subject.generated_description == "Generated overview"
    assert subject.generated_description_revision == 9
    assert db.commits == 1


def test_openai_client_parses_responses_output_text() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://api.openai.com/v1/responses"
        body = request.read().decode()
        assert "[[Ephemerate]]" in body
        assert "# Overview" in body
        assert "# Gameplan" in body
        assert "Exactly four sentences" in body
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
