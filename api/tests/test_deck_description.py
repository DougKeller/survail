import json
import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import cast

import httpx
import pytest
from openai import OpenAI, RateLimitError
from sqlalchemy.orm import Session

from survail.core.models import CardFinish, CardSet, CardZone, Deck, DeckFormat, User
from survail.core.schemas import ScryfallCardSnapshot
from survail.core.types import JsonObject
from survail.integrations.openai.descriptions import (
    MAX_DESCRIPTION_OUTPUT_TOKENS,
    TARGET_DESCRIPTION_WORDS,
    DeckDescriptionClient,
)
from survail.modules.agent.service.chat import _agent_prompt
from survail.modules.decks.api import router as deck_routes
from survail.modules.decks.service.context import deck_description_context
from survail.modules.decks.service.describe import (
    StructuredDeckDescription,
    current_generated_description,
    description_cache_key,
    generate_deck_description,
)


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
        note="Hold this for the commander turn." if oracle_id == "counterspell" else None,
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
    description: StructuredDeckDescription = field(
        default_factory=lambda: StructuredDeckDescription(
            overview=(
                "This deck makes Drakes and wins through combat. "
                "[[Talrand, Sky Summoner]] rewards efficient spells. "
                "[[Counterspell]] protects the plan. "
                "Creature-heavy pressure can expose the deck."
            ),
            early_game="Develop mana and hold interaction.",
            midgame="Cast [[Talrand, Sky Summoner]] and build a Drake army.",
            lategame="Protect the board and win through combat.",
        )
    )
    contexts: list[str] = field(default_factory=list)

    def generate(self, context: str) -> StructuredDeckDescription:
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
    assert "Cardset Notes:" in context
    assert "- Mainboard: Hold this for the commander turn." in context
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
            {
                "description": {
                    "overview": generator.description.overview,
                    "early_game": generator.description.early_game,
                    "midgame": generator.description.midgame,
                    "lategame": generator.description.lategame,
                }
            },
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
    assert cache.values[key] == {
        "description": {
            "overview": generator.description.overview,
            "early_game": generator.description.early_game,
            "midgame": generator.description.midgame,
            "lategame": generator.description.lategame,
        }
    }


def test_invalid_cached_description_is_replaced() -> None:
    subject = deck(revision=7)
    key = description_cache_key(subject)
    cache = FakeCache(values={key: {"description": "Legacy unstructured description."}})
    generator = FakeGenerator()

    description, cached = generate_deck_description(subject, cache, generator, 600)

    assert description == generator.description
    assert not cached
    assert len(generator.contexts) == 1
    assert cache.values[key] == {
        "description": {
            "overview": generator.description.overview,
            "early_game": generator.description.early_game,
            "midgame": generator.description.midgame,
            "lategame": generator.description.lategame,
        }
    }


def test_generated_description_must_follow_structured_schema() -> None:
    subject = deck()
    cache = FakeCache()

    with pytest.raises(ValueError, match="Generated deck description is empty"):
        generate_deck_description(
            subject,
            cache,
            FakeGenerator(
                description=StructuredDeckDescription(
                    overview="",
                    early_game="Develop mana.",
                    midgame="Cast the commander.",
                    lategame="Win through combat.",
                )
            ),
            600,
        )

    assert cache.writes == []


def test_generated_description_normalizes_structured_fields_before_caching() -> None:
    subject = deck()
    cache = FakeCache()
    generator = FakeGenerator(
        description=StructuredDeckDescription(
            overview=(
                "This deck makes Drakes and wins through combat.\n"
                "[[Talrand, Sky Summoner]] rewards efficient spells.\n"
                "[[Counterspell]] protects the plan.\n"
                "Creature-heavy pressure can expose the deck.\n"
            ),
            early_game=" Develop mana and hold interaction.\n",
            midgame="Cast [[Talrand, Sky Summoner]] and build a Drake army.\n",
            lategame="Protect the board and win through combat.\n",
        )
    )

    description, cached = generate_deck_description(subject, cache, generator, 600)

    assert not cached
    assert description == FakeGenerator().description
    assert cache.writes == [
        (
            description_cache_key(subject),
            {
                "description": {
                    "overview": FakeGenerator().description.overview,
                    "early_game": FakeGenerator().description.early_game,
                    "midgame": FakeGenerator().description.midgame,
                    "lategame": FakeGenerator().description.lategame,
                }
            },
            600,
        )
    ]


