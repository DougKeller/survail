import asyncio
import json
import logging
import re
import time
import uuid
from collections.abc import AsyncIterator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from agents import Agent, RunContextWrapper, Runner, function_tool
from agents.items import ToolCallItem
from agents.stream_events import RawResponsesStreamEvent, RunItemStreamEvent
from fastapi import HTTPException
from openai import APIConnectionError, APIStatusError, APITimeoutError, RateLimitError
from openai.types.responses import ResponseFunctionToolCall
from openai.types.responses.response_text_delta_event import ResponseTextDeltaEvent
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from survail.core.config import get_settings
from survail.core.db import SessionLocal
from survail.core.models import (
    CardFinish,
    CardZone,
    Deck,
    DeckAgentEvent,
    DeckAgentRun,
    DeckConversation,
    DeckConversationMessage,
    DeckGuidanceProposal,
    DeckOperationProposal,
    User,
)
from survail.core.schemas import ScryfallCardSnapshot
from survail.core.telemetry import (
    observe_agent_run,
    record_agent_model_phase,
    record_agent_tool_call,
)
from survail.core.types import JsonObject, json_object
from survail.integrations.openai.imports import OpenAIDecklistExtractor
from survail.integrations.scryfall.client import ScryfallClient
from survail.modules.agent.service.events import AgentEventSink, AgentUiEvent
from survail.modules.cards.repository.cards import CatalogQueryError, CatalogRepository
from survail.modules.cards.service.printings import PrintingSelection, catalog_printing_selection
from survail.modules.decks.evaluations.service.evaluator import (
    OpenAIRoleEvaluator,
    evaluate_oracle_ids,
)
from survail.modules.decks.operations.contracts import (
    DeckOperationChangeCreate,
    DeckOperationCreate,
)
from survail.modules.decks.operations.service.apply import DeckOperationError, apply_deck_operation
from survail.modules.decks.service.context import format_cardset_group_for_llm
from survail.modules.decks.service.formats import strategy_for
from survail.modules.decks.service.validate import deck_validation_summary, validate_deck
from survail.modules.imports.service.preview import (
    ExtractedImportCard,
    MoxfieldCatalog,
    import_extracted_decklist,
    import_moxfield_decklist,
)

TERMINAL_EVENTS = frozenset({"run_completed", "run_failed"})
TOOL_ACTIVITY_MESSAGES = {
    "get_deck_summary": "Reading the deck",
    "validate_current_deck": "Checking deck validation",
    "search_legal_cards": "Searching for cards",
    "resolve_import_text": "Resolving the card list",
    "propose_deck_operation": "Preparing proposed changes",
    "evaluate_oracle_id": "Evaluating a card",
    "propose_deck_guidance": "Preparing goal guidance",
}
CONTEXT_EVENT_TYPES = frozenset(
    {
        "validation_results",
        "deck_summary",
        "card_results",
        "operation_proposal",
        "operation_applied",
        "guidance_proposal",
        "run_failed",
    }
)
logger = logging.getLogger(__name__)
_ADVANCED_SCRYFALL_QUERY = re.compile(r"[()]|\bOR\b", re.IGNORECASE)
_SCRYFALL_REGEX_OPERATOR = re.compile(r"\b(?:o|oracle|name|t|type):/[^/\n]+/")
MAX_AGENT_TURNS = 50
MAX_AGENT_RUN_ATTEMPTS = 6
MAX_AGENT_RETRY_DELAY_SECONDS = 60.0
_RETRY_AFTER_MESSAGE = re.compile(
    r"(?:try again in|retry after) ([0-9.]+)\s*(ms|s(?:ec(?:ond)?s?)?)\b",
    re.IGNORECASE,
)


