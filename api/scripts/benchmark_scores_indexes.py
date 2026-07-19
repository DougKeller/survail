"""Benchmark PostgreSQL indexes used while opening the Scores tab.

Run against a migrated development database:
    DATABASE_URL=postgresql://survail:survail@localhost:5432/survail \
      python scripts/benchmark_scores_indexes.py

Candidate indexes are measured in alternating orders and dropped after each
pass. The enclosing transaction is always rolled back, so neither DDL nor
statistics changes survive the benchmark.
"""

from __future__ import annotations

import json
import os
import statistics
from collections.abc import Sequence

import psycopg
from psycopg import sql

from survail.modules.decks.evaluations.service.index_benchmark import (
    MAXIMUM_SMALL_WORKLOAD_REGRESSION,
    MINIMUM_DATASET_ROWS,
    MINIMUM_P95_IMPROVEMENT,
    ORACLE_COUNTS,
    PASSES,
    RUNS,
    STRATEGIES,
    WARMUP_RUNS,
    CandidateEvidence,
    MetricSample,
    Strategy,
    alternating_orders,
    metric_summary,
    not_run_output,
    percentile,
    select_strategy,
)


def _explain(
    cursor: psycopg.Cursor[tuple[object, ...]],
    query: sql.Composable,
    parameters: Sequence[object],
) -> dict[str, object]:
    cursor.execute(
        sql.SQL("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ") + query,
        parameters,
    )
    result = cursor.fetchone()
    assert result is not None
    payload = result[0]
    assert isinstance(payload, list)
    plan = payload[0]
    assert isinstance(plan, dict)
    return plan


def _indexes(node: object) -> set[str]:
    if not isinstance(node, dict):
        return set()
    found = {str(node["Index Name"])} if "Index Name" in node else set()
    for child in node.get("Plans", []):
        found.update(_indexes(child))
    return found


def _number(value: object) -> float:
    if isinstance(value, int | float | str):
        return float(value)
    raise TypeError(f"Expected a numeric EXPLAIN value, got {type(value).__name__}")


def _integer_metric(node: dict[str, object], name: str) -> int:
    return int(_number(node.get(name, 0)))


def _sample(plan: dict[str, object]) -> MetricSample:
    root = plan["Plan"]
    assert isinstance(root, dict)
    return MetricSample(
        planning_ms=_number(plan["Planning Time"]),
        execution_ms=_number(plan["Execution Time"]),
        shared_hit_blocks=_integer_metric(root, "Shared Hit Blocks"),
        shared_read_blocks=_integer_metric(root, "Shared Read Blocks"),
        temp_read_blocks=_integer_metric(root, "Temp Read Blocks"),
        temp_written_blocks=_integer_metric(root, "Temp Written Blocks"),
    )


def _measure(
    cursor: psycopg.Cursor[tuple[object, ...]],
    query: sql.Composable,
    parameters: Sequence[object],
) -> tuple[list[MetricSample], set[str]]:
    for _ in range(WARMUP_RUNS):
        _explain(cursor, query, parameters)
    plans = [_explain(cursor, query, parameters) for _ in range(RUNS)]
    indexes: set[str] = set()
    for plan in plans:
        indexes.update(_indexes(plan["Plan"]))
    return [_sample(plan) for plan in plans], indexes


def _create_candidate(cursor: psycopg.Cursor[tuple[object, ...]], strategy: Strategy) -> None:
    assert strategy.columns is not None
    statement = sql.SQL("CREATE INDEX {} ON card_role_evaluations ({})").format(
        sql.Identifier(strategy.index_name),
        sql.SQL(", ").join(sql.Identifier(column) for column in strategy.columns),
    )
    if strategy.included_columns:
        statement += sql.SQL(" INCLUDE ({})").format(
            sql.SQL(", ").join(sql.Identifier(column) for column in strategy.included_columns)
        )
    cursor.execute(statement)


def _drop_candidate(cursor: psycopg.Cursor[tuple[object, ...]], strategy: Strategy) -> None:
    cursor.execute(sql.SQL("DROP INDEX {}").format(sql.Identifier(strategy.index_name)))


def _relation_size(cursor: psycopg.Cursor[tuple[object, ...]], relation: str) -> int:
    cursor.execute("SELECT pg_relation_size(%s::regclass)", (relation,))
    return _fetched_integer(cursor)


