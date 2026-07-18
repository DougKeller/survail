import asyncio
import contextlib
import hashlib
import json
import logging
import math
import random
import re
import time
from collections.abc import Awaitable, Callable, Sequence
from enum import StrEnum
from typing import Literal, Protocol, TypedDict, TypeVar, cast

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, RateLimitError
from pydantic import BaseModel, ConfigDict, Field, create_model
from sqlalchemy import select
from sqlalchemy.orm import Session

from survail.core.models import CardRoleEvaluation, CardSet, Deck
from survail.core.schemas import ScryfallCardSnapshot
from survail.core.types import JsonObject, json_object
from survail.modules.cards.repository.cards import CatalogRepository
from survail.modules.decks.service.context import (
    oracle_text_for_llm,
    power_toughness_for_llm,
    snapshot_from_cardsets,
)
from survail.modules.decks.evaluations.api.schemas import CardRoleEvaluationRead, CardRoleScoreRead
from survail.modules.decks.evaluations.service.role_rubrics import (
    ROLE_DEFINITIONS,
    ROLE_GATE_CRITERIA,
    ROLE_NAMES,
    ROLE_RUBRICS,
)

MAX_CONCURRENT_EVALUATIONS = 2
EVALUATOR_VERSION = "roles-v11"
MAX_ATTEMPTS = 8
MAX_RETRY_DELAY_SECONDS = 60.0
ROLE_JUDGE_TARGET_WORDS = "20 to 40 words"
ROLE_JUDGE_MAX_TEXT_LENGTH = 600
MAX_ROLE_JUDGE_OUTPUT_TOKENS = 1000
OVERALL_SCORE_WEIGHTING_EXPONENT = 2.5
SECONDARY_ROLE_BASELINE = 50
logger = logging.getLogger(__name__)
ProgressCallback = Callable[["EvaluationProgress"], Awaitable[None]]
ResultCallback = Callable[[CardRoleEvaluationRead], Awaitable[None]]
_RETRY_AFTER_MESSAGE = re.compile(
    r"(?:try again in|retry after) ([0-9.]+)\s*(ms|s(?:ec(?:ond)?s?)?)\b",
    re.IGNORECASE,
)
_CARD_MENTION = re.compile(r"\[\[([^\[\]]+)\]\]")
ModelT = TypeVar("ModelT", bound=BaseModel)


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
# create_model's overloads reject dynamically-built **field_definitions under
# mypy, so the dynamic calls go through this loosely-parameterized alias.
_create_structured_model: Callable[..., type[BaseModel]] = create_model
StructuredRoleAnswers = {
    role: _create_structured_model(
        f"{role.title().replace('_', '')}RoleAnswers",
        __config__=ConfigDict(extra="forbid", strict=True),
        **{criterion_id: (QualitativeRating, ...) for criterion_id in rubric},
    )
    for role, rubric in ROLE_RUBRICS.items()
}
StructuredApplicableRoles = {
    role: _create_structured_model(
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


class StructuredLLMaaJBase(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    overall_summary: str = Field(min_length=1, max_length=ROLE_JUDGE_MAX_TEXT_LENGTH)


StructuredLLMaaJ = cast(
    "type[StructuredLLMaaJBase]",
    _create_structured_model(
        "StructuredLLMaaJ",
        __base__=StructuredLLMaaJBase,
        **{
            role: (StructuredApplicableRoles[role] | NotApplicableRole, ...)
            for role in ROLE_NAMES
        },
    ),
)


class RoleEvaluator(Protocol):
    async def evaluate(
        self, deck: Deck, oracle_id: str, card_context: str, references: str
    ) -> StructuredLLMaaJBase: ...


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

    async def evaluate(
        self, deck: Deck, oracle_id: str, card_context: str, references: str
    ) -> StructuredLLMaaJBase:
        result = await self._parse_with_retry(
            model=self._model,
            instructions=_evaluation_instructions(),
            input_text=_evaluation_input_with_rubrics(deck, oracle_id, card_context, references),
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
        text_format: type[ModelT],
        max_output_tokens: int,
    ) -> ModelT:
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


def _evaluation_input(deck: Deck, oracle_id: str, card_context: str, references: str) -> str:
    payload = _scoring_context_payload(deck, oracle_id, card_context, references)
    sections = [
        "North Star:",
        payload["goal"],
        "",
        "Commander:",
        payload["commander"],
        "",
        "Deck shape (rough shares in coarse bands):",
        payload["deck_shape"],
        "",
        "Cards referenced by the North Star or card notes:",
        payload["referenced_cards"],
        "",
        "Card under evaluation:",
        payload["card_under_evaluation"],
    ]
    return "\n".join(sections)


def _evaluation_instructions() -> str:
    role_list = ", ".join(ROLE_NAMES)
    return (
        "Return one combined LLMaaJ object for this card in this specific deck. Evaluate "
        f"all configured roles: {role_list}. Apply each role's definition strictly, "
        "including its exclusions: replacement draw is card_selection rather than "
        "card_advantage, one-shot burst mana is not mana_ramp, and effects that protect "
        "this deck's own plan are enabler rather than any kind of disruption. Decide "
        "between targeted_disruption and mass_disruption with the parity test in their "
        "definitions. A card can fill several roles, including the spell half of a modal "
        "land, but never assign two roles for the same underlying behavior — pick the one "
        "definition that best captures it and return N/A for the rest. Most cards "
        "materially fulfill one or two roles; returning N/A for every role is a correct "
        "answer for a card whose only contributions are generic staple work. For each "
        'role the card does not materially fulfill, return exactly "N/A". Marking a role '
        "applicable claims the card genuinely performs that job in this deck: if most of "
        'a role\'s criteria would rate low or very_low, return "N/A" for that role '
        "instead of rating it. For each applicable "
        "role, return exactly one concise sentence describing how well the card fulfills "
        'that role and why, plus an "answers" object whose keys exactly match that '
        "role's rubric criterion IDs and whose values are qualitative ratings using "
        "only: very_low, low, neutral, high, or very_high. Rate each criterion against "
        "all cards of this format that play the role, not against an empty slot: "
        "very_high means among the best printed examples of that criterion, high means "
        "clearly above average, neutral means typical, low and very_low mean below "
        "average or barely applicable. If every answer for a role is high or better, "
        "re-examine — most real cards have at least one typical or weak criterion. "
        "Ground every claim: only cite mechanics that appear in the card's rules text, "
        "and only cite synergies with cards or counts actually present in this deck's "
        "shape and referenced cards — never assume fetch lands, self-mill, discard, or "
        "token counts the deck does not show. Aim for about "
        f"{ROLE_JUDGE_TARGET_WORDS} per applicable role description. Do not calculate "
        "numbers. Only mark land as applicable when the card's type line explicitly "
        "includes Land. Treat incidental or negligible functionality as inapplicable. "
        "Use the deck shape to judge whether mass or symmetric effects would spare or "
        "hurt this deck's own board. Then return exactly one concise overall_summary "
        "sentence describing what the card does for this deck through its strongest "
        "applicable roles, plus any important limitation within those roles. Describe "
        "only the jobs the card does: never mention a role you rated N/A or low, and "
        "never use the phrases 'offers no', 'does not provide', 'lacks', 'adds no', "
        "'not a', 'just a', 'merely', or 'rather than' anywhere in any description or "
        "summary — state what the card does well and any limitation within its own "
        "roles, without contrasting against jobs it does not do."
    )


def _evaluation_input_with_rubrics(
    deck: Deck, oracle_id: str, card_context: str, references: str
) -> str:
    rubric_payload = {
        role: {"definition": ROLE_DEFINITIONS[role], "criteria": dict(rubric)}
        for role, rubric in ROLE_RUBRICS.items()
    }
    return (
        f"{_evaluation_input(deck, oracle_id, card_context, references)}\n\n"
        "Role definitions and rubrics:\n"
        f"{json.dumps(rubric_payload, indent=2)}"
    )


class _ScoringContextPayload(TypedDict):
    goal: str
    commander: str
    deck_shape: str
    referenced_cards: str
    card_under_evaluation: str
    role_definitions: dict[str, str]
    role_rubrics: dict[str, dict[str, str]]
    evaluator_version: str


def _scoring_context_payload(
    deck: Deck, oracle_id: str, card_context: str, references: str
) -> _ScoringContextPayload:
    return {
        "goal": deck.goal,
        "commander": _card_group_section(_commander_cardsets(deck, oracle_id)),
        "deck_shape": _deck_shape(deck),
        "referenced_cards": references,
        "card_under_evaluation": card_context,
        "role_definitions": ROLE_DEFINITIONS,
        "role_rubrics": ROLE_RUBRICS,
        "evaluator_version": EVALUATOR_VERSION,
    }


def _context_key(deck: Deck, oracle_id: str, card_context: str, references: str) -> str:
    payload = _scoring_context_payload(deck, oracle_id, card_context, references)
    payload["goal"] = " ".join(payload["goal"].split())
    return hashlib.sha256(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    ).hexdigest()


def _referenced_card_context(db: Session, deck: Deck, oracle_id: str) -> str:
    texts = [deck.goal]
    texts.extend(
        cardset.note or "" for cardset in deck.cardsets if cardset.oracle_id == oracle_id
    )
    names = list(
        dict.fromkeys(
            match.group(1).strip() for text in texts for match in _CARD_MENTION.finditer(text)
        )
    )
    briefs = [
        _snapshot_brief(snapshot)
        if (snapshot := _snapshot_for_name(db, deck, name)) is not None
        else f"Name: {name}\nOracle Text: (card not found)"
        for name in names
        if name
    ]
    return "\n\n".join(briefs) if briefs else "None"


_SHAPE_TYPE_LABELS = {
    "Creature": "Creatures",
    "Instant": "Instants",
    "Sorcery": "Sorceries",
    "Artifact": "Artifacts",
    "Enchantment": "Enchantments",
    "Planeswalker": "Planeswalkers",
    "Battle": "Battles",
    "Land": "Lands",
}
_SHAPE_ZONES = {"mainboard", "commander"}
_SHAPE_COLOR_LABELS = {"W": "White", "U": "Blue", "B": "Black", "R": "Red", "G": "Green"}
_SHAPE_PROMINENCE_THRESHOLD = 0.1
_BASIC_LAND_SUBTYPES = {"Plains", "Island", "Swamp", "Mountain", "Forest"}
_MANA_SYMBOL = re.compile(r"\{([^}]*)\}")


def _deck_shape(deck: Deck) -> str:
    type_counts = dict.fromkeys(_SHAPE_TYPE_LABELS, 0)
    pip_counts = dict.fromkeys(_SHAPE_COLOR_LABELS, 0)
    subtype_counts: dict[str, int] = {}
    legendary = 0
    total = 0
    for cardset in deck.cardsets:
        if cardset.zone.value not in _SHAPE_ZONES:
            continue
        type_line = str(cardset.scryfall.get("type_line", ""))
        total += cardset.quantity
        for card_type in _SHAPE_TYPE_LABELS:
            if card_type in type_line:
                type_counts[card_type] += cardset.quantity
        if "Legendary" in type_line:
            legendary += cardset.quantity
        for subtype in _subtypes(type_line):
            subtype_counts[subtype] = subtype_counts.get(subtype, 0) + cardset.quantity
        for color, pips in _card_pips(cardset.scryfall).items():
            pip_counts[color] += pips * cardset.quantity
    if total == 0:
        return "None"
    lines = [
        f"- {_SHAPE_TYPE_LABELS[card_type]}: {_shape_band(count / total)}"
        for card_type, count in type_counts.items()
        if count > 0
    ]
    if legendary / total >= _SHAPE_PROMINENCE_THRESHOLD:
        lines.append(f"- Legendary: {_shape_band(legendary / total)}")
    total_pips = sum(pip_counts.values())
    if total_pips > 0:
        lines.append("Color pips:")
        lines.extend(
            f"- {label}: {_shape_band(pip_counts[color] / total_pips)}"
            for color, label in _SHAPE_COLOR_LABELS.items()
            if pip_counts[color] > 0
        )
    prominent_subtypes = [
        f"- {subtype}: {_shape_band(count / total)}"
        for subtype, count in sorted(subtype_counts.items())
        if count / total >= _SHAPE_PROMINENCE_THRESHOLD
    ]
    if prominent_subtypes:
        lines.append("Prominent subtypes:")
        lines.extend(prominent_subtypes)
    return "\n".join(lines) if lines else "None"


def _subtypes(type_line: str) -> set[str]:
    subtypes: set[str] = set()
    for face in type_line.split("//"):
        _, _, tail = face.partition("—")
        subtypes.update(token for token in tail.split() if token not in _BASIC_LAND_SUBTYPES)
    return subtypes


def _card_pips(snapshot_payload: JsonObject) -> dict[str, int]:
    cost = str(snapshot_payload.get("mana_cost") or "")
    if not cost:
        faces = snapshot_payload.get("card_faces")
        if isinstance(faces, list):
            cost = "".join(
                str(face.get("mana_cost") or "") for face in faces if isinstance(face, dict)
            )
    counts: dict[str, int] = {}
    for symbol in _MANA_SYMBOL.findall(cost):
        for color in _SHAPE_COLOR_LABELS:
            if color in symbol:
                counts[color] = counts.get(color, 0) + 1
    return counts


def _shape_band(share: float) -> str:
    if share >= 0.5:
        return "most"
    if share >= 0.25:
        return "many"
    if share >= _SHAPE_PROMINENCE_THRESHOLD:
        return "some"
    return "few"


def _snapshot_for_name(db: Session, deck: Deck, name: str) -> ScryfallCardSnapshot | None:
    lowered = name.lower()
    for cardset in deck.cardsets:
        if cardset.card_name.lower() == lowered:
            return snapshot_from_cardsets([cardset])
    return CatalogRepository(db).exact_name(name)


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
        oracle_id: _context_key(
            deck, oracle_id, contexts[oracle_id], _referenced_card_context(db, deck, oracle_id)
        )
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
    snapshot = snapshot_from_cardsets(cardsets)
    if snapshot is None:
        return "Name: Unknown"
    notes = [
        note
        for cardset in sorted(cardsets, key=lambda item: (item.zone.value, item.id))
        if (note := (cardset.note or "").strip())
    ]
    lines = [_snapshot_brief(snapshot)]
    if notes:
        lines.append("Notes:")
        lines.extend(f"- {note}" for note in notes)
    return "\n".join(lines)


def _catalog_card_brief(snapshot_payload: JsonObject) -> str:
    snapshot = ScryfallCardSnapshot.model_validate(snapshot_payload, strict=False)
    return _snapshot_brief(snapshot)


def _snapshot_brief(snapshot: ScryfallCardSnapshot) -> str:
    return "\n".join(
        [
            f"Name: {snapshot.name}",
            f"Cost: {snapshot.mana_cost or 'None'}",
            f"Type: {snapshot.type_line}",
            f"Power/Toughness: {power_toughness_for_llm(snapshot)}",
            f"Oracle Text: {oracle_text_for_llm(snapshot)}",
        ]
    )


def _is_land_card_context(card_context: str) -> bool:
    match = re.search(r"^Type: (.+)$", card_context, re.MULTILINE)
    if match is not None:
        return "Land" in match.group(1)
    return False


def _role_json(result: StructuredRoleScore) -> JsonObject:
    # The gate criterion defines the role, so it must not be cancelled out by a
    # single off-axis rating (e.g. Sol Ring's colorless "fixing" dragging down
    # otherwise-perfect ramp): weight it double in the mean.
    gate = ROLE_GATE_CRITERIA.get(result.role)
    weights = {
        criterion_id: 2 if criterion_id == gate else 1 for criterion_id in result.answers
    }
    weighted_total = sum(
        RATING_SCORES[rating] * weights[criterion_id]
        for criterion_id, rating in result.answers.items()
    )
    return json_object(
        {
            "role": result.role,
            "score": round(weighted_total / sum(weights.values())),
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
    role: str, evaluation: StructuredLLMaaJBase, *, is_land: bool
) -> StructuredRoleScore | None:
    role_value = getattr(evaluation, role)
    if role == "land" and not is_land:
        return None
    if role_value == "N/A":
        return None
    answers: dict[str, QualitativeRating] = role_value.answers.model_dump()
    if _fails_role_gate(role, answers):
        return None
    return StructuredRoleScore(
        role=role,
        description=role_value.description,
        answers=answers,
    )


def _fails_role_gate(role: str, answers: dict[str, QualitativeRating]) -> bool:
    gate = ROLE_GATE_CRITERIA.get(role)
    if gate is None:
        return False
    return answers[gate] in {QualitativeRating.VERY_LOW, QualitativeRating.LOW}


def _validate_llmaaj(evaluation: StructuredLLMaaJBase) -> None:
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

    # The best role sets the base; secondary roles only fill a rank-tapered
    # fraction of the remaining headroom to 100, counted above the neutral
    # baseline. This keeps the overall bounded at 100 and stops marginal
    # secondary roles from outweighing primary-role quality.
    scores = sorted((float(item.score) for item in role_scores), reverse=True)
    best = scores[0]
    bonus_fraction = sum(
        max(0.0, score - SECONDARY_ROLE_BASELINE)
        / (100.0 - SECONDARY_ROLE_BASELINE)
        / math.pow(rank, OVERALL_SCORE_WEIGHTING_EXPONENT)
        for rank, score in enumerate(scores[1:], start=2)
    )
    return round(best + (100.0 - best) * bonus_fraction)


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
    references = {
        oracle_id: _referenced_card_context(db, deck, oracle_id) for oracle_id in unique_ids
    }
    context_keys = {
        oracle_id: _context_key(deck, oracle_id, contexts[oracle_id], references[oracle_id])
        for oracle_id in unique_ids
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

    async def evaluate(oracle_id: str) -> StructuredLLMaaJBase:
        assert evaluator is not None
        async with semaphore:
            return await evaluator.evaluate(
                deck, oracle_id, contexts[oracle_id], references[oracle_id]
            )

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
