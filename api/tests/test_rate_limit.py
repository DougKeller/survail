from survail.integrations.rate_limit import RedisRateLimiter
from survail.types import RedisValue


class FakeRedis:
    def __init__(self, results: list[int]) -> None:
        self.results = iter(results)
        self.calls: list[tuple[int, tuple[RedisValue, ...]]] = []

    def eval(self, _: str, numkeys: int, *keys_and_args: RedisValue) -> RedisValue:
        self.calls.append((numkeys, keys_and_args))
        return next(self.results)


def test_rate_limiter_uses_redis_wait_time() -> None:
    redis = FakeRedis([250])
    sleeps: list[float] = []
    limiter = RedisRateLimiter(
        redis,
        namespace="test",
        requests_per_second=5,
        sleep=sleeps.append,
    )

    waited = limiter.acquire()

    assert waited == 0.25
    assert sleeps == [0.25]
    assert redis.calls[0][0] == 2


def test_rate_limiter_records_shared_cooldown() -> None:
    redis = FakeRedis([0])
    limiter = RedisRateLimiter(redis, namespace="test", requests_per_second=5)

    limiter.cooldown(12)

    assert redis.calls[0][0] == 1
    assert redis.calls[0][1][-2:] == (12_000, 60_000)