def _fetched_integer(cursor: psycopg.Cursor[tuple[object, ...]]) -> int:
    row = cursor.fetchone()
    assert row is not None
    return int(_number(row[0]))


def _existing_index_definitions(
    cursor: psycopg.Cursor[tuple[object, ...]],
) -> dict[str, str]:
    cursor.execute(
        """
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename = 'card_role_evaluations'
        ORDER BY indexname
        """
    )
    definitions: dict[str, str] = {}
    for name, definition in cursor.fetchall():
        if not isinstance(name, str) or not isinstance(definition, str):
            raise TypeError("Expected PostgreSQL index names and definitions as strings")
        definitions[name] = definition
    return definitions


def _target(cursor: psycopg.Cursor[tuple[object, ...]]) -> tuple[object, list[str]]:
    cursor.execute(
        """
        SELECT deck_id, array_agg(oracle_id ORDER BY oracle_id)
        FROM card_role_evaluations
        GROUP BY deck_id
        ORDER BY count(*) DESC
        LIMIT 1
        """
    )
    target = cursor.fetchone()
    if target is None:
        raise RuntimeError("No card_role_evaluations rows are available to benchmark")
    deck_id, oracle_ids = target
    if not isinstance(oracle_ids, list) or not all(
        isinstance(oracle_id, str) for oracle_id in oracle_ids
    ):
        raise TypeError("Expected PostgreSQL to return oracle_id as a string array")
    return deck_id, oracle_ids


def _evidence(
    name: str,
    samples: dict[int, dict[int, list[MetricSample]]],
) -> CandidateEvidence:
    pooled = {
        oracle_count: percentile(
            [
                sample.planning_ms + sample.execution_ms
                for pass_samples in passes.values()
                for sample in pass_samples
            ],
            0.95,
        )
        for oracle_count, passes in samples.items()
    }
    largest_oracle_count = max(samples)
    per_pass = tuple(
        percentile([sample.planning_ms + sample.execution_ms for sample in pass_samples], 0.95)
        for _, pass_samples in sorted(samples[largest_oracle_count].items())
    )
    return CandidateEvidence(name, pooled, per_pass)


