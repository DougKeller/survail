import logging
import sys
import tempfile
import time
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import httpx
import ijson
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from survail.db import SessionLocal
from survail.integrations.scryfall import ScryfallClient, UpstreamCard
from survail.models import CatalogCard, CatalogImport

logger = logging.getLogger(__name__)
_BULK_TYPE = "default_cards"
_BATCH_SIZE = 1_000
_PROGRESS_INTERVAL_SECONDS = 0.5


@dataclass
class DownloadProgress:
    total_bytes: int | None
    started_at: float
    last_reported_at: float
    downloaded_bytes: int = 0

    def add(self, byte_count: int, now: float) -> str | None:
        self.downloaded_bytes += byte_count
        if now - self.last_reported_at < _PROGRESS_INTERVAL_SECONDS:
            return None
        self.last_reported_at = now
        return self.message(now)

    def message(self, now: float) -> str:
        elapsed = max(now - self.started_at, 0.001)
        rate = self.downloaded_bytes / elapsed
        downloaded = _format_bytes(self.downloaded_bytes)
        if self.total_bytes is None or self.total_bytes <= 0:
            return f"Downloaded {downloaded} at {_format_bytes(rate)}/s"
        percent = min(self.downloaded_bytes / self.total_bytes * 100, 100)
        return (
            f"Downloaded {downloaded} / {_format_bytes(self.total_bytes)} "
            f"({percent:5.1f}%) at {_format_bytes(rate)}/s"
        )


@dataclass
class ImportProgress:
    started_at: float
    last_reported_at: float
    imported_cards: int = 0

    def add(self, card_count: int, now: float) -> str | None:
        self.imported_cards += card_count
        if now - self.last_reported_at < _PROGRESS_INTERVAL_SECONDS:
            return None
        self.last_reported_at = now
        return self.message(now)

    def message(self, now: float) -> str:
        elapsed = max(now - self.started_at, 0.001)
        return (
            f"Imported {self.imported_cards:,} cards at "
            f"{self.imported_cards / elapsed:,.0f} cards/s"
        )


def import_catalog(force: bool = False, *, sync_embeddings: bool = True) -> int:
    metadata_client = ScryfallClient()
    try:
        metadata = metadata_client.bulk_data(_BULK_TYPE)
    finally:
        metadata_client.close()

    with SessionLocal() as db:
        previous = db.get(CatalogImport, _BULK_TYPE)
        if not force and previous is not None and previous.source_updated_at >= metadata.updated_at:
            logger.info("Scryfall catalog is already current")
            if sync_embeddings:
                _sync_missing_embeddings()
            return previous.card_count

    with tempfile.NamedTemporaryFile(suffix=".json") as temporary:
        _download(metadata.download_uri, Path(temporary.name))
        with SessionLocal() as db:
            _write_progress("Preparing database catalog replacement...", complete=True)
            count = _replace_catalog(db, Path(temporary.name))
            _write_progress("Finalizing catalog transaction...", complete=True)
            db.merge(
                CatalogImport(
                    bulk_type=_BULK_TYPE,
                    source_updated_at=metadata.updated_at,
                    imported_at=datetime.now(UTC),
                    card_count=count,
                )
            )
            db.commit()
            _write_progress(f"Catalog transaction committed with {count:,} cards.", complete=True)
    logger.info("Imported %s Scryfall printings", count)
    if sync_embeddings:
        _sync_missing_embeddings()
    return count


def _sync_missing_embeddings() -> None:
    from survail.embedding_backfill import sync_missing_embeddings

    _write_progress("Checking for missing Oracle embeddings...", complete=True)
    embedded = sync_missing_embeddings()
    _write_progress(f"Embedding synchronization complete: {embedded:,} added.", complete=True)


def _download(url: str, destination: Path) -> None:
    logger.info("Downloading Scryfall bulk catalog")
    with httpx.stream("GET", url, timeout=120, follow_redirects=True) as response:
        response.raise_for_status()
        total_bytes = _content_length(response)
        started_at = time.monotonic()
        progress = DownloadProgress(
            total_bytes=total_bytes,
            started_at=started_at,
            last_reported_at=started_at,
        )
        with destination.open("wb") as output:
            for chunk in response.iter_bytes():
                output.write(chunk)
                message = progress.add(len(chunk), time.monotonic())
                if message is not None:
                    _write_progress(message)
        _write_progress(progress.message(time.monotonic()), complete=True)


def _content_length(response: httpx.Response) -> int | None:
    value = response.headers.get("Content-Length")
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _write_progress(message: str, *, complete: bool = False) -> None:
    ending = "\n" if complete else ""
    print(f"\r{message:<80}", end=ending, file=sys.stderr, flush=True)


def _format_bytes(byte_count: float) -> str:
    value = float(byte_count)
    for unit in ("B", "KiB", "MiB", "GiB", "TiB"):
        if value < 1024 or unit == "TiB":
            return f"{value:.1f} {unit}"
        value /= 1024
    raise AssertionError("unreachable")


def _replace_catalog(db: Session, path: Path) -> int:
    _write_progress("Clearing previous catalog rows...", complete=True)
    db.execute(text("TRUNCATE TABLE catalog_cards"))
    _write_progress("Previous catalog cleared; parsing and inserting cards...", complete=True)
    started_at = time.monotonic()
    progress = ImportProgress(started_at=started_at, last_reported_at=started_at)
    count = 0
    batch: list[dict[str, object]] = []
    for card in _cards(path):
        snapshot = card.snapshot()
        batch.append(
            {
                "id": card.id,
                "oracle_id": card.oracle_id,
                "name": card.name,
                "lang": card.lang,
                "layout": card.layout,
                "cmc": card.cmc,
                "type_line": card.type_line,
                "oracle_text": card.oracle_text,
                "colors": card.colors,
                "color_identity": card.color_identity,
                "keywords": card.keywords,
                "legalities": card.legalities,
                "set_code": card.set,
                "set_name": card.set_name,
                "collector_number": card.collector_number,
                "rarity": card.rarity,
                "finishes": card.finishes,
                "usd": card.prices.usd,
                "usd_foil": card.prices.usd_foil,
                "usd_etched": card.prices.usd_etched,
                "eur": card.prices.eur,
                "eur_foil": card.prices.eur_foil,
                "tix": card.prices.tix,
                "border_color": card.border_color,
                "frame": card.frame,
                "universes_beyond": "universesbeyond" in card.promo_types,
                "released_at": card.released_at,
                "snapshot": snapshot.model_dump(mode="json"),
            }
        )
        if len(batch) == _BATCH_SIZE:
            db.execute(insert(CatalogCard), batch)
            count += len(batch)
            message = progress.add(len(batch), time.monotonic())
            if message is not None:
                _write_progress(message)
            batch = []
    if batch:
        db.execute(insert(CatalogCard), batch)
        count += len(batch)
        progress.add(len(batch), time.monotonic())
    _write_progress(progress.message(time.monotonic()), complete=True)
    return count


def _cards(path: Path) -> Iterator[UpstreamCard]:
    with path.open("rb") as source:
        for raw_card in ijson.items(source, "item"):
            try:
                yield UpstreamCard.model_validate(raw_card)
            except ValidationError:
                logger.debug("Skipping unsupported bulk card record", exc_info=True)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Refresh the Scryfall Default Cards catalog")
    parser.add_argument(
        "--skip-embeddings",
        action="store_true",
        help="Refresh the catalog without filling missing Oracle embeddings",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    import_catalog(sync_embeddings=not args.skip_embeddings)
