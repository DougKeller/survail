import asyncio
import json
import logging
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from openai import APIConnectionError, APIStatusError, APITimeoutError

from survail.core.dependencies import CurrentUser, DbSession
from survail.modules.decks.evaluations.api.schemas import (
    CardRoleEvaluationRead,
    CardRoleEvaluationRequest,
    EvaluationFeedbackRead,
    EvaluationFeedbackRequest,
)
from survail.modules.decks.evaluations.service.evaluator import EvaluationProgress
from survail.modules.decks.evaluations.service.feedback import (
    FeedbackEvaluationNotFoundError,
    FeedbackValidationError,
    submit_feedback,
)
from survail.modules.decks.evaluations.service.run import (
    GOAL_REQUIRED_DETAIL as EVALUATION_GOAL_REQUIRED_DETAIL,
)
from survail.modules.decks.evaluations.service.run import (
    EvaluationDeckNotFoundError,
    EvaluationGoalRequiredError,
    EvaluationService,
)

router = APIRouter(prefix="/decks/{deck_id}/card-evaluations", tags=["card-evaluations"])
logger = logging.getLogger(__name__)
GOAL_REQUIRED_DETAIL = EVALUATION_GOAL_REQUIRED_DETAIL


def _error(exc: ValueError) -> HTTPException:
    status_code = 503 if str(exc) == "OPENAI_API_KEY is required" else 422
    return HTTPException(status_code=status_code, detail=str(exc))


def _temporary_openai_error(exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=503, detail="Card evaluation is temporarily unavailable; please retry."
    )


@router.post("/current", response_model=list[CardRoleEvaluationRead])
async def evaluate_current_deck(
    deck_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> list[CardRoleEvaluationRead]:
    try:
        return await EvaluationService(db).current(user, deck_id)
    except EvaluationDeckNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except EvaluationGoalRequiredError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise _error(exc) from exc
    except (APIConnectionError, APITimeoutError, APIStatusError) as exc:
        raise _temporary_openai_error(exc) from exc


@router.get("/current/cached", response_model=list[CardRoleEvaluationRead])
async def cached_current_deck_evaluations(
    deck_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> list[CardRoleEvaluationRead]:
    try:
        return EvaluationService(db).cached_current(user, deck_id)
    except EvaluationDeckNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/current/cached", status_code=status.HTTP_204_NO_CONTENT)
async def clear_deck_evaluation_cache(
    deck_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> Response:
    try:
        EvaluationService(db).clear(user, deck_id)
    except EvaluationDeckNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/current/stream")
async def stream_current_deck_evaluation(
    deck_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> StreamingResponse:
    service = EvaluationService(db)
    try:
        service.require_evaluable_deck(user, deck_id)
    except EvaluationDeckNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except EvaluationGoalRequiredError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    async def events() -> AsyncIterator[str]:
        queue: asyncio.Queue[tuple[str, bool]] = asyncio.Queue()

        async def progress(update: EvaluationProgress) -> None:
            await queue.put((_event("progress", update.model_dump(mode="json")), False))

        async def result(update: CardRoleEvaluationRead) -> None:
            await queue.put((_event("result", update.model_dump(mode="json")), False))

        async def run() -> None:
            try:
                results = await service.current(user, deck_id, progress, result)
                await queue.put(
                    (
                        _event(
                            "completed",
                            {"results": [result.model_dump(mode="json") for result in results]},
                        ),
                        True,
                    )
                )
            except Exception as exc:
                logger.exception("Card role evaluation stream failed")
                await queue.put((_event("failed", {"message": str(exc)}), True))

        task = asyncio.create_task(run())
        try:
            terminal = False
            while not terminal:
                event, terminal = await queue.get()
                yield event
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(events(), media_type="text/event-stream")


def _event(event_type: str, payload: object) -> str:
    return f"data: {json.dumps({'type': event_type, 'payload': payload})}\n\n"


@router.post("/evaluate", response_model=list[CardRoleEvaluationRead])
async def evaluate_cards(
    deck_id: uuid.UUID,
    payload: CardRoleEvaluationRequest,
    db: DbSession,
    user: CurrentUser,
) -> list[CardRoleEvaluationRead]:
    try:
        return await EvaluationService(db).selected(user, deck_id, payload.oracle_ids)
    except EvaluationDeckNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except EvaluationGoalRequiredError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise _error(exc) from exc
    except (APIConnectionError, APITimeoutError, APIStatusError) as exc:
        raise _temporary_openai_error(exc) from exc


@router.post("/oracle/{oracle_id}", response_model=CardRoleEvaluationRead)
async def evaluate_card(
    deck_id: uuid.UUID,
    oracle_id: str,
    db: DbSession,
    user: CurrentUser,
) -> CardRoleEvaluationRead:
    """Evaluate one catalog card against one owned deck at its current revision."""
    try:
        return await EvaluationService(db).one(user, deck_id, oracle_id)
    except EvaluationDeckNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except EvaluationGoalRequiredError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise _error(exc) from exc
    except (APIConnectionError, APITimeoutError, APIStatusError) as exc:
        raise _temporary_openai_error(exc) from exc


@router.post("/feedback", response_model=EvaluationFeedbackRead, status_code=201)
async def submit_card_evaluation_feedback(
    deck_id: uuid.UUID,
    request: EvaluationFeedbackRequest,
    db: DbSession,
    user: CurrentUser,
) -> EvaluationFeedbackRead:
    """Record a thumbs verdict with expected-diff labels for a displayed evaluation."""
    try:
        feedback = submit_feedback(db, user, deck_id, request)
    except EvaluationDeckNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FeedbackEvaluationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except EvaluationGoalRequiredError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except FeedbackValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return EvaluationFeedbackRead(id=feedback.id)
