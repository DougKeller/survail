from collections.abc import Iterator
from typing import BinaryIO

from survail.core.types import JsonValue

def items(source: BinaryIO, prefix: str) -> Iterator[JsonValue]: ...
