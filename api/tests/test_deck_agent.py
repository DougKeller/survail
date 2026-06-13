import asyncio
import json
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import cast

import pytest
from agents import FunctionTool
from agents.tool_context import ToolContext
from sqlalchemy.orm import Session

from survail.deck_agent import service as agent_service
from survail.deck_agent.events import AgentEventSink
from survail.deck_agent.service import (
    DeckAgentContext,
    _cohesive_context_prompt,
    _deck_color_identity,
    _event_context_summary,
    _initial_context_prompt,
    _matches_color_identity,
    _operation_failure_payload,
    _requires_scryfall_search,
    build_agent,
    search_legal_cards,
)
from survail.domain.decks import deck_validation_summary
from survail.models import (
    CardFinish,
    CardSet,
    CardZone,
    Deck,
    DeckAgentEvent,
    DeckFormat,
    DeckGuidanceProposal,
    User,
)
from survail.repositories.agent import AgentRepository
from survail.routes import agent as agent_routes
from survail.schemas import DeckGuidanceProposalDecision, ScryfallCardSnapshot
from survail.types import JsonObject


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
    apply_operation = tools["apply_proposed_operation"]
    card_search = tools["search_legal_cards"]

    assert isinstance(resolve_import, FunctionTool)
    assert isinstance(apply_operation, FunctionTool)
    assert resolve_import.needs_approval is False
    assert apply_operation.needs_approval is False
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
    assert "without asking for confirmation" in instructions
    assert "complete validation result" in instructions
    assert "never apply them without human approval" in instructions
    assert "intrinsic and strategic roles" in instructions
    assert "qualitative rubric answers" in instructions
    assert "Use search_legal_cards for card discovery" in instructions
    assert "Scryfall search syntax" in instructions
    assert 'o:"rules text"' in instructions
    assert "automatically adds format legality" in instructions
    assert (
        "Only an apply_proposed_operation result with applied=true confirms a change"
        in instructions
    )
    assert (
        "After applied=true, treat the returned deck and validation as authoritative"
        in instructions
    )


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
    emitted: list[tuple[str, object]] = []

    class FakeSink:
        async def emit(self, event_type: str, payload: object) -> None:
            emitted.append((event_type, payload))

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
        cast(AgentEventSink, FakeSink()),
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
    payload = json.loads(cast(str, result))

    assert payload["search_source"] == "scryfall"
    assert payload["cards"][0]["name"] == "Helpful Card"
    assert queries == ["(t:creature OR t:artifact) o:draw legal:commander"]
    assert emitted[0][0] == "card_results"


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
                event_type="propose_operation",
                payload={"proposal_id": "proposal-1", "reason": "Add interaction"},
            ),
        ]
    )

    assert "Relevant actions and results from earlier turns" in context
    assert context.index("propose_operation") < context.index("operation_applied")
    assert "proposal-1" in context


def test_operation_failure_result_explicitly_says_deck_was_not_changed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    subject = _deck()
    subject.revision = 8
    monkeypatch.setattr(agent_service, "_owned_deck", lambda owner_id, deck_id: subject)

    result = _operation_failure_payload(
        subject.owner_id, subject.id, "bad-proposal", "The proposal is stale."
    )

    assert result["status"] == "failed"
    assert result["applied"] is False
    assert result["current_revision"] == 8
    assert result["validation"] == deck_validation_summary(subject)
    assert "deck was not changed" in cast(str, result["message"])


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
    monkeypatch.setattr(AgentRepository, "pending_guidance_proposal", lambda *args: proposal)
    monkeypatch.setattr(AgentRepository, "locked_owned_deck", lambda *args: deck)
    user = User(id=owner_id, discord_id="1", username="owner")

    result = agent_routes.approve_guidance_proposal(
        deck.id,
        proposal.id,
        DeckGuidanceProposalDecision(expected_revision=5),
        cast(Session, db),
        user,
    )

    assert result.status == "approved"
    assert deck.goal == "Win through artifacts."
    assert deck.revision == 6
    assert db.commits == 1
