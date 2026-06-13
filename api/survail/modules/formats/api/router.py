from fastapi import APIRouter

from survail.core.models import DeckFormat

router = APIRouter(prefix="/formats", tags=["formats"])


@router.get("", response_model=list[DeckFormat])
def list_formats() -> list[DeckFormat]:
    return list(DeckFormat)
