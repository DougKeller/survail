import asyncio
import contextlib
import json
import logging
import random
import re
import time
from collections.abc import Awaitable, Callable, Sequence
from enum import StrEnum
from typing import Literal, Protocol, TypeVar

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, RateLimitError
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from survail.core.models import CardRoleEvaluation, CardSet, Deck
from survail.core.types import JsonObject, json_object
from survail.modules.cards.repository.cards import CatalogRepository
from survail.modules.decks.evaluations.api.schemas import CardRoleEvaluationRead, CardRoleScoreRead
from survail.modules.decks.service.context import deck_description_context

MAX_CONCURRENT_EVALUATIONS = 2
EVALUATOR_VERSION = "roles-v4"
MAX_ATTEMPTS = 8
MAX_RETRY_DELAY_SECONDS = 60.0
ROLE_JUDGE_TARGET_WORDS = "20 to 40 words"
ROLE_JUDGE_MAX_TEXT_LENGTH = 600
MAX_CLASSIFICATION_OUTPUT_TOKENS = 200
MAX_ROLE_JUDGE_OUTPUT_TOKENS = 1000
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


class CardRole(StrEnum):
    LAND = "land"
    MANA_RAMP = "mana_ramp"
    CARD_ADVANTAGE = "card_advantage"
    REMOVAL = "removal"
    BOARD_WIPE = "board_wipe"
    ENABLER = "enabler"
    ENHANCER = "enhancer"
    PAYOFF = "payoff"


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

ROLE_RUBRICS: dict[CardRole, tuple[tuple[str, str], ...]] = {
    CardRole.LAND: (
        ("mana_reliability", "How reliably does it produce colors this deck needs?"),
        ("tempo_cost", "How little tempo or opportunity cost does it impose?"),
        ("utility", "How valuable is its utility in this specific deck?"),
        ("deck_need", "How much does the current mana base need this land's contribution?"),
    ),
    CardRole.MANA_RAMP: (
        ("speed", "How early and efficiently does it accelerate mana?"),
        ("reliability", "How reliably does it produce useful mana for this deck?"),
        ("resilience", "How resilient and reusable is the acceleration?"),
        ("deck_need", "How much does the current deck need this ramp contribution?"),
    ),
    CardRole.CARD_ADVANTAGE: (
        ("efficiency", "How efficiently does it produce selection or card advantage?"),
        ("reliability", "How reliably can this deck satisfy its conditions?"),
        ("quality", "How relevant and usable are the cards or resources it provides?"),
        ("deck_need", "How much does the current deck need this card-advantage contribution?"),
    ),
    CardRole.REMOVAL: (
        ("efficiency", "How mana-efficient and easy to deploy is this answer?"),
        ("coverage", "How broad and relevant is the range of threats it answers?"),
        ("conditionality", "How unconditional and permanent is the answer?"),
        ("deck_need", "How much does this improve the deck's current interaction mix?"),
    ),
    CardRole.BOARD_WIPE: (
        ("efficiency", "How efficiently can it reset the relevant board?"),
        ("asymmetry", "How well does it preserve or advance this deck's own plan?"),
        ("coverage", "How well does it answer the permanent types this deck struggles with?"),
        ("deck_need", "How appropriate is another wipe for the current list?"),
    ),
    CardRole.ENABLER: (
        ("directness", "How directly does it get the deck's core engine moving?"),
        ("reliability", "How reliably can the current deck use this enabling effect?"),
        ("versatility", "How many relevant lines or cards does it enable?"),
        ("deck_need", "How much does the current deck need this enabler?"),
    ),
    CardRole.ENHANCER: (
        ("scaling", "How strongly does it scale the deck's existing engine or payoffs?"),
        ("coverage", "How many relevant cards or lines receive its benefit?"),
        ("reliability", "How reliably does it improve an active game plan?"),
        ("deck_need", "How much does the current deck need this enhancer?"),
    ),
    CardRole.PAYOFF: (
        ("impact", "How strongly does it reward the deck for executing its plan?"),
        ("attainability", "How reliably can the current deck turn it on?"),
        ("conversion", "How well does it convert setup into advantage or a win?"),
        ("deck_need", "How much does the current deck need this payoff?"),
    ),
}


