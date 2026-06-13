import json
from functools import lru_cache

from redis import Redis

from survail.core.config import get_settings
from survail.core.types import JsonObject, json_object


class JsonCache:
    def __init__(self, client: Redis) -> None:
        self._client = client

    def get(self, key: str) -> JsonObject | None:
        value = self._client.get(key)
        if value is None:
            return None
        try:
            return json_object(json.loads(value))
        except (TypeError, ValueError):
            return None

    def set(self, key: str, value: JsonObject, ttl_seconds: int) -> None:
        self._client.set(
            key,
            json.dumps(value, separators=(",", ":"), sort_keys=True),
            ex=ttl_seconds,
        )


@lru_cache
def get_cache() -> JsonCache:
    return JsonCache(Redis.from_url(get_settings().redis_url, decode_responses=True))
