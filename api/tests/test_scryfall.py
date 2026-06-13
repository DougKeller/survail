import httpx
import pytest

from survail.integrations.scryfall import ScryfallClient, ScryfallNotFoundError, UpstreamCard
from survail.types import JsonObject


def card_payload(printing_id: str = "printing") -> JsonObject:
    return {
        "id": printing_id,
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
        "finishes": ["nonfoil"],
        "scryfall_uri": "https://example.test/card",
    }


class FakeLimiter:
    def __init__(self) -> None:
        self.acquisitions = 0
        self.cooldowns: list[float] = []

    def acquire(self) -> float:
        self.acquisitions += 1
        return 0

    def cooldown(self, seconds: float) -> None:
        self.cooldowns.append(seconds)


class FakeCache:
    def __init__(self) -> None:
        self.values: dict[str, JsonObject] = {}

    def get(self, key: str) -> JsonObject | None:
        return self.values.get(key)

    def set(self, key: str, value: JsonObject, ttl_seconds: int) -> None:
        assert ttl_seconds >= 60
        self.values[key] = value


def test_upstream_card_discards_unknown_fields_and_creates_strict_snapshot() -> None:
    card = UpstreamCard.model_validate({**card_payload(), "new_upstream_field": "ignored"})

    snapshot = card.snapshot()

    assert snapshot.id == "printing"
    assert snapshot.oracle_id == "oracle"


def test_rate_limit_response_sets_shared_cooldown_without_retry() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            429,
            headers={"Retry-After": "12"},
            json={"details": "slow down"},
            request=request,
        )

    limiter = FakeLimiter()
    client = ScryfallClient(
        client=httpx.Client(
            base_url="https://example.test", transport=httpx.MockTransport(handler)
        ),
        limiter=limiter,
    )

    with pytest.raises(RuntimeError, match="retry after 12 seconds"):
        client.bulk_data("default_cards")

    assert limiter.acquisitions == 1
    assert limiter.cooldowns == [12]


def test_bulk_data_selects_requested_type_from_listing() -> None:
    requested_paths: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requested_paths.append(request.url.path)
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "type": "oracle_cards",
                        "updated_at": "2026-06-09T12:00:00Z",
                        "download_uri": "https://data.scryfall.io/oracle-cards.json",
                    },
                    {
                        "type": "default_cards",
                        "updated_at": "2026-06-09T12:00:00Z",
                        "download_uri": "https://data.scryfall.io/default-cards.json",
                    },
                ]
            },
            request=request,
        )

    client = ScryfallClient(
        client=httpx.Client(
            base_url="https://api.scryfall.com",
            transport=httpx.MockTransport(handler),
        ),
        limiter=FakeLimiter(),
    )

    metadata = client.bulk_data("default_cards")

    assert metadata.type == "default_cards"
    assert requested_paths == ["/bulk-data"]


def test_bulk_data_rejects_missing_type() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": []}, request=request)

    client = ScryfallClient(
        client=httpx.Client(
            base_url="https://api.scryfall.com",
            transport=httpx.MockTransport(handler),
        ),
        limiter=FakeLimiter(),
    )

    with pytest.raises(ScryfallNotFoundError, match="default_cards"):
        client.bulk_data("default_cards")


def test_advanced_search_response_is_cached_by_query_and_page() -> None:
    requests = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        return httpx.Response(
            200,
            json={"data": [card_payload()], "total_cards": 1, "has_more": False},
            request=request,
        )

    limiter = FakeLimiter()
    client = ScryfallClient(
        client=httpx.Client(
            base_url="https://example.test", transport=httpx.MockTransport(handler)
        ),
        limiter=limiter,
        cache=FakeCache(),
    )

    first, _, _ = client.search("game:arena", page=2)
    second, _, _ = client.search("game:arena", page=2)

    assert first == second
    assert requests == 1
    assert limiter.acquisitions == 1
