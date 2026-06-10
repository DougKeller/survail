import time
from collections.abc import Callable
from typing import Protocol

from redis import Redis

from survail.types import RedisArg, RedisValue


class RedisEvalClient(Protocol):
    def eval(self, script: str, numkeys: int, *keys_and_args: RedisArg) -> RedisValue: ...


class RedisEvalAdapter:
    def __init__(self, client: Redis) -> None:
        self._client = client

    def eval(self, script: str, numkeys: int, *keys_and_args: RedisArg) -> RedisValue:
        result: object = self._client.eval(script, numkeys, *keys_and_args)
        if result is None or isinstance(result, str | bytes | int | float):
            return result
        raise TypeError("Redis script returned an unsupported value")


_ACQUIRE_SCRIPT = """
local current = redis.call("TIME")
local now_ms = (current[1] * 1000) + math.floor(current[2] / 1000)
local next_ms = tonumber(redis.call("GET", KEYS[1]) or "0")
local cooldown_ms = tonumber(redis.call("GET", KEYS[2]) or "0")
local allowed_ms = math.max(now_ms, next_ms, cooldown_ms)
redis.call("SET", KEYS[1], allowed_ms + ARGV[1], "PX", ARGV[2])
return allowed_ms - now_ms
"""

_COOLDOWN_SCRIPT = """
local current = redis.call("TIME")
local now_ms = (current[1] * 1000) + math.floor(current[2] / 1000)
local until_ms = now_ms + ARGV[1]
local existing_ms = tonumber(redis.call("GET", KEYS[1]) or "0")
if until_ms > existing_ms then
    redis.call("SET", KEYS[1], until_ms, "PX", ARGV[2])
end
return math.max(until_ms, existing_ms)
"""


class RedisRateLimiter:
    def __init__(
        self,
        client: RedisEvalClient,
        *,
        namespace: str,
        requests_per_second: float,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._client = client
        self._next_key = f"{namespace}:next"
        self._cooldown_key = f"{namespace}:cooldown"
        self._interval_ms = max(1, round(1000 / requests_per_second))
        self._state_ttl_ms = max(60_000, self._interval_ms * 100)
        self._sleep = sleep

    def acquire(self) -> float:
        result = self._client.eval(
            _ACQUIRE_SCRIPT,
            2,
            self._next_key,
            self._cooldown_key,
            self._interval_ms,
            self._state_ttl_ms,
        )
        if not isinstance(result, int):
            raise TypeError("Redis rate limiter returned an invalid wait time")
        wait_ms = result
        wait_seconds = max(0.0, wait_ms / 1000)
        if wait_seconds:
            self._sleep(wait_seconds)
        return wait_seconds

    def cooldown(self, seconds: float) -> None:
        cooldown_ms = max(1, round(seconds * 1000))
        self._client.eval(
            _COOLDOWN_SCRIPT,
            1,
            self._cooldown_key,
            cooldown_ms,
            max(self._state_ttl_ms, cooldown_ms * 2),
        )
