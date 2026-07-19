import os
from datetime import UTC, datetime
from pathlib import Path

import dspy  # type: ignore[import-untyped]
import pytest

from scripts import judge_gepa
from scripts.judge_eval import CatalogReadSession
from scripts.judge_gepa import (
    InvalidInstructionProposalError,
    card_name_leaks,
    golden_metric,
    resolve_run_dir,
    split_examples,
    validating_instruction_proposer,
)
from survail.modules.decks.evaluations.service.evaluator import ROLE_NAMES, StructuredLLMaaJ


def test_catalog_read_session_delegates_read_execute() -> None:
    statement = object()
    result = object()

    class CatalogSession:
        def execute(self, received: object) -> object:
            assert received is statement
            return result

    adapter = CatalogReadSession(CatalogSession())

    assert adapter.execute(statement) is result


def test_golden_metric_ignores_historical_overall_range_without_changing_labels() -> None:
    payload: dict[str, object] = dict.fromkeys(ROLE_NAMES, "N/A")
    payload["overall_summary"] = "No material role identified."
    prediction = dspy.Prediction(evaluation=StructuredLLMaaJ(**payload))
    example = dspy.Example(
        evaluation_context="context",
        card_context="Type: Sorcery",
        # The prediction below deterministically has overall_score=0. This
        # deliberately incompatible historical label must not affect GEPA.
        expectation={"overall_range": [75, 90]},
    ).with_inputs("evaluation_context")

    metric = golden_metric(example, prediction)
    feedback_metric = golden_metric(example, prediction, None, "evaluate", None)

    assert metric.score == 1.0
    assert "behavioral constraints passed" in metric.feedback
    assert feedback_metric.score == metric.score
    assert feedback_metric.feedback == metric.feedback


def test_split_examples_is_deterministic_and_keeps_both_decks_in_validation() -> None:
    examples = [
        dspy.Example(evaluation_context=str(index), deck_title=deck, card_name=str(index))
        for deck in ("one", "two")
        for index in range(6)
    ]

    trainset, valset = split_examples(examples)

    assert len(trainset) == 8
    assert [(example.deck_title, example.card_name) for example in valset] == [
        ("one", "0"),
        ("one", "5"),
        ("two", "0"),
        ("two", "5"),
    ]


def test_resolve_run_dir_creates_unique_timestamped_runs(tmp_path: Path) -> None:
    runs_dir = tmp_path / "runs"
    legacy_dir = tmp_path / "legacy"
    now = datetime(2026, 7, 18, 6, 30, tzinfo=UTC)

    first = resolve_run_dir(
        resume=False,
        runs_dir=runs_dir,
        legacy_run_dir=legacy_dir,
        now=now,
    )
    second = resolve_run_dir(
        resume=False,
        runs_dir=runs_dir,
        legacy_run_dir=legacy_dir,
        now=now,
    )

    assert first == runs_dir / "20260718T063000.000000Z"
    assert second == runs_dir / "20260718T063000.000000Z-2"
    assert first.is_dir()
    assert second.is_dir()


def test_resolve_run_dir_resumes_latest_checkpoint_including_legacy(tmp_path: Path) -> None:
    runs_dir = tmp_path / "runs"
    older = runs_dir / "older"
    newer = tmp_path / "legacy"
    older.mkdir(parents=True)
    newer.mkdir()
    older_checkpoint = older / judge_gepa.CHECKPOINT_NAME
    newer_checkpoint = newer / judge_gepa.CHECKPOINT_NAME
    older_checkpoint.write_bytes(b"older")
    newer_checkpoint.write_bytes(b"newer checkpoint")
    os.utime(older_checkpoint, ns=(1, 1))
    os.utime(newer_checkpoint, ns=(2, 2))

    selected = resolve_run_dir(
        resume=True,
        runs_dir=runs_dir,
        legacy_run_dir=newer,
    )

    assert selected == newer


def test_resolve_run_dir_resume_requires_a_checkpoint(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="no GEPA checkpoint"):
        resolve_run_dir(
            resume=True,
            runs_dir=tmp_path / "runs",
            legacy_run_dir=tmp_path / "legacy",
        )


def test_card_name_leaks_is_case_insensitive() -> None:
    assert card_name_leaks("Do not memorize EXAMPLE CARD.", ["Example Card", "Other"]) == [
        "Example Card"
    ]


def test_instruction_proposer_repairs_card_name_leaks_before_returning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        judge_gepa,
        "_propose_instruction",
        lambda current, examples: "Use Counterspell as a named classification shortcut.",
    )
    repairs: list[list[str]] = []

    def repair(proposal: str, leaks: list[str]) -> str:
        repairs.append(leaks)
        return "Classify stack interaction from its rules text and behavior."

    monkeypatch.setattr(judge_gepa, "_repair_instruction", repair)
    proposer = validating_instruction_proposer({"Counterspell"})

    result = proposer(
        candidate={"evaluate": "seed"},
        reflective_dataset={"evaluate": []},
        components_to_update=["evaluate"],
    )

    assert repairs == [["Counterspell"]]
    assert result == {"evaluate": "Classify stack interaction from its rules text and behavior."}


def test_instruction_proposer_rejects_a_leak_that_cannot_be_repaired(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        judge_gepa,
        "_propose_instruction",
        lambda current, examples: "Use Counterspell.",
    )
    monkeypatch.setattr(
        judge_gepa,
        "_repair_instruction",
        lambda proposal, leaks: "Still use Counterspell.",
    )
    proposer = validating_instruction_proposer({"Counterspell"}, max_repair_attempts=1)

    with pytest.raises(InvalidInstructionProposalError, match="Counterspell"):
        proposer(
            candidate={"evaluate": "seed"},
            reflective_dataset={"evaluate": []},
            components_to_update=["evaluate"],
        )
