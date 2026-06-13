import argparse
import asyncio
import hashlib
import logging
import sys
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass

import httpx
from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from survail.core.config import get_settings
from survail.core.db import SessionLocal
from survail.core.models import CatalogCard, OracleEmbedding
from survail.core.schemas import ScryfallCardSnapshot
from survail.core.types import JsonObject, json_object

logger = logging.getLogger(__name__)
MODEL = "text-embedding-3-large"
DIMENSIONS = 3072
OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings"
TRANSIENT_STATUS_CODES = frozenset({408, 409, 429, 500, 502, 503, 504})
NON_PLAYABLE_LAYOUTS = frozenset(
    {
        "art_series",
        "double_faced_token",
        "emblem",
        "planar",
        "scheme",
        "token",
        "vanguard",
    }
)


@dataclass(frozen=True)
class EmbeddingSource:
    oracle_id: str
    text: str

    @property
    def source_hash(self) -> str:
        return hashlib.sha256(self.text.encode()).hexdigest()


class EmbeddingDatum(BaseModel):
    index: int
    embedding: list[float]


class EmbeddingResponse(BaseModel):
    data: list[EmbeddingDatum]


class EmbeddingClient:
    def __init__(
        self,
        api_key: str,
        *,
        http_client: httpx.AsyncClient | None = None,
        max_attempts: int = 6,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required")
        if max_attempts < 1:
            raise ValueError("max_attempts must be positive")
        self._api_key = api_key
        self._owns_http_client = http_client is None
        self._http_client = http_client or httpx.AsyncClient(timeout=60)
        self._max_attempts = max_attempts
        self._sleep = sleep

    async def close(self) -> None:
        if self._owns_http_client:
            await self._http_client.aclose()

    async def embed(self, inputs: Sequence[str]) -> list[list[float]]:
        if not inputs:
            return []
        payload: JsonObject = {
            "model": MODEL,
            "dimensions": DIMENSIONS,
            "input": list(inputs),
        }
        for attempt in range(self._max_attempts):
            try:
                response = await self._http_client.post(
                    OPENAI_EMBEDDINGS_URL,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json=payload,
                )
                if response.status_code in TRANSIENT_STATUS_CODES:
                    response.raise_for_status()
                response.raise_for_status()
                return self._parse_response(json_object(response.json()), len(inputs))
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as error:
                if attempt + 1 == self._max_attempts or not self._is_retryable(error):
                    raise
                delay = self._retry_delay(error, attempt)
                logger.warning("Embedding request failed; retrying in %.1f seconds", delay)
                await self._sleep(delay)
        raise RuntimeError("Embedding retry loop exited unexpectedly")

    @staticmethod
    def _parse_response(payload: JsonObject, expected_count: int) -> list[list[float]]:
        response = EmbeddingResponse.model_validate(payload)
        ordered = sorted(response.data, key=lambda item: item.index)
        if len(ordered) != expected_count or [item.index for item in ordered] != list(
            range(expected_count)
        ):
            raise ValueError("OpenAI returned an incomplete or invalid embedding batch")
        if any(len(item.embedding) != DIMENSIONS for item in ordered):
            raise ValueError(
                f"OpenAI returned an embedding with dimensions other than {DIMENSIONS}"
            )
        return [item.embedding for item in ordered]

    @staticmethod
    def _is_retryable(error: httpx.HTTPError) -> bool:
        return not isinstance(error, httpx.HTTPStatusError) or (
            error.response.status_code in TRANSIENT_STATUS_CODES
        )

    @staticmethod
    def _retry_delay(error: httpx.HTTPError, attempt: int) -> float:
        if isinstance(error, httpx.HTTPStatusError):
            retry_after = error.response.headers.get("retry-after")
            if retry_after is not None:
                try:
                    return min(float(retry_after), 60)
                except ValueError:
                    pass
        return float(min(2**attempt, 60))


def embedding_text(card: ScryfallCardSnapshot) -> str | None:
    if card.layout in NON_PLAYABLE_LAYOUTS:
        return None
    face_has_oracle_text = any(
        face.oracle_text and face.oracle_text.strip() for face in card.card_faces
    )
    if card.card_faces and face_has_oracle_text:
        face_blocks = [
            "\n".join(
                part
                for part in (face.name, face.type_line, (face.oracle_text or "").strip())
                if part
            )
            for face in card.card_faces
        ]
        return "\n\n".join(face_blocks)
    if card.oracle_text and card.oracle_text.strip():
        return f"{card.name}\n{card.type_line}\n{card.oracle_text.strip()}"
    return f"{card.name}\n{card.type_line}"


def _oracle_ids_query(after_oracle_id: str | None, limit: int) -> Select[tuple[str]]:
    query = (
        select(CatalogCard.oracle_id)
        .distinct(CatalogCard.oracle_id)
        .order_by(CatalogCard.oracle_id)
        .limit(limit)
    )
    if after_oracle_id is not None:
        query = query.where(CatalogCard.oracle_id > after_oracle_id)
    return query


def oracle_card_count(db: Session) -> int:
    count = db.scalar(
        select(func.count(func.distinct(CatalogCard.oracle_id))).select_from(CatalogCard)
    )
    return int(count or 0)


def richest_sources(rows: Sequence[tuple[str, JsonObject]]) -> list[EmbeddingSource]:
    richest_by_oracle_id: dict[str, EmbeddingSource] = {}
    for oracle_id, snapshot in rows:
        text = embedding_text(ScryfallCardSnapshot.model_validate(snapshot, strict=False))
        if text is None:
            continue
        candidate = EmbeddingSource(oracle_id=oracle_id, text=text)
        current = richest_by_oracle_id.get(oracle_id)
        if current is None or len(candidate.text) > len(current.text):
            richest_by_oracle_id[oracle_id] = candidate
    return list(richest_by_oracle_id.values())


def source_needs_embedding(source: EmbeddingSource, stored: tuple[str, str] | None) -> bool:
    return stored != (MODEL, source.source_hash)


def sources_needing_embedding(
    db: Session, after_oracle_id: str | None, limit: int
) -> tuple[list[EmbeddingSource], str | None, int]:
    oracle_ids = list(db.scalars(_oracle_ids_query(after_oracle_id, limit)))
    if not oracle_ids:
        return [], None, 0
    rows = db.execute(
        select(CatalogCard.oracle_id, CatalogCard.snapshot)
        .where(CatalogCard.oracle_id.in_(oracle_ids), CatalogCard.lang == "en")
        .order_by(CatalogCard.oracle_id, CatalogCard.id)
    ).all()
    sources = richest_sources([(oracle_id, snapshot) for oracle_id, snapshot in rows])
    stored = {
        oracle_id: (model, source_hash)
        for oracle_id, model, source_hash in db.execute(
            select(
                OracleEmbedding.oracle_id,
                OracleEmbedding.model,
                OracleEmbedding.source_hash,
            ).where(OracleEmbedding.oracle_id.in_(oracle_ids))
        )
    }
    candidates = [
        source for source in sources if source_needs_embedding(source, stored.get(source.oracle_id))
    ]
    return candidates, oracle_ids[-1], len(oracle_ids)


def persist_embeddings(
    db: Session, sources: Sequence[EmbeddingSource], vectors: Sequence[Sequence[float]]
) -> int:
    if len(sources) != len(vectors):
        raise ValueError("Embedding source and vector counts differ")
    rows = [
        {
            "oracle_id": source.oracle_id,
            "model": MODEL,
            "source_text": source.text,
            "source_hash": source.source_hash,
            "embedding": list(vector),
        }
        for source, vector in zip(sources, vectors, strict=True)
    ]
    if not rows:
        return 0
    statement = insert(OracleEmbedding)
    refreshed_ids = db.scalars(
        statement.values(rows)
        .on_conflict_do_update(
            index_elements=["oracle_id"],
            set_={
                "model": MODEL,
                "source_text": statement.excluded.source_text,
                "source_hash": statement.excluded.source_hash,
                "embedding": statement.excluded.embedding,
                "created_at": func.now(),
            },
        )
        .returning(OracleEmbedding.oracle_id)
    )
    db.commit()
    return len(refreshed_ids.all())


async def backfill_embeddings(
    client: EmbeddingClient,
    *,
    batch_size: int = 64,
    concurrency: int = 4,
) -> int:
    if batch_size < 1 or concurrency < 1:
        raise ValueError("batch_size and concurrency must be positive")
    refreshed = 0
    scanned = 0
    after_oracle_id: str | None = None
    page_size = batch_size * concurrency
    with SessionLocal() as db:
        total = oracle_card_count(db)
    _write_progress(f"Checking {total:,} Oracle cards for stale embeddings...", complete=True)
    if total == 0:
        return 0
    while True:
        with SessionLocal() as db:
            sources, page_last_oracle_id, page_scanned = sources_needing_embedding(
                db, after_oracle_id, page_size
            )
        if page_last_oracle_id is None:
            _write_progress(
                f"Embedding freshness complete: scanned {scanned:,}, refreshed {refreshed:,}.",
                complete=True,
            )
            return refreshed
        scanned += page_scanned
        if sources:
            batches = [
                sources[index : index + batch_size] for index in range(0, len(sources), batch_size)
            ]
            vectors_by_batch = await asyncio.gather(
                *(client.embed([source.text for source in batch]) for batch in batches)
            )
            with SessionLocal() as db:
                for batch, vectors in zip(batches, vectors_by_batch, strict=True):
                    refreshed += persist_embeddings(db, batch, vectors)
        after_oracle_id = page_last_oracle_id
        _write_progress(
            f"Scanned {scanned:,} / {total:,} Oracle cards "
            f"({min(scanned / total * 100, 100):5.1f}%); refreshed {refreshed:,}"
        )


def _write_progress(message: str, *, complete: bool = False) -> None:
    ending = "\n" if complete else ""
    print(f"\r{message:<80}", end=ending, file=sys.stderr, flush=True)


def sync_missing_embeddings(*, batch_size: int = 64, concurrency: int = 4) -> int:
    settings = get_settings()
    client = EmbeddingClient(settings.openai_api_key)

    async def run() -> int:
        try:
            return await backfill_embeddings(
                client,
                batch_size=batch_size,
                concurrency=concurrency,
            )
        finally:
            await client.close()

    return asyncio.run(run())


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill oracle card embeddings")
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--concurrency", type=int, default=4)
    args = parser.parse_args()
    inserted = sync_missing_embeddings(
        batch_size=args.batch_size,
        concurrency=args.concurrency,
    )
    logger.info("Backfill complete; stored %s new embeddings", inserted)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
