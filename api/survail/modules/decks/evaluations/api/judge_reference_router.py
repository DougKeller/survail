from fastapi import APIRouter, HTTPException

from survail.core.dependencies import CurrentUser
from survail.modules.decks.evaluations.judge_reference_contracts import JudgeReferenceRead
from survail.modules.decks.evaluations.service.judge_reference import (
    JudgeReferenceUnavailableError,
    load_judge_reference,
)

router = APIRouter(prefix="/evaluations/judge-reference", tags=["card-evaluations"])


@router.get("", response_model=JudgeReferenceRead)
async def judge_reference(user: CurrentUser) -> JudgeReferenceRead:
    del user
    try:
        return load_judge_reference()
    except JudgeReferenceUnavailableError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
