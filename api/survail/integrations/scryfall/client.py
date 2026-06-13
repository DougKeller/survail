import hashlib
import logging
import time
from datetime import datetime
from decimal import Decimal
from typing import Protocol

import httpx
from pydantic import BaseModel, ConfigDict, Field

from survail.core.config import get_settings
from survail.core.schemas import CardFace, CardPrices, ImageUris, ScryfallCardSnapshot
from survail.core.types import JsonObject, json_object
from survail.integrations.cache import get_cache
from survail.integrations.rate_limit import RedisEvalAdapter, RedisRateLimiter

logger = logging.getLogger(__name__)


class RateLimiterLike(Protocol):
    def acquire(self) -> float: ...

    def cooldown(self, seconds: float) -> None: ...


class CacheLike(Protocol):
    def get(self, key: str) -> JsonObject | None: ...

    def set(self, key: str, value: JsonObject, ttl_seconds: int) -> None: ...


class ScryfallError(RuntimeError):
    pass


class ScryfallNotFoundError(ScryfallError):
    pass


class ScryfallRequestError(ScryfallError):
    pass


class UpstreamFace(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    mana_cost: str = ""
    type_line: str = ""
    oracle_text: str | None = None
    colors: list[str] = Field(default_factory=list)
    power: str | None = None
    toughness: str | None = None
    loyalty: str | None = None
    image_uris: ImageUris | None = None


class UpstreamPrices(BaseModel):
    model_config = ConfigDict(extra="ignore")
    usd: Decimal | None = None
    usd_foil: Decimal | None = None
    usd_etched: Decimal | None = None
    eur: Decimal | None = None
    eur_foil: Decimal | None = None
    tix: Decimal | None = None


class UpstreamCard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    oracle_id: str
    name: str
    lang: str = "en"
    released_at: str | None = None
    layout: str
    mana_cost: str | None = None
    cmc: float
    type_line: str
    oracle_text: str | None = None
    colors: list[str] = Field(default_factory=list)
    color_identity: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    legalities: dict[str, str]
    set: str
    set_name: str
    collector_number: str
    rarity: str
    finishes: list[str] = Field(default_factory=list)
    promo_types: list[str] = Field(default_factory=list)
    border_color: str = "black"
    frame: str = "2015"
    prices: UpstreamPrices = Field(default_factory=UpstreamPrices)
    image_uris: ImageUris | None = None
    card_faces: list[UpstreamFace] = Field(default_factory=list)
    scryfall_uri: str

    def snapshot(self) -> ScryfallCardSnapshot:
        return ScryfallCardSnapshot(
            **self.model_dump(
                exclude={"card_faces", "prices", "promo_types", "border_color", "frame"}
            ),
            prices=CardPrices.model_validate(self.prices.model_dump()),
            border_color=self.border_color,
            frame=self.frame,
            universes_beyond="universesbeyond" in self.promo_types,
            card_faces=[CardFace.model_validate(face.model_dump()) for face in self.card_faces],
        )


class ScryfallBulkData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    type: str
    updated_at: datetime
    download_uri: str


class ScryfallBulkDataList(BaseModel):
    model_config = ConfigDict(extra="ignore")
    data: list[ScryfallBulkData]


class ScryfallSearch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    data: list[UpstreamCard]
    total_cards: int
    has_more: bool


class ScryfallClient:
    def __init__(
        self,
        client: httpx.Client | None = None,
        limiter: RateLimiterLike | None = None,
        cache: CacheLike | None = None,
    ) -> None:
        settings = get_settings()
        self._client = client or httpx.Client(
            base_url="https://api.scryfall.com",
            headers={
                "Accept": "application/json;q=0.9,*/*;q=0.8",
                "User-Agent": settings.scryfall_user_agent,
            },
            timeout=10,
        )
        self._owns_client = client is None
        self._cache = cache or get_cache()
        self._search_cache_ttl_seconds = settings.scryfall_search_cache_ttl_seconds
        if limiter is None:
            from redis import Redis

            limiter = RedisRateLimiter(
                RedisEvalAdapter(Redis.from_url(settings.redis_url, decode_responses=True)),
                namespace="rate-limit:scryfall",
                requests_per_second=settings.scryfall_requests_per_second,
            )
        self._limiter = limiter

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def bulk_data(self, bulk_type: str) -> ScryfallBulkData:
        result = ScryfallBulkDataList.model_validate(self._get("/bulk-data", {}))
        metadata = next((item for item in result.data if item.type == bulk_type), None)
        if metadata is None:
            raise ScryfallNotFoundError(f"Scryfall bulk data type not found: {bulk_type}")
        return metadata

    def search(self, query: str, page: int = 1) -> tuple[list[ScryfallCardSnapshot], int, bool]:
        normalized = " ".join(query.strip().split())
        digest = hashlib.sha256(f"{normalized}:{page}".encode()).hexdigest()
        key = f"scryfall:search:{digest}"
        data = self._cache.get(key)
        if data is None:
            data = self._get("/cards/search", {"q": normalized, "page": page})
            self._cache.set(key, data, self._search_cache_ttl_seconds)
            logger.info("scryfall search cache miss", extra={"cache_key": key})
        else:
            logger.debug("scryfall search cache hit", extra={"cache_key": key})
        result = ScryfallSearch.model_validate(data)
        return [card.snapshot() for card in result.data], result.total_cards, result.has_more

    def _get(self, path: str, params: dict[str, str | int]) -> JsonObject:
        waited = self._limiter.acquire()
        started_at = time.monotonic()
        try:
            response = self._client.get(path, params=params)
            data = json_object(response.json())
        except (httpx.HTTPError, TypeError, ValueError) as exc:
            logger.exception("scryfall request failed", extra={"path": path})
            raise ScryfallRequestError("Scryfall request failed") from exc
        elapsed_ms = round((time.monotonic() - started_at) * 1000)
        logger.info(
            "scryfall request path=%s status=%s elapsed_ms=%s wait_ms=%s",
            path,
            response.status_code,
            elapsed_ms,
            round(waited * 1000),
            extra={
                "path": path,
                "status_code": response.status_code,
                "elapsed_ms": elapsed_ms,
                "rate_limit_wait_ms": round(waited * 1000),
            },
        )
        if response.status_code == 429:
            retry_after = _retry_after_seconds(response)
            self._limiter.cooldown(retry_after)
            logger.warning(
                "scryfall rate limited path=%s retry_after_seconds=%s",
                path,
                retry_after,
                extra={"path": path, "retry_after_seconds": retry_after},
            )
            raise ScryfallRequestError(
                f"Scryfall rate limit exceeded; retry after {retry_after:g} seconds"
            )
        if response.status_code == 404:
            raise ScryfallNotFoundError(str(data.get("details", "Card not found")))
        if response.is_error:
            raise ScryfallRequestError(str(data.get("details", "Scryfall request failed")))
        return data


def _retry_after_seconds(response: httpx.Response) -> float:
    value = response.headers.get("Retry-After")
    if value is not None:
        try:
            return max(1.0, float(value))
        except ValueError:
            pass
    try:
        data = json_object(response.json())
    except (TypeError, ValueError):
        return 60.0
    retry_after = data.get("retry_after")
    if isinstance(retry_after, int | float):
        return max(1.0, float(retry_after))
    return 60.0
