import asyncio
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import cast

from opentelemetry.metrics import Counter, Histogram, UpDownCounter
from pytest import MonkeyPatch

from survail import telemetry


@dataclass
class RecordedInstrument:
    values: list[tuple[int | float, Mapping[str, str] | None]] = field(default_factory=list)

    def add(self, amount: int, attributes: Mapping[str, str] | None = None) -> None:
        self.values.append((amount, attributes))

    def record(self, amount: float, attributes: Mapping[str, str] | None = None) -> None:
        self.values.append((amount, attributes))


def test_agent_run_metrics_record_completion_and_failure(monkeypatch: MonkeyPatch) -> None:
    runs = RecordedInstrument()
    active = RecordedInstrument()
    duration = RecordedInstrument()
    monkeypatch.setattr(
        telemetry,
        "AGENT_METRICS",
        telemetry.AgentMetrics(
            runs=cast(Counter, runs),
            active_runs=cast(UpDownCounter, active),
            run_duration=cast(Histogram, duration),
            model_phases=cast(Counter, RecordedInstrument()),
            tool_calls=cast(Counter, RecordedInstrument()),
        ),
    )

    with telemetry.observe_agent_run(run_id="run", conversation_id="conversation", deck_id="deck"):
        pass

    try:
        with telemetry.observe_agent_run(
            run_id="failed", conversation_id="conversation", deck_id="deck"
        ):
            raise RuntimeError("failure")
    except RuntimeError:
        pass

    assert runs.values == [(1, {"status": "completed"}), (1, {"status": "failed"})]
    assert active.values == [(1, None), (-1, None), (1, None), (-1, None)]
    assert [attributes for _, attributes in duration.values] == [
        {"status": "completed"},
        {"status": "failed"},
    ]


def test_agent_run_metrics_record_cancellation(monkeypatch: MonkeyPatch) -> None:
    runs = RecordedInstrument()
    monkeypatch.setattr(
        telemetry,
        "AGENT_METRICS",
        telemetry.AgentMetrics(
            runs=cast(Counter, runs),
            active_runs=cast(UpDownCounter, RecordedInstrument()),
            run_duration=cast(Histogram, RecordedInstrument()),
            model_phases=cast(Counter, RecordedInstrument()),
            tool_calls=cast(Counter, RecordedInstrument()),
        ),
    )

    try:
        with telemetry.observe_agent_run(
            run_id="cancelled", conversation_id="conversation", deck_id="deck"
        ):
            raise asyncio.CancelledError
    except asyncio.CancelledError:
        pass

    assert runs.values == [(1, {"status": "cancelled"})]
