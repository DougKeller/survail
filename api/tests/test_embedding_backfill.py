import asyncio

import httpx
import pytest

from survail.core.schemas import CardFace, ScryfallCardSnapshot
from survail.core.types import json_object
from survail.embedding_backfill import (
    BACKFILL_MAX_ATTEMPTS,
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
            client = EmbeddingClient(
                "test-key",
                http_client=http_client,
                sleep=sleep,
                random_value=lambda: 0,
            )
            return await client.embed(["first", "second"])

    vectors = asyncio.run(run())

    assert attempts == 2
    assert delays == [0.5]
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


def test_embedding_client_uses_jittered_exponential_backoff_beyond_six_attempts() -> None:
    attempts = 0
    delays: list[float] = []

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts < 8:
            return httpx.Response(429, request=request)
        return httpx.Response(
            200,
            json={"data": [{"index": 0, "embedding": [1.0] * DIMENSIONS}]},
            request=request,
        )

    async def sleep(delay: float) -> None:
        delays.append(delay)

    async def run() -> list[list[float]]:
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http_client:
            client = EmbeddingClient(
                "test-key",
                http_client=http_client,
                max_attempts=8,
                sleep=sleep,
                random_value=lambda: 0,
            )
            return await client.embed(["first"])

    assert asyncio.run(run())[0][0] == 1.0
    assert attempts == 8
    assert delays == [0.5, 1.0, 2.0, 4.0, 8.0, 16.0, 30.0]


def test_embedding_client_honors_retry_after_headers() -> None:
    request = httpx.Request("POST", "https://example.test")
    seconds_response = httpx.Response(429, headers={"retry-after": "90"}, request=request)
    milliseconds_response = httpx.Response(
        429,
        headers={"retry-after-ms": "2500"},
        request=request,
    )

    with pytest.raises(httpx.HTTPStatusError) as seconds_error:
        seconds_response.raise_for_status()
    with pytest.raises(httpx.HTTPStatusError) as milliseconds_error:
        milliseconds_response.raise_for_status()

    assert EmbeddingClient._retry_delay(seconds_error.value, 0, 0) == 90
    assert EmbeddingClient._retry_delay(milliseconds_error.value, 0, 0) == 2.5


def test_sync_missing_embeddings_uses_extended_backfill_retry_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from survail import embedding_backfill
    from survail.core.config import Settings

    configured_attempts: list[int] = []

    class FakeClient:
        def __init__(self, api_key: str, *, max_attempts: int) -> None:
            assert api_key == "test-key"
            configured_attempts.append(max_attempts)

        async def close(self) -> None:
            return

    async def fake_backfill(client: FakeClient, *, batch_size: int, concurrency: int) -> int:
        return 0

    monkeypatch.setattr(
        embedding_backfill,
        "get_settings",
        lambda: Settings(openai_api_key="test-key"),
    )
    monkeypatch.setattr(embedding_backfill, "EmbeddingClient", FakeClient)
    monkeypatch.setattr(embedding_backfill, "backfill_embeddings", fake_backfill)

    assert sync_missing_embeddings() == 0
    assert configured_attempts == [BACKFILL_MAX_ATTEMPTS]


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
