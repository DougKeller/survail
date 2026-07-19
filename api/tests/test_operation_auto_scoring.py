import uuid
from types import SimpleNamespace
from typing import cast

import pytest
from fastapi import BackgroundTasks

from survail.core.models import DeckOperation, User
from survail.modules.decks.evaluations.service import run as evaluation_run
from survail.modules.decks.evaluations.service.run import EvaluationService, score_added_cards
from survail.modules.decks.operations.api.router import _queue_added_card_scoring


def test_positive_operation_changes_queue_one_nonblocking_score_task() -> None:
    deck_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    operation = cast(
        "DeckOperation",
        SimpleNamespace(
            changes=[
                SimpleNamespace(oracle_id="new-card", quantity_delta=1),
                SimpleNamespace(oracle_id="new-card", quantity_delta=3),
                SimpleNamespace(oracle_id="removed-card", quantity_delta=-1),
            ]
        ),
    )
    background_tasks = BackgroundTasks()

    _queue_added_card_scoring(background_tasks, operation, deck_id, owner_id)

    assert len(background_tasks.tasks) == 1
    task = background_tasks.tasks[0]
    assert task.func is score_added_cards
    assert task.args == (deck_id, owner_id, ["new-card"])


def test_remove_only_operation_does_not_queue_scoring() -> None:
    operation = cast(
        "DeckOperation",
        SimpleNamespace(changes=[SimpleNamespace(oracle_id="removed-card", quantity_delta=-1)]),
    )
    background_tasks = BackgroundTasks()

    _queue_added_card_scoring(
        background_tasks,
        operation,
        uuid.uuid4(),
        uuid.uuid4(),
    )

    assert background_tasks.tasks == []


def test_disabled_scoring_does_not_queue_added_cards() -> None:
    operation = cast(
        "DeckOperation",
        SimpleNamespace(changes=[SimpleNamespace(oracle_id="new-card", quantity_delta=1)]),
    )
    background_tasks = BackgroundTasks()

    _queue_added_card_scoring(
        background_tasks,
        operation,
        uuid.uuid4(),
        uuid.uuid4(),
        scoring_enabled=False,
    )

    assert background_tasks.tasks == []


def test_background_scoring_is_registered_as_a_worker_thread_task() -> None:
    deck_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    background_tasks = BackgroundTasks()
    operation = cast(
        "DeckOperation",
        SimpleNamespace(changes=[SimpleNamespace(oracle_id="new-card", quantity_delta=1)]),
    )
    _queue_added_card_scoring(background_tasks, operation, deck_id, owner_id)
    task = background_tasks.tasks[0]

    # Starlette executes synchronous background callables in its worker pool.
    # An async callable runs on Uvicorn's event loop and can freeze every route
    # when synchronous SQLAlchemy work waits on a database lock.
    assert task.is_async is False


def test_background_task_scores_added_oracles_cache_first(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    deck_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    user = User(id=owner_id, discord_id="owner", username="owner")
    selected: list[tuple[uuid.UUID, list[str]]] = []

    class FakeSession:
        def __enter__(self) -> "FakeSession":
            return self

        def __exit__(self, *args: object) -> None:
            del args

        def get(self, model: object, identity: uuid.UUID) -> User | None:
            del model
            return user if identity == owner_id else None

    async def fake_selected(
        self: EvaluationService,
        subject: User,
        subject_deck_id: uuid.UUID,
        oracle_ids: list[str],
    ) -> list[object]:
        del self
        assert subject is user
        selected.append((subject_deck_id, oracle_ids))
        return []

    monkeypatch.setattr(evaluation_run, "SessionLocal", FakeSession)
    monkeypatch.setattr(EvaluationService, "selected", fake_selected)

    score_added_cards(deck_id, owner_id, ["first", "first", "second"])

    assert selected == [(deck_id, ["first", "second"])]
