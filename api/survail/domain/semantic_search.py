from collections.abc import Sequence
from dataclasses import dataclass

from pgvector.sqlalchemy import HALFVEC
from sqlalchemy import cast, select
from sqlalchemy.orm import Session

from survail.catalog import CatalogRepository
from survail.domain.printing_preferences import (
    catalog_printing_selection,
    preferred_printing,
)
from survail.embedding_backfill import MODEL, EmbeddingClient
from survail.models import OracleEmbedding
from survail.schemas import ImportPrintingPreference, ScryfallCardSnapshot


@dataclass(frozen=True)
class SemanticCardResult:
    card: ScryfallCardSnapshot
    similarity: float


async def semantic_search(
    db: Session,
    query: str,
    api_key: str,
    *,
    limit: int = 24,
    deck_format: str | None = None,
    color_identity: Sequence[str] | None = None,
    printing_preferences: list[ImportPrintingPreference] | None = None,
) -> list[SemanticCardResult]:
    client = EmbeddingClient(api_key)
    try:
        vectors = await client.embed([query])
    finally:
        await client.close()
    candidates = db.execute(
        select(
            OracleEmbedding.oracle_id,
            cast(OracleEmbedding.embedding, HALFVEC(3072))
            .cosine_distance(cast(vectors[0], HALFVEC(3072)))
            .label("distance"),
        )
        .where(OracleEmbedding.model == MODEL)
        .order_by("distance")
        .limit(max(limit * 20, 200))
    )
    catalog = CatalogRepository(db)
    allowed_colors = set(color_identity or [])
    identity_known = color_identity is not None
    results: list[SemanticCardResult] = []
    for oracle_id, distance in candidates:
        selections = [
            catalog_printing_selection(card)
            for card in catalog.printing_records_by_oracle(oracle_id)
        ]
        if not selections:
            continue
        selection, _ = preferred_printing(selections, printing_preferences or [])
        card = selection.card
        if deck_format is not None and card.legalities.get(deck_format) not in {
            "legal",
            "restricted",
        }:
            continue
        if identity_known and not set(card.color_identity).issubset(allowed_colors):
            continue
        results.append(SemanticCardResult(card=card, similarity=max(0.0, 1.0 - float(distance))))
        if len(results) == limit:
            break
    return results
