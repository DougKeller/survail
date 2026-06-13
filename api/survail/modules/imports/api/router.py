from fastapi import APIRouter, HTTPException, status

from survail.core.dependencies import CurrentUser, DbSession
from survail.modules.decks.operations.contracts import DeckOperationCreate
from survail.modules.decks.operations.service.apply import DeckOperationError
from survail.modules.imports.api.schemas import (
    ImportedCardSetRead,
    MoxfieldDeckImportRead,
    MoxfieldDeckImportRequest,
    MoxfieldImportIssueRead,
    MoxfieldImportPreviewRead,
    MoxfieldImportRequest,
)
from survail.modules.imports.service.create import (
    ImportService,
    ImportValidationError,
    operation_payload,
)
from survail.modules.imports.service.preview import (
    ImportedCardSet,
    MoxfieldImportPreview,
)

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("/moxfield", response_model=MoxfieldImportPreviewRead)
def import_moxfield(
    payload: MoxfieldImportRequest,
    db: DbSession,
    _: CurrentUser,
) -> MoxfieldImportPreviewRead:
    return _preview_read(ImportService(db).preview(payload))


@router.post(
    "/moxfield/decks",
    response_model=MoxfieldDeckImportRead,
    status_code=status.HTTP_201_CREATED,
)
def create_deck_from_moxfield(
    payload: MoxfieldDeckImportRequest,
    db: DbSession,
    user: CurrentUser,
) -> MoxfieldDeckImportRead:
    try:
        result = ImportService(db).create_deck(user, payload)
    except ImportValidationError as exc:
        if isinstance(exc.detail, MoxfieldImportPreview):
            detail: object = _preview_read(exc.detail).model_dump(mode="json")
        else:
            detail = exc.detail
        raise HTTPException(status_code=422, detail=detail) from exc
    except DeckOperationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return MoxfieldDeckImportRead(
        deck_id=result.deck.id,
        operation_id=result.operation.id,
        revision=result.deck.revision,
        preview=_preview_read(result.preview),
    )


def _operation_payload(preview: MoxfieldImportPreview) -> DeckOperationCreate:
    return operation_payload(preview)


def _preview_read(preview: MoxfieldImportPreview) -> MoxfieldImportPreviewRead:
    return MoxfieldImportPreviewRead(
        cardsets=[_cardset_read(cardset) for cardset in preview.cardsets],
        errors=[
            MoxfieldImportIssueRead(
                line_number=error.line_number,
                raw_line=error.raw_line,
                code=error.code,
                message=error.message,
            )
            for error in preview.errors
        ],
        used_ai_fallback=preview.used_ai_fallback,
    )


def _cardset_read(cardset: ImportedCardSet) -> ImportedCardSetRead:
    return ImportedCardSetRead(
        quantity=cardset.quantity,
        printing_id=cardset.printing_id,
        oracle_id=cardset.oracle_id,
        card_name=cardset.card_name,
        set_code=cardset.set_code,
        collector_number=cardset.collector_number,
        finish=cardset.finish,
        zone=cardset.zone,
        tags=cardset.tags,
        source_lines=cardset.source_lines,
        selected_price_usd=cardset.selected_price_usd,
        printing_selection_reason=cardset.printing_selection_reason,
        scryfall=cardset.scryfall,
    )
