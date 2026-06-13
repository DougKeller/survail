from dataclasses import dataclass
from decimal import Decimal

from survail.core.models import CardFinish, CatalogCard
from survail.core.schemas import ImportPrintingPreference, ScryfallCardSnapshot


@dataclass(frozen=True)
class PrintingSelection:
    card: ScryfallCardSnapshot
    price_usd: Decimal | None
    foil_price_usd: Decimal | None = None
    etched_price_usd: Decimal | None = None
    universes_beyond: bool = False
    frame: str = "2015"
    released_at: str | None = None

    def price_for(self, finish: CardFinish) -> Decimal | None:
        if finish == CardFinish.FOIL:
            return self.foil_price_usd
        if finish == CardFinish.ETCHED:
            return self.etched_price_usd
        return self.price_usd


PrintingCandidate = tuple[PrintingSelection, CardFinish]


def catalog_printing_selection(card: CatalogCard) -> PrintingSelection:
    return PrintingSelection(
        card=ScryfallCardSnapshot.model_validate(card.snapshot, strict=False),
        price_usd=card.usd,
        foil_price_usd=card.usd_foil,
        etched_price_usd=card.usd_etched,
        universes_beyond=card.universes_beyond,
        frame=card.frame,
        released_at=card.released_at,
    )


def snapshot_printing_selection(card: ScryfallCardSnapshot) -> PrintingSelection:
    return PrintingSelection(
        card=card,
        price_usd=card.prices.usd,
        foil_price_usd=card.prices.usd_foil,
        etched_price_usd=card.prices.usd_etched,
        universes_beyond=card.universes_beyond,
        frame=card.frame,
        released_at=card.released_at,
    )


def preferred_printing(
    selections: list[PrintingSelection],
    preferences: list[ImportPrintingPreference],
) -> PrintingCandidate:
    candidates = [
        (selection, CardFinish(finish))
        for selection in selections
        for finish in selection.card.finishes
        if finish in {item.value for item in CardFinish}
    ]
    if not candidates:
        raise ValueError("Printing selections do not contain a supported finish")
    for preference in preferences:
        candidates = _apply_preference(candidates, preference)
    return min(
        candidates,
        key=lambda candidate: (
            _reverse_date(candidate[0].released_at or ""),
            candidate[0].card.id,
            candidate[1].value,
        ),
    )


def _apply_preference(
    candidates: list[PrintingCandidate], preference: ImportPrintingPreference
) -> list[PrintingCandidate]:
    preferred: list[PrintingCandidate]
    if preference.kind == "non_universes_beyond":
        preferred = [candidate for candidate in candidates if not candidate[0].universes_beyond]
    elif preference.kind == "original_printing":
        dated = [candidate for candidate in candidates if candidate[0].released_at is not None]
        if not dated:
            return candidates
        earliest = min(candidate[0].released_at or "" for candidate in dated)
        preferred = [candidate for candidate in dated if candidate[0].released_at == earliest]
    elif preference.kind == "frame":
        preferred = [
            candidate for candidate in candidates if candidate[0].frame == preference.frame.value
        ]
    elif preference.kind == "foil":
        preferred = [candidate for candidate in candidates if candidate[1] == CardFinish.FOIL]
    elif preference.kind == "nonfoil":
        preferred = [candidate for candidate in candidates if candidate[1] == CardFinish.NONFOIL]
    else:
        priced = [
            candidate
            for candidate in candidates
            if candidate[0].price_for(candidate[1]) is not None
        ]
        if not priced:
            return candidates
        cheapest = min(candidate[0].price_for(candidate[1]) or Decimal(0) for candidate in priced)
        ceiling = cheapest * (Decimal(100 + preference.buffer_percent) / Decimal(100))
        preferred = [
            candidate
            for candidate in priced
            if (candidate[0].price_for(candidate[1]) or Decimal(0)) <= ceiling
        ]
    return preferred or candidates


def _reverse_date(value: str) -> str:
    return "".join(chr(255 - ord(character)) for character in value)
