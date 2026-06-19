import uuid
from dataclasses import dataclass

from openai import OpenAIError
from sqlalchemy.orm import Session

from survail.core.config import get_settings
from survail.core.models import CatalogCard, Deck, DeckFormat, DeckOperation, User
from survail.core.schemas import (
    BrawlDeckMetadata,
    CommanderDeckMetadata,
    GenericDeckMetadata,
)
from survail.integrations.openai.imports import OpenAIDecklistExtractor
from survail.modules.cards.repository.cards import CatalogRepository
from survail.modules.cards.service.printings import PrintingSelection, catalog_printing_selection
from survail.modules.decks.operations.contracts import (
    DeckOperationChangeCreate,
    DeckOperationCreate,
)
from survail.modules.decks.operations.service.apply import DeckOperationError, apply_deck_operation
from survail.modules.decks.repository.decks import DeckRepository
from survail.modules.imports.api.schemas import MoxfieldDeckImportRequest, MoxfieldImportRequest
from survail.modules.imports.service.preview import (
    ExtractedImportCard,
    MoxfieldCatalog,
    MoxfieldImportPreview,
    import_extracted_decklist,
    import_moxfield_decklist,
)


class ImportValidationError(ValueError):
    def __init__(self, detail: object) -> None:
        super().__init__("Import validation failed")
        self.detail = detail


@dataclass(frozen=True)
class ImportedDeckResult:
    deck: Deck
    operation: DeckOperation
    preview: MoxfieldImportPreview


class ImportCatalog(MoxfieldCatalog):
    def __init__(self, db: Session) -> None:
        self._catalog = CatalogRepository(db)

    def printings(self, name: str) -> list[PrintingSelection]:
        return [self._selection(card) for card in self._catalog.printing_records_by_name(name)]

    def _selection(self, catalog_card: CatalogCard) -> PrintingSelection:
        return catalog_printing_selection(catalog_card)


class ImportService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._decks = DeckRepository(db)
        self._catalog = ImportCatalog(db)

    def preview(self, payload: MoxfieldImportRequest) -> MoxfieldImportPreview:
        preview = import_moxfield_decklist(
            payload.decklist,
            self._catalog,
            preserve_tags=payload.preserve_tags,
            printing_preferences=payload.printing_preferences,
            default_zone=payload.default_zone,
        )
        if not preview.errors:
            return preview
        settings = get_settings()
        if not settings.openai_api_key:
            return preview
        try:
            extracted = OpenAIDecklistExtractor(
                settings.openai_api_key, settings.openai_import_model
            ).extract(payload.decklist)
        except (OpenAIError, ValueError):
            return preview
        return import_extracted_decklist(
            [
                ExtractedImportCard(
                    name=card.name,
                    set_name=card.set_name,
                    quantity=card.quantity,
                    foil=card.finish == "foil",
                )
                for card in extracted.cards
            ],
            self._catalog,
            printing_preferences=payload.printing_preferences,
            default_zone=payload.default_zone,
        )

    def create_deck(self, user: User, payload: MoxfieldDeckImportRequest) -> ImportedDeckResult:
        preview = self.preview(payload)
        if preview.errors:
            raise ImportValidationError(preview)
        if not preview.cardsets:
            raise ImportValidationError("Import did not resolve any cards")
        deck = Deck(
            owner_id=user.id,
            title=payload.title,
            format=payload.format,
            description=payload.description,
            metadata_json=_initial_metadata(payload.format),
        )
        self._decks.add(deck)
        self._decks.flush()
        try:
            operation, imported_deck = apply_deck_operation(
                self._db, deck.id, user, operation_payload(preview)
            )
        except DeckOperationError:
            self._decks.rollback()
            raise
        return ImportedDeckResult(deck=imported_deck, operation=operation, preview=preview)


def operation_payload(preview: MoxfieldImportPreview) -> DeckOperationCreate:
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


def _initial_metadata(deck_format: DeckFormat) -> dict[str, str | list[str]]:
    if deck_format == DeckFormat.COMMANDER:
        return CommanderDeckMetadata().model_dump(mode="json")
    if deck_format == DeckFormat.BRAWL:
        return BrawlDeckMetadata(commander_oracle_id="").model_dump(mode="json")
    return GenericDeckMetadata().model_dump(mode="json")
