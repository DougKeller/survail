from dataclasses import dataclass
from decimal import Decimal

from survail.domain.moxfield_import import import_moxfield_decklist
from survail.domain.printing_preferences import PrintingSelection
from survail.models import CardFinish, CardFrame, CardZone
from survail.routes.imports import _operation_payload
from survail.schemas import (
    CheapestPreference,
    FoilPreference,
    FramePreference,
    NonfoilPreference,
    NonUniversesBeyondPreference,
    OriginalPrintingPreference,
    ScryfallCardSnapshot,
)


def snapshot(
    name: str,
    printing_id: str,
    set_code: str,
    collector_number: str,
    *,
    finishes: list[str] | None = None,
) -> ScryfallCardSnapshot:
    return ScryfallCardSnapshot(
        id=printing_id,
        oracle_id=f"oracle-{name}",
        name=name,
        lang="en",
        layout="normal",
        cmc=1,
        type_line="Instant",
        colors=[],
        color_identity=[],
        legalities={"commander": "legal"},
        set=set_code,
        set_name="Test",
        collector_number=collector_number,
        rarity="rare",
        finishes=finishes or ["nonfoil"],
        scryfall_uri="https://example.test/card",
    )


def selection(
    name: str,
    printing_id: str,
    set_code: str,
    collector_number: str,
    *,
    price: str = "1.25",
    finishes: list[str] | None = None,
    universes_beyond: bool = False,
    frame: str = "2015",
    released_at: str | None = None,
) -> PrintingSelection:
    return PrintingSelection(
        card=snapshot(name, printing_id, set_code, collector_number, finishes=finishes),
        price_usd=Decimal(price),
        universes_beyond=universes_beyond,
        frame=frame,
        released_at=released_at,
    )


@dataclass
class FakeCatalog:
    cards: dict[str, list[PrintingSelection]]

    def printings(self, name: str) -> list[PrintingSelection]:
        return self.cards.get(name, [])


def test_preview_returns_resolved_cards_and_per_line_errors() -> None:
    signet = selection("Arcane Signet", "signet", "ecc", "55", price="0.42")
    catalog = FakeCatalog(cards={"Arcane Signet": [signet]})

    preview = import_moxfield_decklist(
        "\n".join(
            [
                "1 Arcane Signet (ECC) 55 #!1 - Ramp",
                "this is not a card line",
                "1 The Reaper, King No More (ECC) 4",
            ]
        ),
        catalog,
    )

    assert len(preview.cardsets) == 1
    assert preview.cardsets[0].printing_id == "signet"
    assert preview.cardsets[0].selected_price_usd == Decimal("0.42")
    assert preview.cardsets[0].printing_selection_reason == "ranked_preferences"
    assert preview.cardsets[0].tags == ()
    assert _operation_payload(preview).changes[0].tags == []
    assert [error.code for error in preview.errors] == ["invalid_line", "unresolved_card"]
    assert [error.line_number for error in preview.errors] == [2, 3]


def test_name_only_entry_resolves_through_ranked_printing_preferences() -> None:
    auntie = selection("Auntie Ool, Cursewretch", "auntie", "ecl", "1")

    preview = import_moxfield_decklist(
        "1 Auntie Ool, Cursewretch",
        FakeCatalog(cards={"Auntie Ool, Cursewretch": [auntie]}),
    )

    assert not preview.errors
    assert preview.cardsets[0].printing_id == "auntie"
    assert preview.cardsets[0].quantity == 1


def test_name_only_entry_supports_tags() -> None:
    auntie = selection("Auntie Ool, Cursewretch", "auntie", "ecl", "1")

    preview = import_moxfield_decklist(
        "1 Auntie Ool, Cursewretch #!Commander",
        FakeCatalog(cards={"Auntie Ool, Cursewretch": [auntie]}),
        preserve_tags=True,
    )

    assert preview.cardsets[0].tags == ("Commander",)


def test_supplied_export_syntax_supports_slash_names_promos_foil_and_tags() -> None:
    promenade = selection(
        "Bountiful Promenade",
        "promenade",
        "pclb",
        "348s",
        finishes=["nonfoil", "foil"],
    )
    cards = {
        "Bloomvine Regent / Claim Territory": selection(
            "Bloomvine Regent // Claim Territory", "bloomvine", "ptdm", "136p"
        ),
        "Beast Within": selection("Beast Within", "beast", "plst", "BBD-190"),
        "Aerial Extortionist": selection("Aerial Extortionist", "aerial", "ncc", "11"),
    }
    catalog = FakeCatalog(
        cards={name: [card] for name, card in cards.items()} | {"Bountiful Promenade": [promenade]}
    )

    preview = import_moxfield_decklist(
        "\n".join(
            [
                "1 Bloomvine Regent / Claim Territory (PTDM) 136p",
                "1 Beast Within (PLST) BBD-190",
                "1 Aerial Extortionist (NCC) 11 #!2 - Card Draw (Conditional) "
                "#!3 - Removal #!Theme - Taxes",
                "1 Bountiful Promenade (PCLB) 348s *F* #!5 - Land",
            ]
        ),
        catalog,
        preserve_tags=True,
        printing_preferences=[FoilPreference(kind="foil")],
    )

    assert not preview.errors
    assert preview.cardsets[2].tags == (
        "2 - Card Draw (Conditional)",
        "3 - Removal",
        "Theme - Taxes",
    )
    assert preview.cardsets[3].finish == CardFinish.FOIL
    assert preview.cardsets[3].printing_selection_reason == "ranked_preferences"


