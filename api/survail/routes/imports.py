import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from survail.catalog import CatalogRepository
from survail.dependencies import CurrentUser, DbSession
from survail.domain.deck_operations import DeckOperationError, apply_deck_operation
from survail.domain.moxfield_import import (
    ImportedCardSet,
    MoxfieldCatalog,
    MoxfieldImportPreview,
    import_moxfield_decklist,
)
from survail.domain.printing_preferences import PrintingSelection, catalog_printing_selection
from survail.models import CatalogCard, Deck, DeckFormat
from survail.schemas import (
    BrawlDeckMetadata,
    CommanderDeckMetadata,
    DeckOperationChangeCreate,
    DeckOperationCreate,
    GenericDeckMetadata,
    ImportedCardSetRead,
    MoxfieldDeckImportRead,
    MoxfieldDeckImportRequest,
    MoxfieldImportIssueRead,
    MoxfieldImportPreviewRead,
    MoxfieldImportRequest,
)

router = APIRouter(prefix="/imports", tags=["imports"])


class ImportCatalog(MoxfieldCatalog):
    def __init__(self, db: Session) -> None:
        self._db = db
        self._catalog = CatalogRepository(db)

    def printings(self, name: str) -> list[PrintingSelection]:
        return [self._selection(card) for card in self._catalog.printing_records_by_name(name)]

    def _selection(self, catalog_card: CatalogCard) -> PrintingSelection:
        return catalog_printing_selection(catalog_card)


@router.post("/moxfield", response_model=MoxfieldImportPreviewRead)
def import_moxfield(
    payload: MoxfieldImportRequest,
    db: DbSession,
    _: CurrentUser,
) -> MoxfieldImportPreviewRead:
    return _preview_read(_preview(payload, db))


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
    preview = _preview(payload, db)
    preview_read = _preview_read(preview)
    if preview.errors:
        raise HTTPException(status_code=422, detail=preview_read.model_dump(mode="json"))
    if not preview.cardsets:
        raise HTTPException(status_code=422, detail="Import did not resolve any cards")

    deck = Deck(
        owner_id=user.id,
        title=payload.title,
        format=payload.format,
        description=payload.description,
        metadata_json=_initial_metadata(payload.format),
    )
    db.add(deck)
    db.flush()
    operation_payload = _operation_payload(preview)
    try:
        operation, imported_deck = apply_deck_operation(db, deck.id, user, operation_payload)
    except DeckOperationError as exc:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return MoxfieldDeckImportRead(
        deck_id=imported_deck.id,
        operation_id=operation.id,
        revision=imported_deck.revision,
        preview=preview_read,
    )


def _operation_payload(preview: MoxfieldImportPreview) -> DeckOperationCreate:
    return DeckOperationCreate(
        client_operation_id=uuid.uuid4(),
        reason="Moxfield decklist import",
        changes=[
            DeckOperationChangeCreate(
                printing_id=cardset.printing_id,
                quantity_delta=cardset.quantity,
                zone=cardset.zone,
                finish=cardset.finish,
                tags=list(cardset.tags),
            )
            for cardset in preview.cardsets
        ],
    )


def _preview(payload: MoxfieldImportRequest, db: Session) -> MoxfieldImportPreview:
    return import_moxfield_decklist(
        payload.decklist,
        ImportCatalog(db),
        preserve_tags=payload.preserve_tags,
        printing_preferences=payload.printing_preferences,
        default_zone=payload.default_zone,
    )


def _initial_metadata(deck_format: DeckFormat) -> dict[str, str | list[str]]:
    if deck_format == DeckFormat.COMMANDER:
        return CommanderDeckMetadata().model_dump(mode="json")
    if deck_format == DeckFormat.BRAWL:
        return BrawlDeckMetadata(commander_oracle_id="").model_dump(mode="json")
    return GenericDeckMetadata().model_dump(mode="json")


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