def test_generated_description_is_current_only_at_its_generated_revision() -> None:
    subject = deck(revision=7)
    subject.generated_description = json.dumps(
        {
            "overview": FakeGenerator().description.overview,
            "early_game": FakeGenerator().description.early_game,
            "midgame": FakeGenerator().description.midgame,
            "lategame": FakeGenerator().description.lategame,
        }
    )
    subject.generated_description_revision = 7

    assert current_generated_description(subject) == FakeGenerator().description

    subject.revision = 8

    assert current_generated_description(subject) is None


def test_current_generated_description_hides_legacy_unstructured_text() -> None:
    subject = deck(revision=7)
    subject.generated_description = "Legacy unstructured description."
    subject.generated_description_revision = 7

    assert current_generated_description(subject) is None


def test_current_generated_description_reads_structured_json_shape() -> None:
    subject = deck(revision=7)
    subject.generated_description = json.dumps(
        {
            "overview": (
                "This deck makes Drakes and wins through combat.\n"
                "[[Talrand, Sky Summoner]] rewards efficient spells.\n"
                "[[Counterspell]] protects the plan.\n"
                "Creature-heavy pressure can expose the deck.\n"
            ),
            "early_game": " Develop mana and hold interaction.\n",
            "midgame": "Cast [[Talrand, Sky Summoner]] and build a Drake army.\n",
            "lategame": "Protect the board and win through combat.\n",
        }
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
    assert result.generated_description is None


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
        lambda deck, cache, generator, ttl, refresh: (
            StructuredDeckDescription(
                overview="Generated overview.",
                early_game="Develop mana.",
                midgame="Cast the commander.",
                lategame="Close the game.",
            ),
            False,
        ),
    )

    result = deck_routes.generate_description(
        subject.id,
        cast("Session", db),
        cast("User", object()),
        False,
    )

    assert result.description.overview == "Generated overview."
    assert result.description.early_game == "Develop mana."
    assert result.description.midgame == "Cast the commander."
    assert result.description.lategame == "Close the game."
    assert json.loads(subject.generated_description) == {
        "overview": "Generated overview.",
        "early_game": "Develop mana.",
        "midgame": "Cast the commander.",
        "lategame": "Close the game.",
    }
    assert subject.generated_description_revision == 9
    assert db.commits == 1


@dataclass
class FakeResponses:
    results: list[object]
    calls: list[dict[str, object]] = field(default_factory=list)

    def parse(self, **kwargs: object) -> SimpleNamespace:
        self.calls.append(kwargs)
        result = self.results.pop(0)
        if isinstance(result, Exception):
            raise result
        return SimpleNamespace(output_parsed=result)


@dataclass
class FakeOpenAIClient:
    responses: FakeResponses


def test_openai_client_parses_structured_output() -> None:
    responses = FakeResponses(
        [
            StructuredDeckDescription(
                overview="A focused spellslinger deck.",
                early_game="Develop mana.",
                midgame="Resolve key engines.",
                lategame="Protect the board and finish the game.",
            )
        ]
    )
    client = DeckDescriptionClient(
        "test-key",
        "test-model",
        client=cast("OpenAI", FakeOpenAIClient(responses=responses)),
    )

    assert client.generate("context") == StructuredDeckDescription(
        overview="A focused spellslinger deck.",
        early_game="Develop mana.",
        midgame="Resolve key engines.",
        lategame="Protect the board and finish the game.",
    )
    assert len(responses.calls) == 1
    request = responses.calls[0]
    assert request["model"] == "test-model"
    assert request["input"] == "context"
    assert request["text_format"] is StructuredDeckDescription
    assert request["max_output_tokens"] == MAX_DESCRIPTION_OUTPUT_TOKENS
    instructions = cast("str", request["instructions"])
    assert "four fields only: overview, early_game, midgame, and lategame" in instructions
    assert "exactly four sentences" in instructions
    assert TARGET_DESCRIPTION_WORDS in instructions
    assert "[[Ephemerate]]" in instructions


def test_openai_client_retries_transient_errors() -> None:
    delays: list[float] = []
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    response = httpx.Response(429, headers={"retry-after": "2"}, request=request)
    responses = FakeResponses(
        [
            RateLimitError("rate limited", response=response, body=None),
            StructuredDeckDescription(
                overview="Description.",
                early_game="Develop mana.",
                midgame="Resolve key threats.",
                lategame="Close the game.",
            ),
        ]
    )

    sleep: Callable[[float], None] = delays.append
    client = DeckDescriptionClient(
        "test-key",
        "test-model",
        client=cast("OpenAI", FakeOpenAIClient(responses=responses)),
        sleep=sleep,
    )

    assert client.generate("context") == StructuredDeckDescription(
        overview="Description.",
        early_game="Develop mana.",
        midgame="Resolve key threats.",
        lategame="Close the game.",
    )
    assert len(responses.calls) == 2
    assert delays == [2]