def _run(database_url: str, minimum_rows: int) -> dict[str, object]:
    all_samples: dict[str, dict[int, dict[int, list[MetricSample]]]] = {
        strategy.name: {oracle_count: {} for oracle_count in ORACLE_COUNTS}
        for strategy in STRATEGIES
    }
    plan_indexes: dict[str, set[str]] = {strategy.name: set() for strategy in STRATEGIES}
    candidate_sizes: dict[str, list[int]] = {strategy.name: [] for strategy in STRATEGIES}

    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        try:
            cursor.execute("SELECT count(*) FROM card_role_evaluations")
            evaluation_count = _fetched_integer(cursor)
            cursor.execute("SELECT count(*) FROM catalog_cards")
            catalog_count = _fetched_integer(cursor)
            cursor.execute("SELECT pg_indexes_size('card_role_evaluations'::regclass)")
            existing_index_bytes = _fetched_integer(cursor)
            existing_indexes = _existing_index_definitions(cursor)
            deck_id, all_oracle_ids = _target(cursor)
            lookup = sql.SQL(
                """
                SELECT * FROM card_role_evaluations
                WHERE deck_id = %s
                  AND oracle_id = ANY(%s)
                """
            )
            cursor.execute("ANALYZE card_role_evaluations")
            for pass_number, (strategy_order, oracle_order) in enumerate(
                alternating_orders(STRATEGIES, ORACLE_COUNTS, passes=PASSES)
            ):
                for strategy in strategy_order:
                    if strategy.columns is not None:
                        _create_candidate(cursor, strategy)
                        candidate_sizes[strategy.name].append(
                            _relation_size(cursor, strategy.index_name)
                        )
                    try:
                        for requested_oracles in oracle_order:
                            oracle_ids = all_oracle_ids[:requested_oracles]
                            samples, indexes = _measure(
                                cursor,
                                lookup,
                                (deck_id, oracle_ids),
                            )
                            all_samples[strategy.name][requested_oracles][pass_number] = samples
                            plan_indexes[strategy.name].update(indexes)
                    finally:
                        if strategy.columns is not None:
                            _drop_candidate(cursor, strategy)
        finally:
            connection.rollback()

    warnings: list[str] = []
    if evaluation_count < minimum_rows:
        warnings.append(
            f"dataset_below_minimum: {evaluation_count} < {minimum_rows}; "
            "results are diagnostic and cannot select a new index"
        )
    evidence = {
        strategy.name: _evidence(strategy.name, all_samples[strategy.name])
        for strategy in STRATEGIES
    }
    decision = select_strategy(
        evidence["existing"],
        tuple(evidence[strategy.name] for strategy in STRATEGIES if strategy.name != "existing"),
        minimum_improvement=MINIMUM_P95_IMPROVEMENT,
        maximum_small_workload_regression=MAXIMUM_SMALL_WORKLOAD_REGRESSION,
    )
    if warnings:
        decision = {
            "selected_strategy": "no_new_index",
            "reason": "dataset_below_minimum",
            "largest_workload_p95_total_improvement": 0.0,
        }

    strategies_output: dict[str, object] = {}
    for strategy in STRATEGIES:
        workloads = {}
        for requested_oracles in ORACLE_COUNTS:
            pass_samples = all_samples[strategy.name][requested_oracles]
            pooled_samples = [sample for samples in pass_samples.values() for sample in samples]
            workloads[str(requested_oracles)] = {
                "actual_oracle_ids": min(requested_oracles, len(all_oracle_ids)),
                "metrics": metric_summary(pooled_samples),
                "execution_p95_ms_by_pass": [
                    percentile([sample.execution_ms for sample in pass_samples[pass_number]], 0.95)
                    for pass_number in sorted(pass_samples)
                ],
                "total_query_p95_ms_by_pass": [
                    percentile(
                        [
                            sample.planning_ms + sample.execution_ms
                            for sample in pass_samples[pass_number]
                        ],
                        0.95,
                    )
                    for pass_number in sorted(pass_samples)
                ],
            }
        strategies_output[strategy.name] = {
            "columns": list(strategy.columns) if strategy.columns is not None else None,
            "included_columns": list(strategy.included_columns),
            "plan_indexes": sorted(plan_indexes[strategy.name]),
            "existing_indexes_bytes": existing_index_bytes,
            "candidate_index_bytes": (
                int(statistics.median(candidate_sizes[strategy.name]))
                if candidate_sizes[strategy.name]
                else 0
            ),
            "workloads": workloads,
        }

    return {
        "measurement_status": "diagnostic" if warnings else "eligible",
        "query_identity": "deck_id_and_oracle_id_set",
        "configuration": {
            "passes": PASSES,
            "warmup_runs": WARMUP_RUNS,
            "measured_runs_per_pass": RUNS,
            "oracle_id_counts": list(ORACLE_COUNTS),
            "bias_control": "alternating_strategy_and_oracle_count_order",
            "minimum_dataset_rows": minimum_rows,
            "minimum_p95_improvement": MINIMUM_P95_IMPROVEMENT,
            "maximum_small_workload_regression": MAXIMUM_SMALL_WORKLOAD_REGRESSION,
        },
        "dataset": {
            "catalog_cards": catalog_count,
            "card_role_evaluations": evaluation_count,
            "target_deck_oracle_ids": len(all_oracle_ids),
            "existing_indexes": existing_indexes,
        },
        "target": {"deck_id": str(deck_id)},
        "warnings": warnings,
        "strategies": strategies_output,
        "decision": decision,
        "transactional_cleanup": "rolled_back",
    }


def main() -> None:
    database_url = os.environ.get(
        "DATABASE_URL", "postgresql://survail:survail@localhost:5432/survail"
    ).replace("postgresql+psycopg://", "postgresql://")
    minimum_rows = int(os.environ.get("SCORES_BENCHMARK_MINIMUM_ROWS", MINIMUM_DATASET_ROWS))
    try:
        output = _run(database_url, minimum_rows)
    except psycopg.Error as exc:
        output = not_run_output("database_unavailable", f"benchmark_not_run: {exc}")
    except RuntimeError as exc:
        output = not_run_output("dataset_unavailable", f"benchmark_not_run: {exc}")
    print(json.dumps(output, indent=2))  # noqa: T201 - public benchmark output


if __name__ == "__main__":
    main()