def test_duplicate_resolved_cardsets_aggregate_with_source_lines_and_tags() -> None:
    ring = selection("Sol Ring", "ring", "fic", "359")
    catalog = FakeCatalog(cards={"Sol Ring": [ring]})

    preview = import_moxfield_decklist(
        "1 Sol Ring (FIC) 359 #!1 - Ramp\n2 Sol Ring (C20) 252 #!Artifact",
        catalog,
        preserve_tags=True,
    )

    assert len(preview.cardsets) == 1
    assert preview.cardsets[0].quantity == 3
    assert preview.cardsets[0].source_lines == (1, 2)
    assert preview.cardsets[0].tags == ("1 - Ramp", "Artifact")

    operation = _operation_payload(preview)
    assert operation.changes[0].tags == ["1 - Ramp", "Artifact"]


def test_sections_and_default_zone_form_a_clean_zone_override_contract() -> None:
    commander = selection("Ureni, the Song Unending", "ureni", "tdm", "233")
    card = selection("Arcane Signet", "signet", "khc", "96")
    catalog = FakeCatalog(cards={"Ureni, the Song Unending": [commander], "Arcane Signet": [card]})

    preview = import_moxfield_decklist(
        "\n".join(
            [
                "Commander",
                "1 Ureni, the Song Unending (TDM) 233",
                "Sideboard:",
                "1 Arcane Signet (KHC) 96",
                "Considering",
                "1 Arcane Signet (KHC) 96",
            ]
        ),
        catalog,
        default_zone=CardZone.COMPANION,
    )

    assert [cardset.zone for cardset in preview.cardsets] == [
        CardZone.COMMANDER,
        CardZone.SIDEBOARD,
        CardZone.CONSIDERING,
    ]

    no_sections = import_moxfield_decklist(
        "1 Arcane Signet (KHC) 96",
        catalog,
        default_zone=CardZone.COMPANION,
    )
    assert no_sections.cardsets[0].zone == CardZone.COMPANION


def test_preferences_are_soft_and_fall_back_to_available_printing_and_finish() -> None:
    universes_beyond_foil = PrintingSelection(
        card=snapshot(
            "Galadriel's Dismissal",
            "galadriel",
            "ltc",
            "500",
            finishes=["foil"],
        ),
        price_usd=None,
        foil_price_usd=Decimal("4.00"),
        universes_beyond=True,
    )
    preview = import_moxfield_decklist(
        "1 Galadriel's Dismissal (LTC) 500",
        FakeCatalog(cards={"Galadriel's Dismissal": [universes_beyond_foil]}),
        printing_preferences=[
            NonUniversesBeyondPreference(kind="non_universes_beyond"),
            NonfoilPreference(kind="nonfoil"),
        ],
    )

    assert not preview.errors
    assert preview.cardsets[0].printing_id == "galadriel"
    assert preview.cardsets[0].finish == CardFinish.FOIL


def test_ranked_preferences_choose_non_ub_then_frame_then_cheapest() -> None:
    cards = [
        selection(
            "Sol Ring",
            "ub-cheap",
            "who",
            "1",
            price="0.01",
            universes_beyond=True,
            frame="2015",
        ),
        selection("Sol Ring", "classic", "lea", "1", price="100", frame="1993"),
        selection("Sol Ring", "current", "cmm", "1", price="1", frame="2015"),
    ]

    preview = import_moxfield_decklist(
        "1 Sol Ring (CMM) 1",
        FakeCatalog(cards={"Sol Ring": cards}),
        printing_preferences=[
            NonUniversesBeyondPreference(kind="non_universes_beyond"),
            FramePreference(kind="frame", frame=CardFrame.CURRENT),
            CheapestPreference(kind="cheapest"),
        ],
    )

    assert preview.cardsets[0].printing_id == "current"


def test_cheapest_preference_can_select_cheapest_finish() -> None:
    card = PrintingSelection(
        card=snapshot("Sol Ring", "ring", "cmm", "1", finishes=["nonfoil", "foil"]),
        price_usd=Decimal("10"),
        foil_price_usd=Decimal("2"),
    )

    preview = import_moxfield_decklist(
        "1 Sol Ring (CMM) 1",
        FakeCatalog(cards={"Sol Ring": [card]}),
        printing_preferences=[CheapestPreference(kind="cheapest")],
    )

    assert preview.cardsets[0].finish == CardFinish.FOIL


def test_cheapest_buffer_allows_secondary_original_priority() -> None:
    cards = [
        selection("Sol Ring", "original", "lea", "1", price="10.50", released_at="1993-08-05"),
        selection("Sol Ring", "cheapest", "cmm", "1", price="10.00", released_at="2023-08-04"),
    ]

    buffered = import_moxfield_decklist(
        "1 Sol Ring",
        FakeCatalog(cards={"Sol Ring": cards}),
        printing_preferences=[
            CheapestPreference(kind="cheapest", buffer_percent=15),
            OriginalPrintingPreference(kind="original_printing"),
        ],
    )
    strict = import_moxfield_decklist(
        "1 Sol Ring",
        FakeCatalog(cards={"Sol Ring": cards}),
        printing_preferences=[
            CheapestPreference(kind="cheapest", buffer_percent=0),
            OriginalPrintingPreference(kind="original_printing"),
        ],
    )

    assert buffered.cardsets[0].printing_id == "original"
    assert strict.cardsets[0].printing_id == "cheapest"


def test_empty_decklist_returns_structured_error() -> None:
    preview = import_moxfield_decklist("\n\n", FakeCatalog(cards={}))

    assert not preview.cardsets
    assert preview.errors[0].code == "empty_decklist"
    assert preview.errors[0].line_number == 0
