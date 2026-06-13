from dataclasses import dataclass


@dataclass(frozen=True)
class StructuredDeckDescription:
    overview: str
    early_game: str
    midgame: str
    lategame: str
