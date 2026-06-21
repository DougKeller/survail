import asyncio
import json
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import cast

import httpx
import pytest
from agents import FunctionTool
from agents.tool_context import ToolContext
from openai import APIStatusError, RateLimitError
from sqlalchemy.orm import Session

from survail.core.models import (
    CardFinish,
    CardSet,
    CardZone,
    Deck,
    DeckAgentEvent,
    DeckFormat,
    DeckGuidanceProposal,
    DeckOperationProposal,
    User,
)
from survail.core.schemas import ScryfallCardSnapshot
from survail.core.types import JsonObject
from survail.modules.agent.service import chat as agent_service
from survail.modules.agent.service.chat import (
    MAX_AGENT_RUN_ATTEMPTS,
    DeckAgentContext,
    _agent_retry_delay,
    _cohesive_context_prompt,
    _deck_color_identity,
    _event_context_summary,
    _initial_context_prompt,
    _matches_color_identity,
    _requires_scryfall_search,
    build_agent,
    search_legal_cards,
)
from survail.modules.agent.service.events import AgentEventSink
from survail.modules.decks.guidance.api import router as guidance_routes
from survail.modules.decks.guidance.api.schemas import DeckGuidanceProposalDecision
from survail.modules.decks.guidance.repository.proposals import GuidanceProposalRepository
from survail.modules.decks.service.validate import deck_validation_summary


def _snapshot(name: str, oracle_id: str, color_identity: list[str]) -> ScryfallCardSnapshot:
    return ScryfallCardSnapshot(
        id=f"printing-{oracle_id}",
        oracle_id=oracle_id,
        name=name,
        lang="en",
        layout="normal",
        cmc=2,
        type_line="Creature",
        color_identity=color_identity,
        legalities={"commander": "legal"},
        set="tst",
        set_name="Test",
        collector_number="1",
        rarity="rare",
        finishes=["nonfoil"],
        scryfall_uri="https://example.test/card",
    )


def _cardset(card: ScryfallCardSnapshot, zone: CardZone) -> CardSet:
    return CardSet(
        id=uuid.uuid4(),
        deck_id=uuid.uuid4(),
        quantity=1,
        zone=zone,
        finish=CardFinish.NONFOIL,
        printing_id=card.id,
        oracle_id=card.oracle_id,
        card_name=card.name,
        set_code=card.set,
        collector_number=card.collector_number,
        core=False,
        note=None,
        tags=[],
        scryfall=card.model_dump(mode="json"),
    )


def _deck(*cardsets: CardSet) -> Deck:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title="Deck",
        format=DeckFormat.COMMANDER,
        description="",
        metadata_json={"kind": "commander", "commander_oracle_ids": []},
    )
    deck.cardsets = list(cardsets)
    return deck


def test_deck_agent_mutation_tools_do_not_require_approval() -> None:
    tools = {tool.name: tool for tool in build_agent().tools}
    resolve_import = tools["resolve_import_text"]
    card_search = tools["search_legal_cards"]

    assert isinstance(resolve_import, FunctionTool)
    assert resolve_import.needs_approval is False
    assert "apply_proposed_operation" not in tools
    assert "evaluate_oracle_id" in tools
    assert "semantic_search_cards" not in tools
    assert "search_legal_cards" in tools
    assert "propose_deck_guidance" in tools
    assert isinstance(card_search, FunctionTool)
    assert 'o:"draw a card"' in card_search.description
    assert "parenthesized OR expressions" in card_search.description


def test_deck_agent_instructions_support_incremental_color_identity_safe_changes() -> None:
    instructions = build_agent().instructions

    assert isinstance(instructions, str)
    assert "temporarily invalid" in instructions
    assert "subset of the deck color identity" in instructions
    assert "apply or discard them manually" in instructions
    assert "never apply them without human approval" in instructions
    assert "intrinsic and strategic roles" in instructions
    assert "qualitative rubric answers" in instructions
    assert "Cards marked as core are locked." in instructions
    assert "Use search_legal_cards for card discovery" in instructions
    assert "Scryfall search syntax" in instructions
    assert 'o:"rules text"' in instructions
    assert "automatically adds format legality" in instructions
    assert "Do not attempt any direct deck mutation through tools." in instructions


def test_deck_color_identity_uses_commander_instead_of_other_cards() -> None:
    commander = _cardset(_snapshot("Commander", "commander", ["U", "B", "G"]), CardZone.COMMANDER)
    off_identity = _cardset(_snapshot("Mountain", "mountain", ["R"]), CardZone.MAINBOARD)

    assert _deck_color_identity(_deck(commander, off_identity)) == (["U", "B", "G"], "commander")


