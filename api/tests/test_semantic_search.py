import asyncio
from dataclasses import dataclass
from typing import cast

from sqlalchemy.orm import Session

from survail.domain import semantic_search as subject
from survail.schemas import ScryfallCardSnapshot


class FakeEmbeddingClient:
    closed = False

    def __init__(self, api_key: str) -> None:
        assert api_key == "test-key"

    async def embed(self, inputs: list[str]) -> list[list[float]]:
        assert inputs == ["repeatable graveyard recursion"]
        return [[0.5] * 3072]

    async def close(self) -> None:
        self.closed = True


@dataclass
class FakeCatalogCard:
    id: str


class FakeCatalog:
    def __init__(self, db: Session) -> None:
        del db

    def printing_records_by_oracle(self, oracle_id: str) -> list[FakeCatalogCard]:
        return [FakeCatalogCard(oracle_id)]


def _snapshot(oracle_id: str, identity: list[str], legality: str) -> ScryfallCardSnapshot:
    return ScryfallCardSnapshot(
        id=oracle_id,
        oracle_id=oracle_id,
        name=oracle_id,
        lang="en",
        layout="normal",
        cmc=2,
        type_line="Creature",
        oracle_text="Return a card from your graveyard.",
        color_identity=identity,
        legalities={"commander": legality},
        set="tst",
        set_name="Test",
        collector_number="1",
        rarity="rare",
        scryfall_uri="https://example.test/card",
    )


def test_semantic_search_filters_format_and_identity_and_returns_similarity(
    monkeypatch: object,
) -> None:
    from pytest import MonkeyPatch

    patch = cast(MonkeyPatch, monkeypatch)
    patch.setattr(subject, "EmbeddingClient", FakeEmbeddingClient)
    patch.setattr(subject, "CatalogRepository", FakeCatalog)
    snapshots = {
        "good": _snapshot("good", ["B", "G"], "legal"),
        "off-color": _snapshot("off-color", ["R"], "legal"),
        "illegal": _snapshot("illegal", ["B"], "not_legal"),
    }
    patch.setattr(
        subject,
        "catalog_printing_selection",
        lambda card: type("Selection", (), {"card": snapshots[card.id]})(),
    )
    patch.setattr(
        subject, "preferred_printing", lambda selections, preferences: (selections[0], [])
    )

    class FakeDb:
        def execute(self, statement: object) -> list[tuple[str, float]]:
            del statement
            return [("good", 0.1), ("off-color", 0.2), ("illegal", 0.3)]

    results = asyncio.run(
        subject.semantic_search(
            cast(Session, FakeDb()),
            "repeatable graveyard recursion",
            "test-key",
            deck_format="commander",
            color_identity=["U", "B", "G"],
        )
    )

    assert [(result.card.name, result.similarity) for result in results] == [("good", 0.9)]
