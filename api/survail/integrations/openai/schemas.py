from pydantic import BaseModel, ConfigDict


class StructuredDeckDescription(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    overview: str
    early_game: str
    midgame: str
    lategame: str
