from typing import TypeAlias

from pydantic import JsonValue

JsonScalar: TypeAlias = str | int | float | bool | None
JsonObject: TypeAlias = dict[str, JsonValue]
RedisValue: TypeAlias = str | bytes | int | float | None
RedisArg: TypeAlias = str | bytes | int | float


def json_object(value: object) -> JsonObject:
    normalized = json_value(value)
    if not isinstance(normalized, dict):
        raise TypeError("Expected a JSON object")
    return normalized


def json_value(value: object) -> JsonValue:
    if value is None or isinstance(value, str | int | float | bool):
        return value
    if isinstance(value, list):
        return [json_value(item) for item in value]
    if isinstance(value, dict):
        if not all(isinstance(key, str) for key in value):
            raise TypeError("JSON object keys must be strings")
        return {str(key): json_value(item) for key, item in value.items()}
    raise TypeError("Value is not JSON-compatible")
