import re
from dataclasses import dataclass
from decimal import Decimal
from typing import Literal, Protocol

from survail.domain.printing_preferences import PrintingSelection, preferred_printing
from survail.models import CardFinish, CardZone
from survail.schemas import ImportPrintingPreference, ScryfallCardSnapshot

_LINE = re.compile(
    r"^(?P<quantity>[1-9]\d*)\s+"
    r"(?P<name>.+?)\s+"
    r"\((?P<set_code>[A-Za-z0-9]+)\)\s+"
    r"(?P<collector_number>\S+?)"
    r"(?P<foil>\s+\*F\*)?"
    r"(?P<tags>(?:\s+#!?.*)?)$"
)
_NAME_ONLY_LINE = re.compile(
    r"^(?P<quantity>[1-9]\d*)\s+"
    r"(?P<name>.+?)"
    r"(?P<tags>(?:\s+#!?.*)?)$"
)
_TAG = re.compile(r"#!?\s*(.*?)(?=\s+#!?|$)")
_SECTION_ZONES: dict[str, CardZone] = {
    "deck": CardZone.MAINBOARD,
    "main": CardZone.MAINBOARD,
    "mainboard": CardZone.MAINBOARD,
    "commander": CardZone.COMMANDER,
    "commanders": CardZone.COMMANDER,
    "sideboard": CardZone.SIDEBOARD,
    "considering": CardZone.CONSIDERING,
    "companion": CardZone.COMPANION,
}
PrintingSelectionReason = Literal["ranked_preferences"]


class MoxfieldCatalog(Protocol):
    def printings(self, name: str) -> list["PrintingSelection"]: ...


@dataclass(frozen=True)
class ParsedMoxfieldCard:
    line_number: int
    raw_line: str
    quantity: int
    name: str
    set_code: str | None
    collector_number: str | None
    foil: bool
    tags: tuple[str, ...]
    zone: CardZone


@dataclass(frozen=True)
class MoxfieldImportIssue:
    line_number: int
    raw_line: str
    code: str
    message: str


@dataclass(frozen=True)
class ImportedCardSet:
    quantity: int
    printing_id: str
    oracle_id: str
    card_name: str
    set_code: str
    collector_number: str
    finish: CardFinish
    zone: CardZone
    tags: tuple[str, ...]
    source_lines: tuple[int, ...]
    selected_price_usd: Decimal | None
    printing_selection_reason: PrintingSelectionReason
    scryfall: ScryfallCardSnapshot


@dataclass(frozen=True)
class MoxfieldImportPreview:
    cardsets: tuple[ImportedCardSet, ...]
    errors: tuple[MoxfieldImportIssue, ...]


def import_moxfield_decklist(
    decklist: str,
    catalog: MoxfieldCatalog,
    *,
    preserve_tags: bool = False,
    printing_preferences: list[ImportPrintingPreference] | None = None,
    default_zone: CardZone = CardZone.MAINBOARD,
) -> MoxfieldImportPreview:
    parsed, errors = _parse_lines(decklist, default_zone)
    resolved: list[ImportedCardSet] = []
    for card in parsed:
        imported, issue = _resolve_card(
            card,
            catalog,
            preserve_tags=preserve_tags,
            printing_preferences=printing_preferences or [],
        )
        if issue is not None:
            errors.append(issue)
        elif imported is not None:
            resolved.append(imported)
    return MoxfieldImportPreview(
        cardsets=tuple(_aggregate_cardsets(resolved)),
        errors=tuple(errors),
    )


def _parse_lines(
    decklist: str, default_zone: CardZone
) -> tuple[list[ParsedMoxfieldCard], list[MoxfieldImportIssue]]:
    cards: list[ParsedMoxfieldCard] = []
    errors: list[MoxfieldImportIssue] = []
    zone = default_zone
    for line_number, raw_line in enumerate(decklist.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        section_zone = _section_zone(line)
        if section_zone is not None:
            zone = section_zone
            continue
        match = _LINE.fullmatch(line) or _NAME_ONLY_LINE.fullmatch(line)
        if match is None:
            errors.append(
                MoxfieldImportIssue(
                    line_number=line_number,
                    raw_line=raw_line,
                    code="invalid_line",
                    message="Line is not a valid Moxfield card entry or supported section header",
                )
            )
            continue
        cards.append(
            ParsedMoxfieldCard(
                line_number=line_number,
                raw_line=raw_line,
                quantity=int(match.group("quantity")),
                name=match.group("name").strip(),
                set_code=_optional_group(match, "set_code", lower=True),
                collector_number=_optional_group(match, "collector_number"),
                foil=_optional_group(match, "foil") is not None,
                tags=tuple(tag.strip() for tag in _TAG.findall(match.group("tags"))),
                zone=zone,
            )
        )
    if not cards and not errors:
        errors.append(
            MoxfieldImportIssue(
                line_number=0,
                raw_line="",
                code="empty_decklist",
                message="Decklist does not contain any cards",
            )
        )
    return cards, errors


def _resolve_card(
    card: ParsedMoxfieldCard,
    catalog: MoxfieldCatalog,
    *,
    preserve_tags: bool,
    printing_preferences: list[ImportPrintingPreference],
) -> tuple[ImportedCardSet | None, MoxfieldImportIssue | None]:
    selections = catalog.printings(card.name)
    if not selections:
        return None, _issue(card, "unresolved_card", f"Could not resolve {card.name}")
    selection, finish = preferred_printing(selections, printing_preferences)
    printing = selection.card
    return (
        ImportedCardSet(
            quantity=card.quantity,
            printing_id=printing.id,
            oracle_id=printing.oracle_id,
            card_name=printing.name,
            set_code=printing.set,
            collector_number=printing.collector_number,
            finish=finish,
            zone=card.zone,
            tags=card.tags if preserve_tags else (),
            source_lines=(card.line_number,),
            selected_price_usd=selection.price_for(finish),
            printing_selection_reason="ranked_preferences",
            scryfall=printing,
        ),
        None,
    )


def _aggregate_cardsets(cardsets: list[ImportedCardSet]) -> list[ImportedCardSet]:
    aggregated: dict[tuple[str, CardFinish, CardZone], ImportedCardSet] = {}
    for cardset in cardsets:
        identity = (cardset.printing_id, cardset.finish, cardset.zone)
        existing = aggregated.get(identity)
        if existing is None:
            aggregated[identity] = cardset
            continue
        aggregated[identity] = ImportedCardSet(
            quantity=existing.quantity + cardset.quantity,
            printing_id=existing.printing_id,
            oracle_id=existing.oracle_id,
            card_name=existing.card_name,
            set_code=existing.set_code,
            collector_number=existing.collector_number,
            finish=existing.finish,
            zone=existing.zone,
            tags=tuple(dict.fromkeys((*existing.tags, *cardset.tags))),
            source_lines=(*existing.source_lines, *cardset.source_lines),
            selected_price_usd=existing.selected_price_usd,
            printing_selection_reason=existing.printing_selection_reason,
            scryfall=existing.scryfall,
        )
    return list(aggregated.values())


def _section_zone(line: str) -> CardZone | None:
    return _SECTION_ZONES.get(line.removesuffix(":").strip().casefold())


def _optional_group(match: re.Match[str], name: str, *, lower: bool = False) -> str | None:
    value = match.groupdict().get(name)
    return value.lower() if value is not None and lower else value


def _issue(card: ParsedMoxfieldCard, code: str, message: str) -> MoxfieldImportIssue:
    return MoxfieldImportIssue(card.line_number, card.raw_line, code, message)


def _normalized_name(name: str) -> str:
    return name.casefold().replace(" // ", " / ")
