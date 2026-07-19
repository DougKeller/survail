from survail.modules.decks.evaluations.service.index_benchmark import (
    STRATEGIES,
    CandidateEvidence,
    MetricSample,
    Strategy,
    alternating_orders,
    metric_summary,
    not_run_output,
    select_strategy,
)


def test_candidates_match_the_deck_oracle_cache_query() -> None:
    assert [(strategy.name, strategy.columns) for strategy in STRATEGIES] == [
        ("existing", None),
        ("oracle_deck", ("oracle_id", "deck_id")),
        ("deck_oracle_covering", ("deck_id", "oracle_id")),
    ]
    assert "roles" in STRATEGIES[-1].included_columns


def test_alternating_orders_reverse_strategy_and_workload_bias() -> None:
    strategies = (
        Strategy("existing", None),
        Strategy("oracle_deck", ("oracle_id", "deck_id")),
        Strategy(
            "deck_oracle_covering",
            ("deck_id", "oracle_id"),
            ("roles", "overall_comment"),
        ),
    )

    orders = alternating_orders(strategies, (1, 60, 129), passes=2)

    assert [strategy.name for strategy in orders[0][0]] == [
        "existing",
        "oracle_deck",
        "deck_oracle_covering",
    ]
    assert orders[0][1] == (1, 60, 129)
    assert [strategy.name for strategy in orders[1][0]] == [
        "deck_oracle_covering",
        "oracle_deck",
        "existing",
    ]
    assert orders[1][1] == (129, 60, 1)


def test_metric_summary_reports_p50_p95_and_buffer_counts() -> None:
    samples = [
        MetricSample(
            planning_ms=float(value),
            execution_ms=float(value * 2),
            shared_hit_blocks=value * 3,
            shared_read_blocks=value * 4,
            temp_read_blocks=value * 5,
            temp_written_blocks=value * 6,
        )
        for value in range(1, 21)
    ]

    summary = metric_summary(samples)

    assert summary["planning_ms"] == {"p50": 10.5, "p95": 19.05}
    assert summary["execution_ms"] == {"p50": 21.0, "p95": 38.1}
    assert summary["total_query_ms"] == {"p50": 31.5, "p95": 57.15}
    assert summary["shared_hit_blocks"] == {"p50": 31.5, "p95": 57.15}
    assert summary["shared_read_blocks"] == {"p50": 42.0, "p95": 76.2}
    assert summary["temp_read_blocks"] == {"p50": 52.5, "p95": 95.25}
    assert summary["temp_written_blocks"] == {"p50": 63.0, "p95": 114.3}


def test_select_strategy_requires_reproducible_threshold_in_every_pass() -> None:
    baseline = CandidateEvidence(
        name="existing",
        p95_total_by_oracle_count={1: 1.0, 129: 10.0},
        largest_workload_p95_by_pass=(10.0, 10.0),
    )
    consistently_faster = CandidateEvidence(
        name="oracle_deck",
        p95_total_by_oracle_count={1: 1.02, 129: 8.0},
        largest_workload_p95_by_pass=(8.0, 8.4),
    )
    winner_flips = CandidateEvidence(
        name="deck_oracle_covering",
        p95_total_by_oracle_count={1: 0.9, 129: 7.5},
        largest_workload_p95_by_pass=(7.0, 9.0),
    )

    decision = select_strategy(
        baseline,
        (consistently_faster, winner_flips),
        minimum_improvement=0.15,
        maximum_small_workload_regression=0.05,
    )

    assert decision == {
        "selected_strategy": "oracle_deck",
        "reason": "reproducible_p95_improvement",
        "largest_workload_p95_total_improvement": 0.2,
    }


def test_select_strategy_returns_no_index_for_noise_or_small_workload_regression() -> None:
    baseline = CandidateEvidence(
        name="existing",
        p95_total_by_oracle_count={1: 1.0, 129: 10.0},
        largest_workload_p95_by_pass=(10.0, 10.0),
    )
    noisy = CandidateEvidence(
        name="oracle_deck",
        p95_total_by_oracle_count={1: 1.0, 129: 8.0},
        largest_workload_p95_by_pass=(7.5, 9.0),
    )
    regresses_small_loads = CandidateEvidence(
        name="deck_oracle_covering",
        p95_total_by_oracle_count={1: 1.2, 129: 8.0},
        largest_workload_p95_by_pass=(8.0, 8.0),
    )

    decision = select_strategy(
        baseline,
        (noisy, regresses_small_loads),
        minimum_improvement=0.15,
        maximum_small_workload_regression=0.05,
    )

    assert decision == {
        "selected_strategy": "no_new_index",
        "reason": "no_candidate_met_reproducibility_threshold",
        "largest_workload_p95_total_improvement": 0.0,
    }


def test_not_run_output_never_claims_an_index_selection() -> None:
    output = not_run_output("database_unavailable", "benchmark_not_run: refused")

    assert output["measurement_status"] == "not_run"
    assert output["query_identity"] == "deck_id_and_oracle_id_set"
    assert output["decision"] == {
        "selected_strategy": None,
        "reason": "database_unavailable",
        "largest_workload_p95_total_improvement": None,
    }
    assert output["transactional_cleanup"] == "not_started"
