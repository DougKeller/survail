import json
from decimal import Decimal
from pathlib import Path

import pytest

from survail.catalog_import import (
    _BULK_TYPE,
    DownloadProgress,
    ImportProgress,
    _cards,
    _format_bytes,
)
from survail.core.models import CatalogCard
from survail.integrations.scryfall.client import UpstreamCard
from survail.modules.cards.repository.cards import (
    CatalogQueryError,
    SearchTerm,
    _snapshot,
    parse_query,
)


def test_parse_query_supports_common_deckbuilder_filters() -> None:
    terms = parse_query('type:"legendary creature" identity:u legal:commander mv<=4 -oracle:draw')

    assert terms == [
        SearchTerm("type", ":", "legendary creature"),
        SearchTerm("identity", ":", "u"),
        SearchTerm("legal", ":", "commander"),
        SearchTerm("mv", "<=", "4"),
        SearchTerm("oracle", ":", "draw", negated=True),
    ]


def test_parse_query_rejects_unsupported_scryfall_operator() -> None:
    with pytest.raises(CatalogQueryError, match="Unsupported search operator"):
        parse_query("game:arena")


def test_bulk_parser_skips_records_without_required_deckbuilder_fields(tmp_path: Path) -> None:
    path = tmp_path / "cards.json"
    path.write_text(
        json.dumps(
            [
                {
                    "id": "printing",
                    "oracle_id": "oracle",
                    "name": "Sol Ring",
                    "layout": "normal",
                    "cmc": 1,
                    "type_line": "Artifact",
                    "legalities": {"commander": "legal"},
                    "set": "tst",
                    "set_name": "Test",
                    "collector_number": "1",
                    "rarity": "uncommon",
                    "scryfall_uri": "https://example.test/card",
                },
                {"id": "token-without-oracle-fields"},
            ]
        )
    )

    cards = list(_cards(path))

    assert [card.id for card in cards] == ["printing"]


def test_snapshot_exposes_strict_marketplace_and_visual_metadata() -> None:
    card = UpstreamCard.model_validate(
        {
            "id": "printing",
            "oracle_id": "oracle",
            "name": "Sol Ring",
            "layout": "normal",
            "cmc": 1,
            "type_line": "Artifact",
            "legalities": {"commander": "legal"},
            "set": "tst",
            "set_name": "Test",
            "collector_number": "1",
            "rarity": "uncommon",
            "scryfall_uri": "https://example.test/card",
            "promo_types": ["universesbeyond"],
            "prices": {"usd": "1.25"},
        }
    )

    snapshot = card.snapshot()

    assert snapshot.name == "Sol Ring"
    assert snapshot.prices.usd == 1.25
    assert snapshot.universes_beyond is True
    assert "promo_types" not in snapshot.model_dump()


def test_catalog_snapshot_accepts_json_serialized_decimal_prices() -> None:
    card = CatalogCard(
        id="printing",
        oracle_id="oracle",
        name="Sol Ring",
        lang="en",
        layout="normal",
        cmc=1,
        type_line="Artifact",
        oracle_text=None,
        colors=[],
        color_identity=[],
        keywords=[],
        legalities={},
        set_code="tst",
        set_name="Test",
        collector_number="1",
        rarity="uncommon",
        finishes=["nonfoil"],
        border_color="black",
        frame="2015",
        universes_beyond=False,
        usd=Decimal("0.35"),
        snapshot={
            "id": "printing",
            "oracle_id": "oracle",
            "name": "Sol Ring",
            "lang": "en",
            "layout": "normal",
            "cmc": 1,
            "type_line": "Artifact",
            "legalities": {},
            "set": "tst",
            "set_name": "Test",
            "collector_number": "1",
            "rarity": "uncommon",
            "prices": {"usd": "0.35"},
            "scryfall_uri": "https://example.test/card",
        },
    )

    assert _snapshot(card).prices.usd == Decimal("0.35")


def test_catalog_refresh_uses_default_cards_bulk_export() -> None:
    assert _BULK_TYPE == "default_cards"


def test_download_progress_reports_percentage_and_rate() -> None:
    progress = DownloadProgress(total_bytes=1_024, started_at=10, last_reported_at=10)

    message = progress.add(512, now=11)

    assert message == "Downloaded 512.0 B / 1.0 KiB ( 50.0%) at 512.0 B/s"


def test_download_progress_handles_unknown_total() -> None:
    progress = DownloadProgress(total_bytes=None, started_at=10, last_reported_at=10)

    message = progress.add(2_048, now=11)

    assert message == "Downloaded 2.0 KiB at 2.0 KiB/s"
    assert _format_bytes(1024**3) == "1.0 GiB"


def test_import_progress_reports_card_throughput() -> None:
    progress = ImportProgress(started_at=10, last_reported_at=10)

    message = progress.add(1_000, now=12)

    assert message == "Imported 1,000 cards at 500 cards/s"
