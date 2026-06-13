import re
from typing import Literal

from openai import OpenAI
from pydantic import BaseModel, ConfigDict, Field


class ExtractedDecklistCard(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    name: str = Field(min_length=1, max_length=200)
    set_name: str | None = Field(default=None, max_length=200)
    quantity: int = Field(ge=1, le=1000)
    finish: Literal["nonfoil", "foil"] = "nonfoil"


class ExtractedDecklist(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    cards: list[ExtractedDecklistCard] = Field(max_length=1000)


class OpenAIDecklistExtractor:
    def __init__(self, api_key: str, model: str) -> None:
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required")
        self._client = OpenAI(api_key=api_key)
        self._model = model

    def extract(self, text: str) -> ExtractedDecklist:
        response = self._client.responses.parse(
            model=self._model,
            instructions=(
                "Extract only Magic: The Gathering cards being acquired or listed. Ignore names, "
                "addresses, prices, order metadata, shipping details, and totals. Remove cosmetic "
                "variant suffixes such as '(Retro Frame)', '(Borderless)', '(Showcase)', and "
                "'(Extended Art)' from card names. Preserve quantities and foil status. Include a "
                "set name only when the input clearly provides it."
            ),
            input=_sanitized_import_text(text),
            text_format=ExtractedDecklist,
        )
        if response.output_parsed is None:
            raise ValueError("OpenAI returned no structured decklist")
        return response.output_parsed


def _sanitized_import_text(text: str) -> str:
    item_blocks = re.findall(
        r"ITEMS\s+DETAILS\s+PRICE\s+QUANTITY(?P<items>.*?)(?=\s+Order Date|\Z)",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return "\n\n".join(block.strip() for block in item_blocks) if item_blocks else text