class StructuredTagging(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    tags: list[CardRole]


class StructuredAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    criterion_id: str
    rating: QualitativeRating


class StructuredRoleScore(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    role: CardRole
    description: str = Field(min_length=1, max_length=ROLE_JUDGE_MAX_TEXT_LENGTH)
    answers: list[StructuredAnswer]


class StructuredApplicableRole(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    description: str = Field(min_length=1, max_length=ROLE_JUDGE_MAX_TEXT_LENGTH)
    answers: list[StructuredAnswer]


NotApplicableRole = Literal["N/A"]


class StructuredLLMaaJ(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    land: StructuredApplicableRole | NotApplicableRole
    mana_ramp: StructuredApplicableRole | NotApplicableRole
    card_advantage: StructuredApplicableRole | NotApplicableRole
    removal: StructuredApplicableRole | NotApplicableRole
    board_wipe: StructuredApplicableRole | NotApplicableRole
    enabler: StructuredApplicableRole | NotApplicableRole
    enhancer: StructuredApplicableRole | NotApplicableRole
    payoff: StructuredApplicableRole | NotApplicableRole
    overall_summary: str = Field(min_length=1, max_length=ROLE_JUDGE_MAX_TEXT_LENGTH)


StructuredResult = TypeVar(
    "StructuredResult", StructuredTagging, StructuredRoleScore, StructuredLLMaaJ
)


class RoleEvaluator(Protocol):
    async def evaluate(self, deck: Deck, oracle_id: str, card_context: str) -> StructuredLLMaaJ: ...


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

    async def evaluate(self, deck: Deck, oracle_id: str, card_context: str) -> StructuredLLMaaJ:
        rubric_payload = {
            role.value: dict(rubric)
            for role, rubric in ROLE_RUBRICS.items()
        }
        result = await self._parse_with_retry(
            model=self._model,
            instructions=(
                "Return one combined LLMaaJ object for this card in this specific deck. Evaluate "
                "all eight roles: land, mana_ramp, card_advantage, removal, board_wipe, enabler, "
                "enhancer, and payoff. For each role the card does not materially fulfill, return "
                'exactly "N/A". For each applicable role, return exactly one concise sentence '
                "describing how well the card fulfills that role and why, plus qualitative ratings "
                "for every criterion in that role's rubric using only: very_low, low, neutral, "
                f"high, or very_high. Aim for about {ROLE_JUDGE_TARGET_WORDS} per applicable role "
                "description. Do not calculate numbers. Copy criterion IDs exactly and preserve "
                "their rubric order. Treat incidental or negligible functionality as inapplicable. "
                "Then return exactly one concise overall_summary sentence based only on the role "
                "evaluations, emphasizing the strongest contribution and any important limitation."
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
        text_format: type[StructuredResult],
        max_output_tokens: int,
    ) -> StructuredResult:
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
    return (
        f"Goal / North Star:\n{deck.goal}\n\n"
        f"Full deck context:\n{deck_description_context(deck)}\n\n"
        f"Card under evaluation ({oracle_id}):\n{card_context}"
    )


def _read(evaluation: CardRoleEvaluation, *, cached: bool) -> CardRoleEvaluationRead:
    return CardRoleEvaluationRead(
        oracle_id=evaluation.oracle_id,
        deck_revision=evaluation.deck_revision,
        evaluator_version=evaluation.evaluator_version,
        overall_score=evaluation.overall_score,
        overall_comment=evaluation.overall_comment,
        roles=[CardRoleScoreRead.model_validate(item, strict=False) for item in evaluation.roles],
        cached=cached,
    )


def _card_contexts(db: Session, deck: Deck, oracle_ids: Sequence[str]) -> dict[str, str]:
    contexts: dict[str, str] = {}
    for oracle_id in oracle_ids:
        cardsets = [cardset for cardset in deck.cardsets if cardset.oracle_id == oracle_id]
        if cardsets:
            contexts[oracle_id] = _deck_card_context(cardsets)
            continue
        printings = CatalogRepository(db).printing_records_by_oracle(oracle_id)
        if printings:
            contexts[oracle_id] = json.dumps(printings[0].snapshot, indent=2)
    return contexts


def _deck_card_context(cardsets: Sequence[CardSet]) -> str:
    return json.dumps(
        [
            {"quantity": item.quantity, "zone": item.zone.value, "card": item.scryfall}
            for item in cardsets
        ],
        indent=2,
    )


def _role_json(result: StructuredRoleScore) -> JsonObject:
    numeric_scores = [RATING_SCORES[answer.rating] for answer in result.answers]
    answers = [
        json_object(
            {
                "criterion_id": answer.criterion_id,
                "rating": answer.rating.value,
                "score": RATING_SCORES[answer.rating],
            }
        )
        for answer in result.answers
    ]
    return json_object(
        {
            "role": result.role.value,
            "score": round(sum(numeric_scores) / len(numeric_scores)),
            "description": result.description,
            "answers": answers,
        }
    )


def _role_score_from_llmaaj(
    role: CardRole, evaluation: StructuredLLMaaJ
) -> StructuredRoleScore | None:
    role_value = getattr(evaluation, role.value)
    if role_value == "N/A":
        return None
    return StructuredRoleScore(
        role=role,
        description=role_value.description,
        answers=role_value.answers,
    )


def _validate_llmaaj(evaluation: StructuredLLMaaJ) -> None:
    for role in CardRole:
        role_value = getattr(evaluation, role.value)
        if role_value == "N/A":
            continue
        expected = [criterion_id for criterion_id, _ in ROLE_RUBRICS[role]]
        actual = [answer.criterion_id for answer in role_value.answers]
        if actual != expected:
            raise ValueError(f"OpenAI returned answers that do not match the {role.value} rubric")


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
    stored = db.scalars(
        select(CardRoleEvaluation).where(
            CardRoleEvaluation.deck_id == deck.id,
            CardRoleEvaluation.deck_revision == deck.revision,
            CardRoleEvaluation.evaluator_version == EVALUATOR_VERSION,
            CardRoleEvaluation.oracle_id.in_(unique_ids),
        )
    )
    cached = {item.oracle_id: _read(item, cached=True) for item in stored}
    missing = [oracle_id for oracle_id in unique_ids if oracle_id not in cached]
    contexts = _card_contexts(db, deck, missing)
    unresolved = [oracle_id for oracle_id in missing if oracle_id not in contexts]
    if unresolved:
        raise ValueError(f"Oracle IDs not found: {', '.join(unresolved)}")
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

    async def evaluate(oracle_id: str) -> StructuredLLMaaJ:
        assert evaluator is not None
        async with semaphore:
            return await evaluator.evaluate(deck, oracle_id, contexts[oracle_id])

    async def evaluate_one(oracle_id: str) -> CardRoleEvaluationRead:
        nonlocal completed
        llmaaj = await evaluate(oracle_id)
        scores = [
            score
            for role in CardRole
            if (score := _role_score_from_llmaaj(role, llmaaj)) is not None
        ]
        roles = [_role_json(score) for score in scores]
        role_scores = [CardRoleScoreRead.model_validate(role, strict=False).score for role in roles]
        overall_score = max(role_scores, default=0)
        overall_comment = llmaaj.overall_summary if scores else "No material role identified."
        evaluation = CardRoleEvaluation(
            deck_id=deck.id,
            deck_revision=deck.revision,
            evaluator_version=EVALUATOR_VERSION,
            oracle_id=oracle_id,
            overall_score=overall_score,
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
