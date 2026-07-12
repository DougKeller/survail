import uuid

from fastapi import APIRouter, HTTPException

from survail.core.config import get_settings
from survail.core.dependencies import CurrentUser, DbSession
from survail.modules.decks.evaluations.api.annotations_schemas import (
    RoleAnnotationCaptureRead,
    RoleAnnotationLabelUpsert,
    RoleAnnotationQueueRead,
    SandboxRunCreate,
    SandboxRunRead,
)
from survail.modules.decks.evaluations.service.annotations import RoleAnnotationService
from survail.modules.decks.evaluations.service.evaluator import OpenAIRoleEvaluator

router = APIRouter(prefix="/decks/{deck_id}/card-evaluation-annotations", tags=["card-evaluation-annotations"])


@router.get("", response_model=RoleAnnotationQueueRead)
def annotation_queue(deck_id: uuid.UUID, db: DbSession, user: CurrentUser) -> RoleAnnotationQueueRead:
    try:
        return RoleAnnotationService(db).queue(user, deck_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/{capture_id}/label", response_model=RoleAnnotationCaptureRead)
def label_annotation_capture(
    deck_id: uuid.UUID,
    capture_id: uuid.UUID,
    payload: RoleAnnotationLabelUpsert,
    db: DbSession,
    user: CurrentUser,
) -> RoleAnnotationCaptureRead:
    try:
        return RoleAnnotationService(db).label(user, deck_id, capture_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/sandbox", response_model=SandboxRunRead)
async def run_annotation_sandbox(
    deck_id: uuid.UUID,
    payload: SandboxRunCreate,
    db: DbSession,
    user: CurrentUser,
) -> SandboxRunRead:
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is required")
    evaluator = OpenAIRoleEvaluator(settings.openai_api_key, payload.model)
    try:
        return await RoleAnnotationService(db).run_sandbox(user, deck_id, payload, evaluator)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
