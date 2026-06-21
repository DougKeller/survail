import asyncio
import contextlib
import hashlib
import json
import logging
import random
import re
import time
from collections.abc import Awaitable, Callable, Sequence
from enum import StrEnum
from typing import Any, Literal, Protocol

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, RateLimitError
from pydantic import BaseModel, ConfigDict, Field, create_model
from sqlalchemy import select
from sqlalchemy.orm import Session

from survail.core.models import CardRoleEvaluation, CardSet, Deck
from survail.core.schemas import ScryfallCardSnapshot
from survail.core.types import JsonObject, json_object
from survail.modules.cards.repository.cards import CatalogRepository
from survail.modules.decks.service.analytics import (
    COLOR_LABELS,
    color_pip_counts,
    format_mana_value,
    mana_curve_counts,
    mana_curve_sort_key,
    scoped_cardsets,
)
from survail.modules.decks.service.context import (
    format_cardset_group_for_llm,
    oracle_text_for_llm,
    power_toughness_for_llm,
    snapshot_from_cardsets,
)
from survail.modules.decks.evaluations.api.schemas import CardRoleEvaluationRead, CardRoleScoreRead

MAX_CONCURRENT_EVALUATIONS = 2
EVALUATOR_VERSION = "roles-v7"
MAX_ATTEMPTS = 8
MAX_RETRY_DELAY_SECONDS = 60.0
ROLE_JUDGE_TARGET_WORDS = "20 to 40 words"
ROLE_JUDGE_MAX_TEXT_LENGTH = 600
MAX_ROLE_JUDGE_OUTPUT_TOKENS = 1000
OVERALL_SCORE_WEIGHTING_EXPONENT = 2.5
logger = logging.getLogger(__name__)
ProgressCallback = Callable[["EvaluationProgress"], Awaitable[None]]
ResultCallback = Callable[[CardRoleEvaluationRead], Awaitable[None]]
_RETRY_AFTER_MESSAGE = re.compile(
    r"(?:try again in|retry after) ([0-9.]+)\s*(ms|s(?:ec(?:ond)?s?)?)\b",
    re.IGNORECASE,
)


