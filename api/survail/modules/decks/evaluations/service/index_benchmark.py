"""Evidence rules and metrics for the Scores cache index benchmark."""

from collections.abc import Sequence
from dataclasses import dataclass

RUNS = 7
WARMUP_RUNS = 2
PASSES = 2
ORACLE_COUNTS = (1, 20, 60, 100, 200)
MINIMUM_DATASET_ROWS = 100_000
MINIMUM_P95_IMPROVEMENT = 0.15
MAXIMUM_SMALL_WORKLOAD_REGRESSION = 0.05


@dataclass(frozen=True)
class Strategy:
    name: str
    columns: tuple[str, ...] | None
    included_columns: tuple[str, ...] = ()

    @property
    def index_name(self) -> str:
        return f"benchmark_scores_{self.name}"


@dataclass(frozen=True)
class MetricSample:
    planning_ms: float
    execution_ms: float
    shared_hit_blocks: int
    shared_read_blocks: int
    temp_read_blocks: int
    temp_written_blocks: int


@dataclass(frozen=True)
class CandidateEvidence:
    name: str
    p95_total_by_oracle_count: dict[int, float]
    largest_workload_p95_by_pass: tuple[float, ...]


STRATEGIES = (
    Strategy("existing", None),
    Strategy("oracle_deck", ("oracle_id", "deck_id")),
    Strategy(
        "deck_oracle_covering",
        ("deck_id", "oracle_id"),
        (
            "id",
            "deck_revision",
            "context_key",
            "evaluator_version",
            "prompt_version",
            "overall_comment",
            "roles",
            "created_at",
            "updated_at",
        ),
    ),
)


def percentile(values: Sequence[float], quantile: float) -> float:
    if not values:
        raise ValueError("Cannot calculate a percentile without samples")
    ordered = sorted(values)
    position = (len(ordered) - 1) * quantile
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return round(ordered[lower] + (ordered[upper] - ordered[lower]) * fraction, 6)


def _distribution(values: Sequence[float]) -> dict[str, float]:
    return {"p50": percentile(values, 0.5), "p95": percentile(values, 0.95)}


def metric_summary(samples: Sequence[MetricSample]) -> dict[str, dict[str, float]]:
    return {
        "planning_ms": _distribution([sample.planning_ms for sample in samples]),
        "execution_ms": _distribution([sample.execution_ms for sample in samples]),
        "total_query_ms": _distribution(
            [sample.planning_ms + sample.execution_ms for sample in samples]
        ),
        "shared_hit_blocks": _distribution([float(sample.shared_hit_blocks) for sample in samples]),
        "shared_read_blocks": _distribution(
            [float(sample.shared_read_blocks) for sample in samples]
        ),
        "temp_read_blocks": _distribution([float(sample.temp_read_blocks) for sample in samples]),
        "temp_written_blocks": _distribution(
            [float(sample.temp_written_blocks) for sample in samples]
        ),
    }


def alternating_orders(
    strategies: tuple[Strategy, ...], oracle_counts: tuple[int, ...], *, passes: int
) -> tuple[tuple[tuple[Strategy, ...], tuple[int, ...]], ...]:
    return tuple(
        (strategies, oracle_counts)
        if pass_number % 2 == 0
        else (tuple(reversed(strategies)), tuple(reversed(oracle_counts)))
        for pass_number in range(passes)
    )


def not_run_output(reason: str, detail: str) -> dict[str, object]:
    return {
        "measurement_status": "not_run",
        "query_identity": "deck_id_and_oracle_id_set",
        "warnings": [detail],
        "strategies": {},
        "decision": {
            "selected_strategy": None,
            "reason": reason,
            "largest_workload_p95_total_improvement": None,
        },
        "transactional_cleanup": "not_started",
    }


def select_strategy(
    baseline: CandidateEvidence,
    candidates: Sequence[CandidateEvidence],
    *,
    minimum_improvement: float,
    maximum_small_workload_regression: float,
) -> dict[str, str | float]:
    largest_oracle_count = max(baseline.p95_total_by_oracle_count)
    baseline_largest = baseline.p95_total_by_oracle_count[largest_oracle_count]
    qualified: list[CandidateEvidence] = []
    for candidate in candidates:
        reproducible = all(
            candidate_p95 <= baseline_p95 * (1 - minimum_improvement)
            for baseline_p95, candidate_p95 in zip(
                baseline.largest_workload_p95_by_pass,
                candidate.largest_workload_p95_by_pass,
                strict=True,
            )
        )
        no_material_regression = all(
            candidate.p95_total_by_oracle_count[oracle_count]
            <= baseline_p95 * (1 + maximum_small_workload_regression)
            for oracle_count, baseline_p95 in baseline.p95_total_by_oracle_count.items()
        )
        pooled_improvement = (
            1 - candidate.p95_total_by_oracle_count[largest_oracle_count] / baseline_largest
        )
        if reproducible and no_material_regression and pooled_improvement >= minimum_improvement:
            qualified.append(candidate)
    if not qualified:
        return {
            "selected_strategy": "no_new_index",
            "reason": "no_candidate_met_reproducibility_threshold",
            "largest_workload_p95_total_improvement": 0.0,
        }
    selected = min(
        qualified,
        key=lambda item: item.p95_total_by_oracle_count[largest_oracle_count],
    )
    improvement = 1 - selected.p95_total_by_oracle_count[largest_oracle_count] / baseline_largest
    return {
        "selected_strategy": selected.name,
        "reason": "reproducible_p95_improvement",
        "largest_workload_p95_total_improvement": round(improvement, 6),
    }
