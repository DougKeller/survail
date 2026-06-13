import asyncio

import httpx
import pytest

from survail.core.schemas import CardFace, ScryfallCardSnapshot
from survail.core.types import json_object
from survail.embedding_backfill import (
    DIMENSIONS,
    MODEL,
    EmbeddingClient,
    EmbeddingSource,
    embedding_text,
    richest_sources,
    source_needs_embedding,
    sync_missing_embeddings,
)


def test_embedding_source_has_stable_payload_and_hash() -> None:
    source = EmbeddingSource(
        oracle_id="oracle-id",
        text="Sol Ring\nArtifact\n{T}: Add {C}{C}.",
    )

    assert source.text == "Sol Ring\nArtifact\n{T}: Add {C}{C}."
    assert len(source.source_hash) == 64


def test_embedding_freshness_requires_current_model_and_source_hash() -> None:
    source = EmbeddingSource(oracle_id="oracle-id", text="Current canonical text")

    assert source_needs_embedding(source, None)
    assert source_needs_embedding(source, ("older-model", source.source_hash))
    assert source_needs_embedding(source, (MODEL, "stale-hash"))
    assert not source_needs_embedding(source, (MODEL, source.source_hash))


def test_embedding_text_uses_face_oracle_text_when_top_level_is_null() -> None:
    card = ScryfallCardSnapshot(
        id="printing-id",
        oracle_id="oracle-id",
        name="Front // Back",
        lang="en",
        layout="transform",
        cmc=2,
        type_line="Creature // Land",
        oracle_text=None,
        legalities={},
        set="tst",
        set_name="Test",
        collector_number="1",
        rarity="rare",
        scryfall_uri="https://example.test/card",
        card_faces=[
            CardFace(
                name="Front",
                mana_cost="{1}{G}",
                type_line="Creature",
                oracle_text="Front rules.",
            ),
            CardFace(
                name="Back",
                mana_cost="",
                type_line="Land",
                oracle_text="Back rules.",
            ),
        ],
    )

    assert embedding_text(card) == "Front\nCreature\nFront rules.\n\nBack\nLand\nBack rules."


def test_richest_sources_chooses_most_complete_english_snapshot() -> None:
    short = _snapshot(oracle_text="Short.")
    rich = _snapshot(oracle_text="A substantially richer Oracle text payload.")

    sources = richest_sources(
        [
            ("oracle-id", json_object(short.model_dump(mode="json"))),
            ("oracle-id", json_object(rich.model_dump(mode="json"))),
        ]
    )

    assert sources == [
        EmbeddingSource(
            oracle_id="oracle-id",
            text="Test Card\nArtifact\nA substantially richer Oracle text payload.",
        )
    ]


def test_richest_sources_accepts_json_serialized_decimal_prices() -> None:
    snapshot = json_object(_snapshot(oracle_text="Rules text.").model_dump(mode="json"))
    snapshot["prices"] = {"usd": "0.26", "eur": "0.43", "tix": "0.76"}

    sources = richest_sources([("oracle-id", snapshot)])

    assert sources == [
        EmbeddingSource(oracle_id="oracle-id", text="Test Card\nArtifact\nRules text.")
    ]


def test_embedding_text_uses_name_and_type_for_playable_blank_text_card() -> None:
    assert embedding_text(_snapshot(oracle_text="")) == "Test Card\nArtifact"


def test_embedding_text_excludes_non_playable_objects() -> None:
    assert embedding_text(_snapshot(oracle_text="", layout="token")) is None
    assert embedding_text(_snapshot(oracle_text="", layout="art_series")) is None


def _snapshot(*, oracle_text: str, layout: str = "normal") -> ScryfallCardSnapshot:
    return ScryfallCardSnapshot(
        id="printing-id",
        oracle_id="oracle-id",
        name="Test Card",
        lang="en",
        layout=layout,
        cmc=2,
        type_line="Artifact",
        oracle_text=oracle_text,
        legalities={},
        set="tst",
        set_name="Test",
        collector_number="1",
        rarity="rare",
        scryfall_uri="https://example.test/card",
    )


def test_embedding_client_retries_transient_response_and_preserves_order() -> None:
    attempts = 0
    delays: list[float] = []

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return httpx.Response(429, headers={"retry-after": "0"}, request=request)
        return httpx.Response(
            200,
            json={
                "data": [
                    {"index": 1, "embedding": [2.0] * DIMENSIONS},
                    {"index": 0, "embedding": [1.0] * DIMENSIONS},
                ]
            },
            request=request,
        )

    async def sleep(delay: float) -> None:
        delays.append(delay)

    async def run() -> list[list[float]]:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
            client = EmbeddingClient("test-key", http_client=http_client, sleep=sleep)
            return await client.embed(["first", "second"])

    vectors = asyncio.run(run())

    assert attempts == 2
    assert delays == [0]
    assert vectors[0][0] == 1.0
    assert vectors[1][0] == 2.0


def test_embedding_client_does_not_retry_non_transient_response() -> None:
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(400, request=request)

    async def run() -> None:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
            client = EmbeddingClient("test-key", http_client=http_client)
            with pytest.raises(httpx.HTTPStatusError):
                await client.embed(["invalid"])

    asyncio.run(run())
    assert attempts == 1


def test_sync_missing_embeddings_requires_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    from survail import embedding_backfill
    from survail.core.config import Settings

    monkeypatch.setattr(
        embedding_backfill,
        "get_settings",
        lambda: Settings(openai_api_key=""),
    )

    with pytest.raises(ValueError, match="OPENAI_API_KEY is required"):
        sync_missing_embeddings()