class EvaluationProgress(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    completed: int
    total: int
    average_seconds_per_card: float | None
    eta_seconds: float | None


class QualitativeRating(StrEnum):
    VERY_LOW = "very_low"
    LOW = "low"
    NEUTRAL = "neutral"
    HIGH = "high"
    VERY_HIGH = "very_high"


RATING_SCORES: dict[QualitativeRating, int] = {
    QualitativeRating.VERY_LOW: 0,
    QualitativeRating.LOW: 25,
    QualitativeRating.NEUTRAL: 50,
    QualitativeRating.HIGH: 75,
    QualitativeRating.VERY_HIGH: 100,
}

ROLE_RUBRICS: dict[str, dict[str, str]] = {
    "land": {
        "mana_reliability": (
            "How reliably does it produce the colors this deck's commander, core cards, and "
            "strategy require?"
        ),
        "tempo_efficiency": (
            "How little tempo loss does it impose through entering tapped, sequencing "
            "constraints, activation costs, or conditional mana?"
        ),
        "utility": "How valuable is its non-mana utility to this deck's plan or common game states?",
        "opportunity_cost": (
            "How reasonable is its slot cost compared with a basic land, stronger fixing land, "
            "or more broadly useful utility land?"
        ),
        "resilience": "How durable or difficult to disrupt is its mana or utility contribution?",
    },
    "mana_ramp": {
        "speed": "How early does it accelerate the deck's mana development?",
        "efficiency": (
            "How favorable is the mana, card, and tempo investment compared with the "
            "acceleration gained?"
        ),
        "fixing": "How well does it produce, find, or enable the colors this deck needs?",
        "reliability": (
            "How consistently can this deck use the ramp effect under normal gameplay conditions?"
        ),
        "synergy": (
            "How meaningfully does the ramp effect interact with the commander, core cards, "
            "card types, zones, or mechanics this deck already wants?"
        ),
    },
    "card_advantage": {
        "efficiency": "How efficiently does it generate extra cards, resources, or repeatable access?",
        "reliability": (
            "How consistently can this deck satisfy the conditions required to gain value from it?"
        ),
        "card_quality": "How relevant, selectable, or usable are the cards or resources it provides?",
        "repeatability": "How often can the deck benefit from the effect across a typical game?",
        "floor": (
            "How useful is the card when the deck's ideal engine or synergy pieces are not assembled?"
        ),
    },
    "selection_tutor": {
        "access": "How directly does it find, filter toward, or select the cards this deck wants?",
        "efficiency": (
            "How favorable is the mana, timing, and card investment for the access provided?"
        ),
        "range": "How broad and relevant is the set of cards it can find or select?",
        "setup_value": (
            "How well does it assemble the deck's key engines, answers, payoffs, or missing "
            "resources?"
        ),
        "timing": (
            "How well does the effect fit the stage of the game when this deck wants card "
            "selection or tutoring?"
        ),
    },
    "interaction": {
        "efficiency": "How mana-efficient and easy to deploy is this answer?",
        "coverage": "How broad and relevant is the range of threats it answers?",
        "permanence": "How cleanly and durably does it answer the threat?",
        "timing": "How well can it be used at the moment this deck needs interaction?",
        "flexibility": (
            "How useful is the card across different matchups, board states, or threat profiles?"
        ),
    },
    "board_control": {
        "reset_power": "How effectively does it reset, contain, or rebalance the relevant board state?",
        "asymmetry": "How well does it preserve, spare, or advance this deck's own plan?",
        "coverage": (
            "How well does it answer the permanent types or board states this deck is likely to "
            "struggle with?"
        ),
        "recoverability": "How well can this deck rebuild, recur, or benefit after the effect resolves?",
        "timing": (
            "How well does the effect line up with the stage of the game when this deck wants a "
            "reset or containment tool?"
        ),
    },
    "protection": {
        "coverage": (
            "How many relevant threats, removal types, disruption types, or failure modes does it "
            "protect against?"
        ),
        "efficiency": (
            "How easy is it to hold up, deploy, or sequence without disrupting the deck's plan?"
        ),
        "reliability": (
            "How consistently does it protect the cards, engines, or board states that matter?"
        ),
        "secondary_value": "How useful is the card when protection is not immediately needed?",
        "scope": (
            "How well does it protect the right amount of the deck's plan, from a single key "
            "piece to the full board?"
        ),
    },
    "engine_enabler": {
        "directness": "How directly does it create, fuel, or unlock the deck's core engine?",
        "reliability": "How consistently can this deck access and use the enabling effect?",
        "synergy_density": "How many important cards, zones, mechanics, or lines does it enable?",
        "timing": "How well does it come online before or as the deck wants to start its engine?",
    },
    "engine_support": {
        "amplification": (
            "How strongly does it increase the output, efficiency, resilience, or consistency of "
            "the deck's engine?"
        ),
        "coverage": (
            "How many relevant engine pieces, triggers, loops, or repeated actions does it improve?"
        ),
        "reliability": (
            "How consistently does it improve an engine that this deck can realistically assemble?"
        ),
        "floor": "How useful is it when the main engine is only partially assembled?",
    },
    "payoff": {
        "reward_size": "How large is the reward when the deck executes its core plan?",
        "decisiveness": (
            "How strongly does it convert engine activity into a win, inevitability, lethal "
            "pressure, or overwhelming advantage?"
        ),
        "attainability": "How reliably can this deck turn the payoff on?",
        "conversion": (
            "How efficiently does it convert setup into damage, board presence, cards, mana, "
            "disruption, or another decisive resource?"
        ),
    },
}
ROLE_NAMES = tuple(ROLE_RUBRICS)
StructuredRoleAnswers = {
    role: create_model(  # type: ignore[call-overload]
        f"{role.title().replace('_', '')}RoleAnswers",
        __config__=ConfigDict(extra="forbid", strict=True),
        **{criterion_id: (QualitativeRating, ...) for criterion_id in rubric},
    )
    for role, rubric in ROLE_RUBRICS.items()
}
StructuredApplicableRoles = {
    role: create_model(  # type: ignore[call-overload]
        f"{role.title().replace('_', '')}ApplicableRole",
        __config__=ConfigDict(extra="forbid", strict=True),
        description=(str, Field(min_length=1, max_length=ROLE_JUDGE_MAX_TEXT_LENGTH)),
        answers=(StructuredRoleAnswers[role], ...),
    )
    for role in ROLE_NAMES
}


class StructuredRoleScore(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    role: str
    description: str = Field(min_length=1, max_length=ROLE_JUDGE_MAX_TEXT_LENGTH)
    answers: dict[str, QualitativeRating]


NotApplicableRole = Literal["N/A"]
StructuredLLMaaJ = create_model(  # type: ignore[call-overload]
    "StructuredLLMaaJ",
    __config__=ConfigDict(extra="forbid", strict=True),
    **{
        role: (StructuredApplicableRoles[role] | NotApplicableRole, ...)
        for role in ROLE_NAMES
    },
    overall_summary=(str, Field(min_length=1, max_length=ROLE_JUDGE_MAX_TEXT_LENGTH)),
)

class RoleEvaluator(Protocol):
    async def evaluate(self, deck: Deck, oracle_id: str, card_context: str) -> BaseModel: ...


class OpenAIRoleEvaluator:
    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        random_value: Callable[[], float] = random.random,
    ) -> None:
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required")
        self._client = AsyncOpenAI(api_key=api_key, max_retries=0)
        self._model = model
        self._sleep = sleep
        self._random_value = random_value

    async def evaluate(self, deck: Deck, oracle_id: str, card_context: str) -> BaseModel:
        rubric_payload = {
            role: dict(rubric)
            for role, rubric in ROLE_RUBRICS.items()
        }
        role_list = ", ".join(ROLE_NAMES)
        result = await self._parse_with_retry(
            model=self._model,
            instructions=(
                "Return one combined LLMaaJ object for this card in this specific deck. Evaluate "
                f"all configured roles: {role_list}. For each role the card does not materially "
                'fulfill, return exactly "N/A". For each applicable role, return exactly one '
                "concise sentence describing how well the card fulfills that role and why, plus an "
                '"answers" object whose keys exactly match that role\'s rubric criterion IDs and '
                "whose values are qualitative ratings using only: very_low, low, neutral, high, "
                f"or very_high. Aim for about {ROLE_JUDGE_TARGET_WORDS} per applicable role "
                "description. Do not calculate numbers. Only mark land as applicable when the "
                "card's type line explicitly includes Land. Treat incidental or negligible "
                "functionality as inapplicable. Then return exactly one concise overall_summary "
                "sentence based only on the role evaluations, emphasizing the strongest "
                "contribution and any important limitation."
            ),
            input_text=(
                f"{_evaluation_input(deck, oracle_id, card_context)}\n\n"
                "Role rubrics:\n"
                f"{json.dumps(rubric_payload, indent=2)}"
            ),
            text_format=StructuredLLMaaJ,
            max_output_tokens=MAX_ROLE_JUDGE_OUTPUT_TOKENS,
        )
        _validate_llmaaj(result)
        return result

    async def _parse_with_retry(
        self,
        *,
        model: str,
        instructions: str,
        input_text: str,
        text_format: type[BaseModel],
        max_output_tokens: int,
    ) -> BaseModel:
        for attempt in range(MAX_ATTEMPTS):
            try:
                response = await self._client.responses.parse(
                    model=model,
                    instructions=instructions,
                    input=input_text,
                    text_format=text_format,
                    max_output_tokens=max_output_tokens,
                )
                if response.output_parsed is None:
                    raise ValueError("OpenAI returned no structured role evaluation")
                return response.output_parsed
            except (RateLimitError, APITimeoutError, APIConnectionError, APIStatusError) as error:
                if attempt + 1 == MAX_ATTEMPTS or not _retryable(error):
                    raise
                delay = _retry_delay(error, attempt, self._random_value())
                logger.warning(
                    "Role evaluation request failed (%s); retrying in %.1f seconds (attempt %s/%s)",
                    _error_status_label(error),
                    delay,
                    attempt + 2,
                    MAX_ATTEMPTS,
                )
                await self._sleep(delay)
        raise RuntimeError("Role evaluation retry loop exited unexpectedly")


def _error_status_label(error: Exception) -> str:
    if isinstance(error, APIStatusError):
        return f"HTTP {error.status_code}"
    return error.__class__.__name__


def _retryable(error: Exception) -> bool:
    return not isinstance(error, APIStatusError) or error.status_code in {
        408,
        409,
        429,
        500,
        502,
        503,
        504,
    }


def _retry_delay(error: Exception, attempt: int, random_value: float) -> float:
    exponential = min(2.0**attempt, MAX_RETRY_DELAY_SECONDS)
    retry_after = 0.0
    if isinstance(error, APIStatusError):
        header = error.response.headers.get("retry-after")
        if header is not None:
            with contextlib.suppress(ValueError):
                retry_after = float(header)
    match = _RETRY_AFTER_MESSAGE.search(str(error))
    if match is not None:
        message_delay = float(match.group(1))
        if match.group(2).lower() == "ms":
            message_delay /= 1000
        retry_after = max(retry_after, message_delay)
    jitter = min(exponential * 0.25 * random_value, 5.0)
    return min(max(exponential, retry_after) + jitter, MAX_RETRY_DELAY_SECONDS)


def _evaluation_input(deck: Deck, oracle_id: str, card_context: str) -> str:
    payload = _scoring_context_payload(deck, oracle_id, card_context)
    sections = [
        "North Star:",
        payload["goal"],
        "",
        "Commander:",
        payload["commander"],
        "",
        "Full Decklist:",
        payload["full_decklist"],
        "",
        "Current Mana Curve:",
        payload["mana_curve"],
        "",
        "Current Color-Pip Distribution:",
        payload["color_pip_distribution"],
        "",
        "Card under evaluation:",
        payload["card_under_evaluation"],
    ]
    return "\n".join(sections)


def _scoring_context_payload(deck: Deck, oracle_id: str, card_context: str) -> dict[str, Any]:
    return {
        "goal": deck.goal,
        "commander": _card_group_section(_commander_cardsets(deck, oracle_id)),
        "full_decklist": _card_group_section(
            scoped_cardsets(deck, exclude_oracle_id=oracle_id, core_only=True)
        ),
        "mana_curve": _mana_curve_section(deck, oracle_id),
        "color_pip_distribution": _color_pip_section(deck, oracle_id),
        "card_under_evaluation": card_context,
        "role_rubrics": ROLE_RUBRICS,
        "evaluator_version": EVALUATOR_VERSION,
    }


def _context_key(deck: Deck, oracle_id: str, card_context: str) -> str:
    payload = _scoring_context_payload(deck, oracle_id, card_context)
    payload["goal"] = " ".join(str(payload["goal"]).split())
    return hashlib.sha256(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    ).hexdigest()


def _commander_cardsets(deck: Deck, oracle_id: str) -> list[CardSet]:
    relevant = [
        cardset
        for cardset in deck.cardsets
        if cardset.zone.value == "commander" and cardset.oracle_id != oracle_id
    ]
    return sorted(relevant, key=lambda cardset: (cardset.zone.value, cardset.card_name, cardset.id))


def _read(evaluation: CardRoleEvaluation, *, cached: bool) -> CardRoleEvaluationRead:
    role_scores = [CardRoleScoreRead.model_validate(item, strict=False) for item in evaluation.roles]
    return CardRoleEvaluationRead(
        oracle_id=evaluation.oracle_id,
        deck_revision=evaluation.deck_revision,
        evaluator_version=evaluation.evaluator_version,
        overall_score=_calculate_overall_score(role_scores),
        overall_comment=evaluation.overall_comment,
        roles=role_scores,
        cached=cached,
    )


def read_cached_oracle_ids(
    db: Session, deck: Deck, oracle_ids: Sequence[str], contexts: dict[str, str]
) -> list[CardRoleEvaluationRead]:
    unique_ids = list(dict.fromkeys(oracle_ids))
    if not deck.goal.strip():
        return []
    context_keys = {
        oracle_id: _context_key(deck, oracle_id, contexts[oracle_id])
        for oracle_id in unique_ids
        if oracle_id in contexts
    }
    stored = db.scalars(
        select(CardRoleEvaluation).where(
            CardRoleEvaluation.deck_id == deck.id,
            CardRoleEvaluation.context_key.in_(context_keys.values()),
            CardRoleEvaluation.evaluator_version == EVALUATOR_VERSION,
        )
    )
    cached = {
        item.oracle_id: _read(item, cached=True)
        for item in stored
        if context_keys.get(item.oracle_id) == item.context_key
    }
    return [cached[oracle_id] for oracle_id in unique_ids if oracle_id in cached]


def _card_contexts(db: Session, deck: Deck, oracle_ids: Sequence[str]) -> dict[str, str]:
    contexts: dict[str, str] = {}
    for oracle_id in oracle_ids:
        cardsets = [cardset for cardset in deck.cardsets if cardset.oracle_id == oracle_id]
        if cardsets:
            contexts[oracle_id] = _card_brief(cardsets)
            continue
        printings = CatalogRepository(db).printing_records_by_oracle(oracle_id)
        if printings:
            contexts[oracle_id] = _catalog_card_brief(printings[0].snapshot)
    return contexts


def _card_group_section(cardsets: Sequence[CardSet]) -> str:
    grouped = _group_cardsets(cardsets)
    if not grouped:
        return "None"
    return "\n\n".join(_card_brief(group) for group in grouped)


def _group_cardsets(cardsets: Sequence[CardSet]) -> list[list[CardSet]]:
    grouped: dict[str, list[CardSet]] = {}
    for cardset in cardsets:
        grouped.setdefault(cardset.oracle_id, []).append(cardset)
    ordered = sorted(
        grouped.values(),
        key=lambda items: (items[0].zone.value, items[0].card_name, items[0].id),
    )
    return ordered


def _card_brief(cardsets: Sequence[CardSet]) -> str:
    return format_cardset_group_for_llm(cardsets)


def _catalog_card_brief(snapshot_payload: JsonObject) -> str:
    snapshot = ScryfallCardSnapshot.model_validate(snapshot_payload, strict=False)
    return _snapshot_brief(snapshot, quantity=0)


def _snapshot_from_cardsets(cardsets: Sequence[CardSet]) -> ScryfallCardSnapshot | None:
    return snapshot_from_cardsets(cardsets)


def _snapshot_brief(snapshot: ScryfallCardSnapshot, *, quantity: int) -> str:
    return "\n".join(
        [
            f"Name: {snapshot.name}",
            f"Quantity: {quantity}",
            "Zone Summary:",
            "- None",
            f"Cost: {snapshot.mana_cost or 'None'}",
            f"Type: {snapshot.type_line}",
            f"Power/Toughness: {power_toughness_for_llm(snapshot)}",
            f"Oracle Text: {oracle_text_for_llm(snapshot)}",
            "Cardset Notes:",
            "- None",
        ]
    )


def _mana_curve_section(deck: Deck, oracle_id: str) -> str:
    curve = mana_curve_counts(deck, exclude_oracle_id=oracle_id, core_only=True)
    if not curve:
        return "None"
    return "\n".join(
        f"- {cost}: {curve[cost]}"
        for cost in sorted(curve, key=mana_curve_sort_key)
    )


def _color_pip_section(deck: Deck, oracle_id: str) -> str:
    pip_counts = color_pip_counts(deck, exclude_oracle_id=oracle_id, core_only=True)
    populated = [(color, count) for color, count in pip_counts.items() if count > 0]
    if not populated:
        return "None"
    return "\n".join(
        f"- {COLOR_LABELS.get(color, color)} ({color}): {count}"
        for color, count in populated
    )


def _is_land_card_context(card_context: str) -> bool:
    match = re.search(r"^Type: (.+)$", card_context, re.MULTILINE)
    if match is not None:
        return "Land" in match.group(1)
    return False


def _role_json(result: StructuredRoleScore) -> JsonObject:
    numeric_scores = [RATING_SCORES[rating] for rating in result.answers.values()]
    return json_object(
        {
            "role": result.role,
            "score": round(sum(numeric_scores) / len(numeric_scores)),
            "description": result.description,
            "answers": json_object(
                {
                    criterion_id: rating.value
                    for criterion_id, rating in result.answers.items()
                }
            ),
        }
    )


def _role_score_from_llmaaj(
    role: str, evaluation: BaseModel, *, is_land: bool
) -> StructuredRoleScore | None:
    role_value = getattr(evaluation, role)
    if role == "land" and not is_land:
        return None
    if role_value == "N/A":
        return None
    return StructuredRoleScore(
        role=role,
        description=role_value.description,
        answers=role_value.answers.model_dump(),
    )  # type: ignore[arg-type]


def _validate_llmaaj(evaluation: BaseModel) -> None:
    for role in ROLE_NAMES:
        role_value = getattr(evaluation, role)
        if role_value == "N/A":
            continue
        expected = list(ROLE_RUBRICS[role])
        actual = list(role_value.answers.model_dump())
        if actual != expected:
            raise ValueError(f"OpenAI returned answers that do not match the {role} rubric")

def _calculate_overall_score(role_scores: list[CardRoleScoreRead]) -> int:
    if not role_scores:
        return 0

    sorted_scores = sorted(role_scores, key=lambda item: item.score, reverse=True)
    final_score = sum(
        float(role_score.score) / ((index + 1) ** OVERALL_SCORE_WEIGHTING_EXPONENT)
        for index, role_score in enumerate(sorted_scores)
    )

    return round(final_score)


def _assign_role_centralities(
    role_scores: list[CardRoleScoreRead],
) -> list[CardRoleScoreRead]:
    sorted_scores = sorted(role_scores, key=lambda item: item.score, reverse=True)

    updated: list[CardRoleScoreRead] = []

    for index, role_score in enumerate(sorted_scores):
        if index == 0:
            centrality = "primary"
        elif index == 1:
            centrality = "secondary"
        else:
            centrality = "tertiary"

        updated.append(role_score.model_copy(update={"centrality": centrality}))

    return updated

async def evaluate_oracle_ids(
    db: Session,
    deck: Deck,
    oracle_ids: Sequence[str],
    evaluator: RoleEvaluator | None,
    progress: ProgressCallback | None = None,
    result_callback: ResultCallback | None = None,
) -> list[CardRoleEvaluationRead]:
    if not deck.goal.strip():
        raise ValueError("Deck must have a Goal / North Star before cards can be evaluated")
    unique_ids = list(dict.fromkeys(oracle_ids))
    contexts = _card_contexts(db, deck, unique_ids)
    unresolved = [oracle_id for oracle_id in unique_ids if oracle_id not in contexts]
    if unresolved:
        raise ValueError(f"Oracle IDs not found: {', '.join(unresolved)}")
    context_keys = {
        oracle_id: _context_key(deck, oracle_id, contexts[oracle_id]) for oracle_id in unique_ids
    }
    cached = {
        item.oracle_id: item for item in read_cached_oracle_ids(db, deck, unique_ids, contexts)
    }
    missing = [oracle_id for oracle_id in unique_ids if oracle_id not in cached]
    if missing and evaluator is None:
        raise ValueError("OPENAI_API_KEY is required")
    started_at = time.monotonic()
    completed = len(cached)
    initial_cached_count = completed
    persist_lock = asyncio.Lock()

    async def report_progress() -> None:
        if progress is None:
            return
        elapsed = time.monotonic() - started_at
        processed = completed - initial_cached_count
        average = elapsed / processed if processed > 0 else None
        remaining = len(unique_ids) - completed
        await progress(
            EvaluationProgress(
                completed=completed,
                total=len(unique_ids),
                average_seconds_per_card=average,
                eta_seconds=average * remaining if average is not None else None,
            )
        )

    await report_progress()
    if result_callback is not None:
        for result in cached.values():
            await result_callback(result)
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_EVALUATIONS)

    async def progress_heartbeat() -> None:
        while True:
            await asyncio.sleep(2)
            await report_progress()

    async def evaluate(oracle_id: str) -> BaseModel:
        assert evaluator is not None
        async with semaphore:
            return await evaluator.evaluate(deck, oracle_id, contexts[oracle_id])

    async def evaluate_one(oracle_id: str) -> CardRoleEvaluationRead:
        nonlocal completed

        llmaaj = await evaluate(oracle_id)
        is_land = _is_land_card_context(contexts[oracle_id])

        raw_scores = [
            score
            for role in ROLE_NAMES
            if (score := _role_score_from_llmaaj(role, llmaaj, is_land=is_land))
            is not None
        ]

        raw_roles = [_role_json(score) for score in raw_scores]

        role_scores = [
            CardRoleScoreRead.model_validate(role, strict=False)
            for role in raw_roles
        ]

        ranked_role_scores = _assign_role_centralities(role_scores)

        roles = [
            role_score.model_dump(mode="json")
            for role_score in ranked_role_scores
        ]

        overall_comment = (
            llmaaj.overall_summary
            if ranked_role_scores
            else "No material role identified."
        )

        evaluation = CardRoleEvaluation(
            deck_id=deck.id,
            deck_revision=deck.revision,
            context_key=context_keys[oracle_id],
            evaluator_version=EVALUATOR_VERSION,
            oracle_id=oracle_id,
            overall_comment=overall_comment,
            roles=roles,
        )

        async with persist_lock:
            db.add(evaluation)
            db.commit()

            result = _read(evaluation, cached=False)
            cached[oracle_id] = result
            completed += 1

        if result_callback is not None:
            await result_callback(result)

        await report_progress()

        return result
    heartbeat = (
        asyncio.create_task(progress_heartbeat()) if progress is not None and missing else None
    )
    try:
        outcomes = await asyncio.gather(
            *(evaluate_one(oracle_id) for oracle_id in missing), return_exceptions=True
        )
    finally:
        if heartbeat is not None:
            heartbeat.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await heartbeat
    failure = next((outcome for outcome in outcomes if isinstance(outcome, BaseException)), None)
    if failure is not None:
        raise failure
    return [cached[oracle_id] for oracle_id in unique_ids]