def test_empty_deck_color_identity_is_unknown() -> None:
    assert _deck_color_identity(_deck()) == ([], "unknown")


def test_color_identity_filter_allows_only_subsets_when_identity_is_known() -> None:
    sultai = set("UBG")

    assert _matches_color_identity(_snapshot("Forest", "forest", ["G"]), sultai, True)
    assert not _matches_color_identity(_snapshot("Mountain", "mountain", ["R"]), sultai, True)
    assert _matches_color_identity(_snapshot("Mountain", "mountain", ["R"]), set(), False)


def test_advanced_scryfall_queries_are_detected() -> None:
    assert _requires_scryfall_search("(t:creature OR t:artifact) o:draw")
    assert _requires_scryfall_search("t:creature or t:artifact")
    assert not _requires_scryfall_search('t:creature o:"draw a card" mv<=3')


def test_advanced_search_bypasses_local_catalog_and_uses_scryfall(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    deck = _deck()
    deck.revision = 9
    card = _snapshot("Helpful Card", "helpful-card", [])
    emitted: list[tuple[str, dict[str, object]]] = []

    class FakeSink:
        async def emit(self, event_type: str, payload: object) -> None:
            emitted.append((event_type, cast("dict[str, object]", payload)))

    class FakeSession:
        def __enter__(self) -> "FakeSession":
            return self

        def __exit__(self, *args: object) -> None:
            del args

    class RejectLocalCatalog:
        def __init__(self, db: object) -> None:
            del db
            raise AssertionError("advanced syntax must not use local catalog search")

    queries: list[str] = []

    class FakeScryfall:
        def search(self, query: str) -> tuple[list[ScryfallCardSnapshot], int, bool]:
            queries.append(query)
            return [card], 1, False

        def close(self) -> None:
            return

    monkeypatch.setattr(agent_service, "_owned_deck", lambda owner_id, deck_id: deck)
    monkeypatch.setattr(agent_service, "SessionLocal", FakeSession)
    monkeypatch.setattr(agent_service, "CatalogRepository", RejectLocalCatalog)
    monkeypatch.setattr(agent_service, "ScryfallClient", FakeScryfall)
    context = DeckAgentContext(
        deck.owner_id,
        deck.id,
        uuid.uuid4(),
        uuid.uuid4(),
        cast("AgentEventSink", FakeSink()),
    )

    async def invoke() -> object:
        return await search_legal_cards.on_invoke_tool(
            ToolContext(
                context,
                tool_name="search_legal_cards",
                tool_call_id="tool-call-1",
                tool_arguments='{"query":"(t:creature OR t:artifact) o:draw"}',
            ),
            json.dumps({"query": "(t:creature OR t:artifact) o:draw"}),
        )

    result = asyncio.run(invoke())
    payload = json.loads(cast("str", result))

    assert payload["search_source"] == "scryfall"
    assert payload["cards"][0]["name"] == "Helpful Card"
    assert queries == ["(t:creature OR t:artifact) o:draw legal:commander"]
    assert emitted[0][0] == "status"
    assert emitted[0][1]["tool_name"] == "search_legal_cards"
    assert emitted[-1][0] == "card_results"


def test_search_legal_cards_returns_refinement_tips_when_no_results_are_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    deck = _deck()
    deck.revision = 12

    class FakeSink:
        async def emit(self, event_type: str, payload: object) -> None:
            del event_type, payload

    class FakeSession:
        def __enter__(self) -> "FakeSession":
            return self

        def __exit__(self, *args: object) -> None:
            del args

    class EmptyCatalog:
        def __init__(self, db: object) -> None:
            del db

        def search(
            self, query: str, page_size: int
        ) -> tuple[list[ScryfallCardSnapshot], int, bool]:
            del query, page_size
            return [], 0, False

    monkeypatch.setattr(agent_service, "_owned_deck", lambda owner_id, deck_id: deck)
    monkeypatch.setattr(agent_service, "SessionLocal", FakeSession)
    monkeypatch.setattr(agent_service, "CatalogRepository", EmptyCatalog)
    context = DeckAgentContext(
        deck.owner_id,
        deck.id,
        uuid.uuid4(),
        uuid.uuid4(),
        cast("AgentEventSink", FakeSink()),
    )

    async def invoke() -> object:
        return await search_legal_cards.on_invoke_tool(
            ToolContext(
                context,
                tool_name="search_legal_cards",
                tool_call_id="tool-call-2",
                tool_arguments='{"query":"o:\\"whenever a creature enters draw a card\\""}',
            ),
            json.dumps({"query": 'o:"whenever a creature enters draw a card"'}),
        )

    result = asyncio.run(invoke())
    payload = json.loads(cast("str", result))

    assert payload["unique_cards_returned"] == 0
    assert payload["search_tips"]
    assert any("regex" in tip.lower() for tip in payload["search_tips"])
    assert any("o:/when.*?enter.*?draw/" in tip for tip in payload["search_tips"])
    assert any("o:/whenever.*?draw/" in tip for tip in payload["search_tips"])


def test_event_context_preserves_prior_proposals_and_outcomes() -> None:
    run_id = uuid.uuid4()
    conversation_id = uuid.uuid4()
    context = _event_context_summary(
        [
            DeckAgentEvent(
                run_id=run_id,
                conversation_id=conversation_id,
                sequence=2,
                event_type="operation_applied",
                payload={"proposal_id": "proposal-1", "revision": 4},
            ),
            DeckAgentEvent(
                run_id=run_id,
                conversation_id=conversation_id,
                sequence=1,
                event_type="operation_proposal",
                payload={"proposal_id": "proposal-1", "reason": "Add interaction"},
            ),
        ]
    )

    assert "Relevant actions and results from earlier turns" in context
    assert context.index("operation_proposal") < context.index("operation_applied")
    assert "proposal-1" in context


def test_agent_retry_delay_prefers_retry_after_hint_from_error_message() -> None:
    response = httpx.Response(
        429,
        headers={"retry-after": "1"},
        request=httpx.Request("POST", "https://api.openai.com/v1/responses"),
    )
    error = RateLimitError(
        "Rate limit reached. Please try again in 2.598s.",
        response=response,
        body=None,
    )

    assert _agent_retry_delay(error, 0) == pytest.approx(2.598)


def test_agent_retries_transient_openai_errors_before_succeeding(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts = 0
    delays: list[float] = []
    emitted: list[tuple[str, dict[str, str]]] = []
    response = httpx.Response(
        429,
        request=httpx.Request("POST", "https://api.openai.com/v1/responses"),
    )

    class FakeSink:
        async def emit(self, event_type: str, payload: object) -> None:
            emitted.append((event_type, cast("dict[str, str]", payload)))

    async def fake_run_once(context: DeckAgentContext, prompt: str) -> str:
        nonlocal attempts
        del context, prompt
        attempts += 1
        if attempts < 3:
            raise RateLimitError(
                "Rate limit reached. Please try again in 2.5s.",
                response=response,
                body=None,
            )
        return "done"

    async def fake_sleep(delay: float) -> None:
        delays.append(delay)

    monkeypatch.setattr(agent_service, "_run_agent_once", fake_run_once)
    monkeypatch.setattr(agent_service.asyncio, "sleep", fake_sleep)
    context = DeckAgentContext(
        uuid.uuid4(),
        uuid.uuid4(),
        uuid.uuid4(),
        uuid.uuid4(),
        cast("AgentEventSink", FakeSink()),
    )

    result = asyncio.run(agent_service._run_agent_with_retry(context, "prompt"))

    assert result == "done"
    assert attempts == 3
    assert delays == [2.5, 2.5]
    assert [
        message
        for event_type, payload in emitted
        if event_type == "status"
        and (message := payload.get("message")) is not None
    ] == [
        "OpenAI temporarily rate-limited this run; retrying in 2.5s.",
        "OpenAI temporarily rate-limited this run; retrying in 2.5s.",
    ]


def test_agent_stops_retrying_after_max_attempts(monkeypatch: pytest.MonkeyPatch) -> None:
    attempts = 0
    response = httpx.Response(
        429,
        request=httpx.Request("POST", "https://api.openai.com/v1/responses"),
    )

    class FakeSink:
        async def emit(self, event_type: str, payload: object) -> None:
            del event_type, payload

    async def fake_run_once(context: DeckAgentContext, prompt: str) -> str:
        nonlocal attempts
        del context, prompt
        attempts += 1
        raise APIStatusError(
            "rate limited",
            response=response,
            body=None,
        )

    async def fake_sleep(delay: float) -> None:
        del delay

    monkeypatch.setattr(agent_service, "_run_agent_once", fake_run_once)
    monkeypatch.setattr(agent_service.asyncio, "sleep", fake_sleep)
    context = DeckAgentContext(
        uuid.uuid4(),
        uuid.uuid4(),
        uuid.uuid4(),
        uuid.uuid4(),
        cast("AgentEventSink", FakeSink()),
    )

    with pytest.raises(APIStatusError):
        asyncio.run(agent_service._run_agent_with_retry(context, "prompt"))

    assert attempts == MAX_AGENT_RUN_ATTEMPTS


def test_cohesive_context_marks_revision_as_stale_after_mutation() -> None:
    prompt = _cohesive_context_prompt(
        {"title": "Deck", "revision": 3, "cards": []},
        {"valid": False, "card_count": 0, "errors": []},
        {"color_identity": ["U"], "color_identity_source": "commander"},
        "\n\nRelevant actions and results from earlier turns:\n[]",
        "user: earlier request",
        "Make a change",
    )

    assert "use tools again after any mutation" in prompt
    assert "Deck details and cards" in prompt
    assert "Current deck validation results (complete)" in prompt
    assert "Relevant actions and results from earlier turns" in prompt


def test_agent_prompt_card_payload_includes_shared_details_and_note() -> None:
    cardset = _cardset(_snapshot("Counterspell", "counterspell", ["U"]), CardZone.MAINBOARD)
    cardset.note = "Save for the combo turn."

    prompt = agent_service._agent_prompt(_deck(cardset), "", "Review this card")

    assert '"note":"Save for the combo turn."' in prompt
    assert "Cardset Notes:" in prompt
    assert "Save for the combo turn." in prompt


def test_initial_context_uses_one_deck_snapshot_and_fetches_events_in_parallel(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    delay = 0.15

    deck = _deck()
    deck.revision = 4
    deck_loads = 0
    payload_snapshots: list[tuple[int, int]] = []

    def owned_deck(owner_id: uuid.UUID, deck_id: uuid.UUID) -> Deck:
        nonlocal deck_loads
        del owner_id, deck_id
        deck_loads += 1
        time.sleep(delay)
        return deck

    def details(subject: Deck) -> dict[str, object]:
        payload_snapshots.append((id(subject), subject.revision))
        return {"title": "Deck", "revision": subject.revision, "cards": []}

    def validation(subject: Deck) -> JsonObject:
        payload_snapshots.append((id(subject), subject.revision))
        return {"valid": True, "card_count": 100, "errors": []}

    def fundamentals(subject: Deck) -> dict[str, object]:
        payload_snapshots.append((id(subject), subject.revision))
        return {"color_identity": ["U"], "color_identity_source": "commander"}

    def events(conversation_id: uuid.UUID) -> str:
        del conversation_id
        time.sleep(delay)
        return ""

    monkeypatch.setattr(agent_service, "_owned_deck", owned_deck)
    monkeypatch.setattr(agent_service, "_deck_details_payload", details)
    monkeypatch.setattr(agent_service, "_validation_payload", validation)
    monkeypatch.setattr(agent_service, "_deck_fundamentals_payload", fundamentals)
    monkeypatch.setattr(agent_service, "_conversation_event_context", events)

    started_at = time.monotonic()
    prompt = _initial_context_prompt(
        uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), "", "Review this deck"
    )
    elapsed = time.monotonic() - started_at

    details_payload = json.dumps(
        {"title": "Deck", "revision": 4, "cards": []}, separators=(",", ":")
    )
    assert details_payload in prompt
    assert deck_loads == 1
    assert payload_snapshots == [(id(deck), 4)] * 3
    assert elapsed < delay * 1.8


def test_guidance_approval_applies_fields_and_increments_expected_revision(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner_id = uuid.uuid4()
    deck = _deck()
    deck.owner_id = owner_id
    deck.revision = 5
    proposal = DeckGuidanceProposal(
        id=uuid.uuid4(),
        run_id=uuid.uuid4(),
        conversation_id=uuid.uuid4(),
        deck_id=deck.id,
        owner_id=owner_id,
        expected_revision=5,
        reason="Clarify the plan",
        proposed_goal="Win through artifacts.",
        status="pending",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    @dataclass
    class FakeDb:
        commits: int = 0

        def scalar(self, statement: object) -> Deck:
            del statement
            return deck

        def commit(self) -> None:
            self.commits += 1

        def refresh(self, value: object) -> None:
            del value

    db = FakeDb()
    monkeypatch.setattr(GuidanceProposalRepository, "pending_proposal", lambda *args: proposal)
    monkeypatch.setattr(GuidanceProposalRepository, "locked_owned_deck", lambda *args: deck)
    user = User(id=owner_id, discord_id="1", username="owner")

    result = guidance_routes.approve_guidance_proposal(
        deck.id,
        proposal.id,
        DeckGuidanceProposalDecision(expected_revision=5),
        cast("Session", db),
        user,
    )

    assert result.status == "approved"
    assert deck.goal == "Win through artifacts."
    assert deck.revision == 6
    assert db.commits == 1