class ProposedChange(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    printing_id: str = Field(min_length=1)
    quantity_delta: int
    zone: CardZone = Field(strict=False)
    finish: CardFinish = Field(strict=False)

    @field_validator("quantity_delta")
    @classmethod
    def reject_zero_delta(cls, value: int) -> int:
        if value == 0:
            raise ValueError("quantity_delta must describe an addition or removal")
        return value


@dataclass
class DeckAgentContext:
    owner_id: uuid.UUID
    deck_id: uuid.UUID
    conversation_id: uuid.UUID
    run_id: uuid.UUID
    sink: AgentEventSink
    activity_message: str = "Thinking about your deck"


async def _emit_activity(
    context: DeckAgentContext, event_type: str, message: str, **details: str
) -> None:
    context.activity_message = message
    await context.sink.emit(event_type, {"message": message, **details})


async def _emit_tool_status(
    context: DeckAgentContext,
    tool_name: str,
    message: str,
    detail: str | None = None,
) -> None:
    context.activity_message = message
    payload: dict[str, str] = {"message": message, "tool_name": tool_name}
    if detail is not None and detail.strip() != "":
        payload["detail"] = detail
    await context.sink.emit("status", payload)


async def _activity_heartbeat(context: DeckAgentContext) -> None:
    try:
        while True:
            await asyncio.sleep(4)
            await context.sink.emit_transient("heartbeat", {"message": context.activity_message})
    except asyncio.CancelledError:
        return


def _tool_name(event: RunItemStreamEvent) -> str | None:
    if not isinstance(event.item, ToolCallItem):
        return None
    raw_item = event.item.raw_item
    if isinstance(raw_item, ResponseFunctionToolCall):
        return raw_item.name
    if isinstance(raw_item, dict):
        name = raw_item.get("name")
        return name if isinstance(name, str) else None
    return None


def _tool_activity_message(tool_name: str) -> str:
    return TOOL_ACTIVITY_MESSAGES.get(tool_name, f"Using {tool_name.replace('_', ' ')}")


class AgentImportCatalog(MoxfieldCatalog):
    def __init__(self, db: Session) -> None:
        self._catalog = CatalogRepository(db)

    def printings(self, name: str) -> list[PrintingSelection]:
        return [
            catalog_printing_selection(card)
            for card in self._catalog.printing_records_by_name(name)
        ]


def _owned_deck(owner_id: uuid.UUID, deck_id: uuid.UUID) -> Deck:
    with SessionLocal() as db:
        deck = db.scalar(
            select(Deck)
            .options(selectinload(Deck.cardsets))
            .where(Deck.id == deck_id, Deck.owner_id == owner_id)
        )
        if deck is None:
            raise ValueError("Deck not found")
        db.expunge(deck)
        return deck


def _card_payload(card: ScryfallCardSnapshot) -> JsonObject:
    return json_object(
        {
            "printing_id": card.id,
            "oracle_id": card.oracle_id,
            "name": card.name,
            "mana_cost": card.mana_cost,
            "type_line": card.type_line,
            "image_uri": card.image_uris.normal if card.image_uris is not None else None,
            "set": card.set,
            "finishes": card.finishes,
        }
    )


def _deck_color_identity(deck: Deck) -> tuple[list[str], str]:
    commander_cards = [cardset for cardset in deck.cardsets if cardset.zone == CardZone.COMMANDER]
    source_cards = commander_cards or deck.cardsets
    colors = {
        color
        for cardset in source_cards
        for color in ScryfallCardSnapshot.model_validate(
            cardset.scryfall, strict=False
        ).color_identity
    }
    source = "commander" if commander_cards else "current deck" if source_cards else "unknown"
    return [color for color in "WUBRG" if color in colors], source


def _matches_color_identity(
    card: ScryfallCardSnapshot, allowed_colors: set[str], identity_known: bool
) -> bool:
    return not identity_known or set(card.color_identity).issubset(allowed_colors)


def _requires_scryfall_search(query: str) -> bool:
    """Return whether a query uses boolean syntax unsupported by the local catalog."""
    return _ADVANCED_SCRYFALL_QUERY.search(query) is not None


def _search_refinement_tips(
    query: str,
    *,
    total_cards: int,
    filtered_cards: int,
    identity_known: bool,
) -> list[str]:
    tips: list[str] = []
    if _SCRYFALL_REGEX_OPERATOR.search(query) is None:
        tips.append(
            "No regex search was detected. Try a broader oracle-text regex such as "
            "`o:/when.*?enter.*?draw/` or `o:/whenever.*?draw/` to match wording variants."
        )
    if '"' not in query:
        tips.append(
            'If you are searching for rules text, try quoting an exact phrase such as '
            '`o:"draw a card"` before broadening further.'
        )
    if total_cards > 0 and filtered_cards == 0 and identity_known:
        tips.append(
            "Matches were found before deck color-identity filtering. Try a query that better fits "
            "the deck's allowed colors or strategy."
        )
    if not any(token in query for token in ("mv", "cmc", "mana value", "mana_value")):
        tips.append(
            "If the query is still too broad or too narrow, add a mana-value bound such as "
            "`mv<=3` or `mv>=5`."
        )
    return tips


def _deck_details_payload(deck: Deck) -> dict[str, object]:
    return {
        "title": deck.title,
        "format": deck.format.value,
        "revision": deck.revision,
        "goal": deck.goal or "",
        "cards": [
            {
                "name": card.card_name,
                "quantity": card.quantity,
                "zone": card.zone.value,
                "printing_id": card.printing_id,
                "core": card.core,
                "note": card.note or "",
                "details": format_cardset_group_for_llm([card]),
            }
            for card in deck.cardsets
        ],
    }


def _attached_owned_deck_with_cards(
    db: Session, owner_id: uuid.UUID, deck_id: uuid.UUID
) -> Deck | None:
    return db.scalar(
        select(Deck)
        .options(selectinload(Deck.cardsets))
        .where(Deck.id == deck_id, Deck.owner_id == owner_id)
    )


def _assert_agent_changes_do_not_touch_core_cards(
    db: Session,
    owner_id: uuid.UUID,
    deck_id: uuid.UUID,
    changes: list[DeckOperationChangeCreate],
) -> None:
    deck = _attached_owned_deck_with_cards(db, owner_id, deck_id)
    if deck is None:
        raise DeckOperationError("Deck not found")
    core_cardsets = [cardset for cardset in deck.cardsets if cardset.core]
    if not core_cardsets:
        return
    locked_by_identity = {
        (cardset.printing_id, cardset.finish, cardset.zone): cardset for cardset in core_cardsets
    }
    locked_oracle_ids = {cardset.oracle_id for cardset in core_cardsets}
    catalog = CatalogRepository(db)
    for change in changes:
        if (change.printing_id, change.finish, change.zone) in locked_by_identity:
            raise DeckOperationError(
                "Agent may not edit starred core cards. Ask the user to unstar the card first."
            )
        printing = catalog.get_printing(change.printing_id)
        if printing is not None and printing.oracle_id in locked_oracle_ids:
            raise DeckOperationError(
                "Agent may not edit starred core cards. Ask the user to unstar the card first."
            )


def _deck_fundamentals_payload(deck: Deck) -> dict[str, object]:
    color_identity, color_identity_source = _deck_color_identity(deck)
    return {
        "format_deckbuilding_fundamentals": strategy_for(
            deck.format
        ).deckbuilding_fundamentals(),
        "color_identity": color_identity,
        "color_identity_source": color_identity_source,
    }


def _validation_payload(deck: Deck) -> JsonObject:
    return deck_validation_summary(deck)


def _cohesive_context_prompt(
    details: dict[str, object],
    validation: JsonObject,
    fundamentals: dict[str, object],
    prior_events: str,
    transcript: str,
    message: str,
) -> str:
    conversation = (
        f"Conversation so far:\n{transcript}\n\nCurrent user request:\n{message}"
        if transcript
        else f"Current user request:\n{message}"
    )
    return (
        "Current authoritative deck context follows. Treat its revision as the starting "
        "revision, and use tools again after any mutation because this context then becomes "
        "stale.\n\n"
        f"Deck details and cards:\n{json.dumps(details, separators=(',', ':'))}\n\n"
        f"Format deckbuilding fundamentals and color identity:\n"
        f"{json.dumps(fundamentals, separators=(',', ':'))}\n\n"
        f"Current deck validation results (complete):\n"
        f"{json.dumps(validation)}"
        f"{prior_events}\n\n{conversation}"
    )


def _initial_context_prompt(
    owner_id: uuid.UUID,
    deck_id: uuid.UUID,
    conversation_id: uuid.UUID,
    transcript: str,
    message: str,
) -> str:
    with ThreadPoolExecutor(max_workers=2, thread_name_prefix="agent-context") as executor:
        deck_future = executor.submit(_owned_deck, owner_id, deck_id)
        prior_events_future = executor.submit(_conversation_event_context, conversation_id)
        deck = deck_future.result()
        prior_events = prior_events_future.result()
    return _cohesive_context_prompt(
        _deck_details_payload(deck),
        _validation_payload(deck),
        _deck_fundamentals_payload(deck),
        prior_events,
        transcript,
        message,
    )


def _agent_prompt(deck: Deck, transcript: str, message: str) -> str:
    return _cohesive_context_prompt(
        _deck_details_payload(deck),
        _validation_payload(deck),
        _deck_fundamentals_payload(deck),
        "",
        transcript,
        message,
    )


def _conversation_event_context(conversation_id: uuid.UUID) -> str:
    with SessionLocal() as db:
        events = list(
            db.scalars(
                select(DeckAgentEvent)
                .where(
                    DeckAgentEvent.conversation_id == conversation_id,
                    DeckAgentEvent.event_type.in_(CONTEXT_EVENT_TYPES),
                )
                .order_by(DeckAgentEvent.created_at.desc(), DeckAgentEvent.sequence.desc())
                .limit(30)
            )
        )
    return _event_context_summary(events)


def _event_context_summary(events: list[DeckAgentEvent]) -> str:
    if not events:
        return ""
    summaries = [
        {"event": event.event_type, "details": event.payload} for event in reversed(events)
    ]
    return (
        "\n\nRelevant actions and results from earlier turns:\n"
        f"{json.dumps(summaries, separators=(',', ':'))}"
    )


@function_tool
async def get_deck_summary(context: RunContextWrapper[DeckAgentContext]) -> str:
    """Get the current deck, cards, zones, revision, and format."""
    deck = _owned_deck(context.context.owner_id, context.context.deck_id)
    await _emit_tool_status(
        context.context,
        "get_deck_summary",
        "Reading the current deck state",
        (
            f"Loaded deck \"{deck.title}\" at revision {deck.revision} in "
            f"{deck.format.value} with {len(deck.cardsets)} card entries."
        ),
    )
    payload = {
        "status": "current",
        "message": "Authoritative current deck summary.",
        **_deck_details_payload(deck),
        **_deck_fundamentals_payload(deck),
        "validation": _validation_payload(deck),
    }
    await context.context.sink.emit("deck_summary", payload)
    return json.dumps(payload)


@function_tool
async def validate_current_deck(context: RunContextWrapper[DeckAgentContext]) -> str:
    """Validate the current deck against its selected format."""
    deck = _owned_deck(context.context.owner_id, context.context.deck_id)
    await _emit_tool_status(
        context.context,
        "validate_current_deck",
        "Checking deck validation",
        (
            f"Validating revision {deck.revision} for {deck.format.value} using "
            f"{len(deck.cardsets)} card entries."
        ),
    )
    metadata = strategy_for(deck.format).parse_metadata(deck.metadata_json)
    card_count, errors = validate_deck(deck.format, metadata, deck.cardsets)
    payload = {
        "status": "current",
        "message": "Authoritative validation result for the current deck revision.",
        "current_revision": deck.revision,
        "valid": not errors,
        "card_count": card_count,
        "errors": [{"error_id": error.error_id, "message": error.message} for error in errors],
    }
    await context.context.sink.emit("validation_results", payload)
    return json.dumps(payload)


@function_tool
async def search_legal_cards(context: RunContextWrapper[DeckAgentContext], query: str) -> str:
    """Search cards with Scryfall syntax, constrained to the deck's format and color identity.

    Use Scryfall operators such as o:"draw a card", t:creature, id:ubg, mv<=3,
    -t:land, is:commander, or parenthesized OR expressions. Use quoted text for phrases.
    Do not put legal:<format> in query because this tool adds the deck format automatically.
    """
    deck = _owned_deck(context.context.owner_id, context.context.deck_id)
    legal_query = f"{query} legal:{deck.format.value}"
    color_identity, color_identity_source = _deck_color_identity(deck)
    allowed_colors = set(color_identity)
    identity_known = color_identity_source != "unknown"
    planned_source = (
        "Scryfall directly"
        if _requires_scryfall_search(query)
        else "the local catalog first, with Scryfall as fallback"
    )
    await _emit_tool_status(
        context.context,
        "search_legal_cards",
        "Searching for legal cards",
        (
            f"Original query: {query}\n"
            f"Effective query: {legal_query}\n"
            f"Planned search path: {planned_source}\n"
            f"Deck color identity: {','.join(color_identity) if color_identity else 'none'} "
            f"(source: {color_identity_source})"
        ),
    )
    with SessionLocal() as db:
        if _requires_scryfall_search(query):
            await _emit_tool_status(
                context.context,
                "search_legal_cards",
                "Searching Scryfall directly",
                "The query uses advanced boolean syntax that the local catalog does not support.",
            )
            client = ScryfallClient()
            try:
                cards, total_cards, has_more = client.search(legal_query)
                source = "scryfall"
            finally:
                client.close()
        else:
            try:
                cards, total_cards, has_more = CatalogRepository(db).search(
                    legal_query, page_size=120
                )
                source = "local_catalog"
            except CatalogQueryError:
                await _emit_tool_status(
                    context.context,
                    "search_legal_cards",
                    "Falling back to Scryfall",
                    (
                        "The local catalog could not evaluate this query, "
                        "so the search moved to Scryfall."
                    ),
                )
                client = ScryfallClient()
                try:
                    cards, total_cards, has_more = client.search(legal_query)
                    source = "scryfall"
                finally:
                    client.close()
    unique: dict[str, ScryfallCardSnapshot] = {}
    for card in cards:
        if not _matches_color_identity(card, allowed_colors, identity_known):
            continue
        unique.setdefault(card.oracle_id, card)
        if len(unique) == 24:
            break
    search_tips = (
        _search_refinement_tips(
            query,
            total_cards=total_cards,
            filtered_cards=len(unique),
            identity_known=identity_known,
        )
        if len(unique) == 0
        else []
    )
    payload = {
        "status": "completed",
        "message": (
            "Legal card search completed; no deck changes were made."
            if len(unique) > 0
            else "Legal card search found no cards; query-refinement tips are included."
        ),
        "current_revision": deck.revision,
        "query": query,
        "effective_query": legal_query,
        "search_source": source,
        "format": deck.format.value,
        "color_identity": color_identity,
        "color_identity_source": color_identity_source,
        "total_matching_printings": total_cards,
        "has_more": has_more,
        "unique_cards_returned": len(unique),
        "search_tips": search_tips,
        "cards": [_card_payload(card) for card in unique.values()],
    }
    await context.context.sink.emit("card_results", payload)
    return json.dumps(payload)


@function_tool
async def resolve_import_text(
    context: RunContextWrapper[DeckAgentContext], import_text: str
) -> str:
    """Resolve a pasted decklist, purchase receipt, or other card list into verified printings."""
    deck = _owned_deck(context.context.owner_id, context.context.deck_id)
    await _emit_tool_status(
        context.context,
        "resolve_import_text",
        "Resolving imported card text",
        (
            f"Attempting to match pasted text against the local catalog for a "
            f"{deck.format.value} deck at revision {deck.revision}."
        ),
    )
    with SessionLocal() as db:
        catalog = AgentImportCatalog(db)
        preview = import_moxfield_decklist(import_text, catalog)
        settings = get_settings()
        if preview.errors and settings.openai_api_key:
            await _emit_tool_status(
                context.context,
                "resolve_import_text",
                "Using AI fallback to recover card names",
                (
                    f"Initial parsing produced {len(preview.errors)} issue(s), so the import "
                    "text is being normalized with the OpenAI extractor "
                    "before re-resolving printings."
                ),
            )
            extracted = OpenAIDecklistExtractor(
                settings.openai_api_key, settings.openai_import_model
            ).extract(import_text)
            preview = import_extracted_decklist(
                [
                    ExtractedImportCard(
                        name=card.name,
                        set_name=card.set_name,
                        quantity=card.quantity,
                        foil=card.finish == "foil",
                    )
                    for card in extracted.cards
                ],
                catalog,
            )
    payload = {
        "status": "completed",
        "message": "Import text was resolved into verified printings; no deck changes were made.",
        "current_revision": deck.revision,
        "format": deck.format.value,
        "used_ai_fallback": preview.used_ai_fallback,
        "cards": [
            {
                "quantity": card.quantity,
                "printing_id": card.printing_id,
                "name": card.card_name,
                "set": card.set_code,
                "finish": card.finish.value,
                "zone": card.zone.value,
                "image_uri": (
                    card.scryfall.image_uris.normal
                    if card.scryfall.image_uris is not None
                    else None
                ),
            }
            for card in preview.cardsets
        ],
        "errors": [
            {"line_number": error.line_number, "code": error.code, "message": error.message}
            for error in preview.errors
        ],
    }
    return json.dumps(payload)


@function_tool
async def propose_deck_operation(
    context: RunContextWrapper[DeckAgentContext],
    reason: str,
    changes: list[ProposedChange],
) -> str:
    """Create a verified, unapplied deck-change proposal using exact printing IDs."""
    deck = _owned_deck(context.context.owner_id, context.context.deck_id)
    await _emit_tool_status(
        context.context,
        "propose_deck_operation",
        "Preparing a deck-change proposal",
        (
            f"Verifying {len(changes)} proposed change(s) against revision {deck.revision} "
            f"before creating an unapplied proposal."
        ),
    )
    if not changes:
        return json.dumps(
            {
                "status": "rejected",
                "proposed": False,
                "applied": False,
                "message": "No changes were supplied, so no proposal was created.",
                "current_revision": deck.revision,
            }
        )
    with SessionLocal() as db:
        catalog = CatalogRepository(db)
        enriched = []
        for change in changes:
            card = catalog.get_printing(change.printing_id)
            if card is None:
                return json.dumps(
                    {
                        "status": "rejected",
                        "proposed": False,
                        "applied": False,
                        "message": (
                            f"Printing {change.printing_id} was not found; no proposal "
                            "was created and the deck was not changed."
                        ),
                        "current_revision": deck.revision,
                    }
                )
            enriched.append({**change.model_dump(mode="json"), "card": _card_payload(card)})
        proposal = DeckOperationProposal(
            run_id=context.context.run_id,
            conversation_id=context.context.conversation_id,
            deck_id=deck.id,
            owner_id=context.context.owner_id,
            expected_revision=deck.revision,
            reason=reason,
            changes=json_object({"items": [change.model_dump(mode="json") for change in changes]}),
            status="pending",
        )
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
    payload = {
        "status": "proposed",
        "proposed": True,
        "applied": False,
        "message": "The proposal was created for human approval; the deck was not changed.",
        "proposal_id": str(proposal.id),
        "expected_revision": deck.revision,
        "current_revision": deck.revision,
        "reason": reason,
        "changes": enriched,
    }
    await context.context.sink.emit(
        "operation_proposal",
        {
            "proposal_id": str(proposal.id),
            "expected_revision": deck.revision,
            "reason": reason,
            "changes": enriched,
        },
    )
    return json.dumps(payload)


@function_tool
async def evaluate_oracle_id(
    context: RunContextWrapper[DeckAgentContext],
    oracle_id: str,
) -> str:
    """Score one oracle card's roles and fit against the current owned deck and its Goal."""
    deck = _owned_deck(context.context.owner_id, context.context.deck_id)
    await _emit_tool_status(
        context.context,
        "evaluate_oracle_id",
        "Evaluating a card against the deck goal",
        (
            f"Evaluating oracle ID {oracle_id} for deck revision {deck.revision} "
            f"using the current Goal / North Star."
        ),
    )
    if not deck.goal or not deck.goal.strip():
        return json.dumps(
            {
                "status": "blocked",
                "evaluated": False,
                "message": "Set a Goal / North Star before evaluating cards.",
                "deck_id": str(deck.id),
                "current_revision": deck.revision,
                "oracle_id": oracle_id,
            }
        )
    settings = get_settings()
    evaluator = OpenAIRoleEvaluator(settings.openai_api_key, settings.openai_role_evaluation_model)
    with SessionLocal() as db:
        attached = db.scalar(
            select(Deck)
            .options(selectinload(Deck.cardsets))
            .where(Deck.id == deck.id, Deck.owner_id == context.context.owner_id)
        )
        if attached is None:
            raise ValueError("Deck not found")
        evaluations = await evaluate_oracle_ids(db, attached, [oracle_id], evaluator)
    evaluation = evaluations[0]
    return json.dumps(
        {
            "status": "completed",
            "evaluated": True,
            "message": (
                "Card evaluation loaded from the current deck-revision cache; no deck changes "
                "were made."
                if evaluation.cached
                else "Card evaluation completed and was cached for the current deck revision; "
                "no deck changes were made."
            ),
            "deck_id": str(deck.id),
            "current_revision": deck.revision,
            "oracle_id": oracle_id,
            "cached": evaluation.cached,
            "evaluation": evaluation.model_dump(mode="json"),
        }
    )


@function_tool
async def propose_deck_guidance(
    context: RunContextWrapper[DeckAgentContext],
    reason: str,
    proposed_goal: str | None = None,
) -> str:
    """Propose a Goal / North Star update for human approval; never applies it automatically."""
    if proposed_goal is None:
        raise ValueError("A proposed goal is required")
    if proposed_goal is not None:
        proposed_goal = proposed_goal.strip()
        if len(proposed_goal) > 5000:
            raise ValueError("proposed_goal must be at most 5000 characters")
    deck = _owned_deck(context.context.owner_id, context.context.deck_id)
    await _emit_tool_status(
        context.context,
        "propose_deck_guidance",
        "Preparing a guidance proposal",
        (
            f"Drafting a user-approval proposal for deck revision {deck.revision}.\n"
            f"Reason: {reason}"
        ),
    )
    with SessionLocal() as db:
        proposal = DeckGuidanceProposal(
            run_id=context.context.run_id,
            conversation_id=context.context.conversation_id,
            deck_id=deck.id,
            owner_id=context.context.owner_id,
            expected_revision=deck.revision,
            reason=reason,
            proposed_goal=proposed_goal,
            status="pending",
        )
        db.add(proposal)
        db.commit()
        db.refresh(proposal)
    payload = {
        "status": "proposed",
        "applied": False,
        "message": "Goal update proposed for human approval; the deck was not changed.",
        "proposal_id": str(proposal.id),
        "expected_revision": proposal.expected_revision,
        "current_revision": deck.revision,
        "reason": reason,
        "proposed_goal": proposed_goal,
    }
    await context.context.sink.emit("guidance_proposal", payload)
    return json.dumps(payload)


def build_agent() -> Agent[DeckAgentContext]:
    settings = get_settings()
    return Agent[DeckAgentContext](
        name="Survail deck advisor",
        model=settings.openai_agent_model,
        instructions=(
            "You advise the user about exactly one deck. Use tools for current facts. "
            "When a user pastes a decklist, receipt, purchase history, or unstructured card list, "
            "always call resolve_import_text instead of attempting one large card search. Use the "
            "verified printing IDs returned by that tool when proposing additions. "
            "Use search_legal_cards for card discovery. Translate strategic needs into precise "
            "Scryfall search syntax instead of broad natural-language searches. Useful operators "
            "include o:\"rules text\", t:type, -t:type, id:colors, c:colors, mv comparisons, "
            "is:commander, keywords, and parentheses with OR. Search iteratively: begin with the "
            "essential rules-text or type constraint, inspect results, then refine. The tool "
            "automatically adds format legality and enforces the deck color identity. "
            "Whenever you mention a card by name in your response, wrap its exact name in double "
            "square brackets, for example [[Sol Ring]]. "
            "Deck editing is incremental. A deck may be incomplete or invalid while the user is "
            "building it; do not resist, refuse, or delay useful changes merely because the result "
            "will remain below the required deck size or otherwise temporarily invalid. "
            "Always respect the deck color identity supplied in the deck summary and search "
            "results. For Commander and Brawl, the commander's color identity is authoritative. "
            "When searching or recommending cards, only use cards whose color identity is a "
            "subset of the deck color identity. Never recommend off-identity cards or off-identity "
            "basic lands. If color identity is unknown, establish it before making "
            "recommendations. "
            "Cards marked as core are locked. Never propose adding, removing, moving, or "
            "changing a starred core card. If a core card needs to change, tell the user "
            "to unstar it first. "
            "A proposed operation has not changed the deck. Never claim a deck change happened "
            "just because a proposal was created. Present proposed deck changes for human review "
            "and let the user apply or discard them manually. "
            "Strive to avoid introducing new validation errors when drafting proposals, while "
            "still allowing useful incremental changes to invalid decks. "
            "Propose concrete changes with propose_deck_operation. Do not attempt any direct "
            "deck mutation through tools. Use evaluate_oracle_id before judging a specific "
            "card. The evaluation is cached by current deck revision and oracle ID and reports "
            "intrinsic and strategic roles, qualitative rubric answers, deterministic scores, "
            "and rationales. "
            "Goal changes are different: propose them with propose_deck_guidance and never apply "
            "them without human approval."
        ),
        tools=[
            get_deck_summary,
            validate_current_deck,
            search_legal_cards,
            resolve_import_text,
            propose_deck_operation,
            evaluate_oracle_id,
            propose_deck_guidance,
        ],
    )


async def _execute(
    context: DeckAgentContext,
    prompt: str,
) -> None:
    with observe_agent_run(
        run_id=str(context.run_id),
        conversation_id=str(context.conversation_id),
        deck_id=str(context.deck_id),
    ):
        await _execute_observed(context, prompt)


async def _execute_observed(
    context: DeckAgentContext,
    prompt: str,
) -> None:
    started_at = time.monotonic()
    heartbeat: asyncio.Task[None] | None = None
    logger.info(
        "deck agent run execution started",
        extra={
            "run_id": str(context.run_id),
            "conversation_id": str(context.conversation_id),
            "deck_id": str(context.deck_id),
            "owner_id": str(context.owner_id),
        },
    )
    try:
        await _emit_activity(context, "run_started", "Thinking about your deck")
        heartbeat = asyncio.create_task(_activity_heartbeat(context))
        await _emit_activity(context, "model_started", "Thinking about your request")
        record_agent_model_phase("started")
        output = await _run_agent_with_retry(context, prompt)
        with SessionLocal() as db:
            db.add(
                DeckConversationMessage(
                    conversation_id=context.conversation_id, role="assistant", content=output
                )
            )
            run = db.get(DeckAgentRun, context.run_id)
            if run is not None:
                run.status = "completed"
            db.commit()
        await context.sink.emit("assistant_completed", {"message": output})
        await context.sink.emit("run_completed", {})
        record_agent_model_phase("completed")
        logger.info(
            "deck agent run completed",
            extra={
                "run_id": str(context.run_id),
                "duration_seconds": time.monotonic() - started_at,
            },
        )
    except asyncio.CancelledError:
        logger.warning(
            "deck agent run cancelled",
            extra={
                "run_id": str(context.run_id),
                "duration_seconds": time.monotonic() - started_at,
            },
        )
        raise
    except Exception as exc:
        logger.exception(
            "deck agent run failed",
            extra={
                "run_id": str(context.run_id),
                "duration_seconds": time.monotonic() - started_at,
            },
        )
        with SessionLocal() as db:
            run = db.get(DeckAgentRun, context.run_id)
            if run is not None:
                run.status = "failed"
                run.error = str(exc)
                db.commit()
        await context.sink.emit("run_failed", {"message": str(exc)})
    finally:
        if heartbeat is not None:
            heartbeat.cancel()
            await heartbeat


async def _run_agent_with_retry(context: DeckAgentContext, prompt: str) -> str:
    for attempt in range(MAX_AGENT_RUN_ATTEMPTS):
        try:
            return await _run_agent_once(context, prompt)
        except (RateLimitError, APITimeoutError, APIConnectionError, APIStatusError) as exc:
            if attempt + 1 == MAX_AGENT_RUN_ATTEMPTS or not _retryable_agent_error(exc):
                raise
            delay = _agent_retry_delay(exc, attempt)
            logger.warning(
                (
                    "deck agent run hit a transient OpenAI error; "
                    "retrying in %.1f seconds (attempt %s/%s)"
                ),
                delay,
                attempt + 2,
                MAX_AGENT_RUN_ATTEMPTS,
                extra={"run_id": str(context.run_id)},
            )
            await context.sink.emit(
                "status",
                {
                    "message": (
                        "OpenAI temporarily rate-limited this run; "
                        f"retrying in {delay:.1f}s."
                    ),
                    "detail": str(exc),
                },
            )
            await asyncio.sleep(delay)
            await _emit_activity(context, "model_started", "Retrying your request")
            record_agent_model_phase("retrying")
    raise RuntimeError("Agent retry loop exited unexpectedly")


async def _run_agent_once(context: DeckAgentContext, prompt: str) -> str:
    result = Runner.run_streamed(
        build_agent(),
        prompt,
        context=context,
        max_turns=MAX_AGENT_TURNS,
    )
    active_tools: list[str] = []
    response_started = False
    async for event in result.stream_events():
        if isinstance(event, RawResponsesStreamEvent) and isinstance(
            event.data, ResponseTextDeltaEvent
        ):
            if not response_started:
                response_started = True
                await _emit_activity(context, "model_started", "Writing a response")
            await context.sink.emit("assistant_text_delta", {"delta": event.data.delta})
        elif isinstance(event, RunItemStreamEvent) and event.name == "tool_called":
            tool_name = _tool_name(event)
            if tool_name is not None:
                record_agent_tool_call(tool_name)
                active_tools.append(tool_name)
                await _emit_activity(
                    context,
                    "tool_started",
                    _tool_activity_message(tool_name),
                    tool_name=tool_name,
                )
        elif isinstance(event, RunItemStreamEvent) and event.name == "tool_output":
            if active_tools:
                tool_name = active_tools.pop(0)
                await _emit_activity(
                    context,
                    "tool_completed",
                    f"Finished {_tool_activity_message(tool_name).lower()}",
                    tool_name=tool_name,
                )
            await _emit_activity(context, "model_started", "Reviewing the results")
            record_agent_model_phase("reviewing")
    return str(result.final_output)


def _retryable_agent_error(error: Exception) -> bool:
    return not isinstance(error, APIStatusError) or error.status_code in {
        408,
        409,
        429,
        500,
        502,
        503,
        504,
    }


def _agent_retry_delay(error: Exception, attempt: int) -> float:
    exponential = min(2.0**attempt, MAX_AGENT_RETRY_DELAY_SECONDS)
    retry_after = 0.0
    if isinstance(error, APIStatusError):
        header = error.response.headers.get("retry-after")
        if header is not None:
            try:
                retry_after = float(header)
            except ValueError:
                retry_after = 0.0
    match = _RETRY_AFTER_MESSAGE.search(str(error))
    if match is not None:
        message_delay = float(match.group(1))
        if match.group(2).lower() == "ms":
            message_delay /= 1000
        retry_after = max(retry_after, message_delay)
    return min(max(exponential, retry_after), MAX_AGENT_RETRY_DELAY_SECONDS)


def _log_task_result(task: asyncio.Task[None], run_id: uuid.UUID) -> None:
    if task.cancelled():
        logger.warning("deck agent background task cancelled", extra={"run_id": str(run_id)})
        return
    error = task.exception()
    if error is not None:
        logger.error(
            "deck agent background task ended with error",
            exc_info=error,
            extra={"run_id": str(run_id)},
        )


async def start_run(
    owner_id: uuid.UUID, deck_id: uuid.UUID, conversation_id: uuid.UUID, message: str
) -> AgentEventSink:
    deck = _owned_deck(owner_id, deck_id)
    with SessionLocal() as db:
        conversation = db.scalar(
            select(DeckConversation).where(
                DeckConversation.id == conversation_id,
                DeckConversation.deck_id == deck_id,
                DeckConversation.owner_id == owner_id,
            )
        )
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        transcript = "\n".join(
            f"{message.role}: {message.content}" for message in conversation.messages[-20:]
        )
        run = DeckAgentRun(
            conversation_id=conversation_id,
            deck_id=deck_id,
            owner_id=owner_id,
            status="running",
            deck_revision_started=deck.revision,
        )
        db.add(run)
        db.add(
            DeckConversationMessage(conversation_id=conversation_id, role="user", content=message)
        )
        db.commit()
        db.refresh(run)
    sink = AgentEventSink(run.id, conversation_id)
    context = DeckAgentContext(owner_id, deck_id, conversation_id, run.id, sink)
    prompt = _initial_context_prompt(owner_id, deck_id, conversation_id, transcript, message)
    task = asyncio.create_task(_execute(context, prompt))
    task.add_done_callback(lambda completed: _log_task_result(completed, run.id))
    logger.info(
        "deck agent run created",
        extra={
            "run_id": str(run.id),
            "conversation_id": str(conversation_id),
            "deck_id": str(deck_id),
            "owner_id": str(owner_id),
        },
    )
    return sink


async def event_stream(sink: AgentEventSink) -> AsyncIterator[str]:
    logger.info("deck agent event stream opened", extra={"run_id": str(sink.run_id)})
    try:
        while True:
            event: AgentUiEvent = await sink.queue.get()
            serialized = json.dumps(
                {"type": event.type, "run_id": str(event.run_id), "payload": event.payload}
            )
            yield f"data: {serialized}\n\n"
            if event.type in TERMINAL_EVENTS:
                logger.info(
                    "deck agent event stream reached terminal event",
                    extra={"run_id": str(sink.run_id), "event_type": event.type},
                )
                return
    except asyncio.CancelledError:
        logger.warning("deck agent event stream cancelled", extra={"run_id": str(sink.run_id)})
        raise
