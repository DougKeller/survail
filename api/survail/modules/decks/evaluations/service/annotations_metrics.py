from collections import defaultdict
from dataclasses import dataclass
import uuid

from survail.modules.decks.evaluations.api.annotations_schemas import (
    CriterionMetricRead,
    MetricSummaryRead,
    RoleAnnotationLabelRead,
    SandboxExampleResultRead,
)
from survail.modules.decks.evaluations.service.role_rubrics import ROLE_NAMES

_RATING_ORDER = ["very_low", "low", "neutral", "high", "very_high"]
_CRITERION_MATCH_THRESHOLD = 0.75


@dataclass(frozen=True)
class AnnotationExample:
    capture_id: uuid.UUID
    oracle_id: str
    label: RoleAnnotationLabelRead
    output: dict[str, object]


@dataclass
class _Counts:
    tp: float = 0.0
    fp: float = 0.0
    tn: float = 0.0
    fn: float = 0.0
    count: int = 0
    partial_total: float = 0.0
    partial_count: int = 0


def _safe_divide(numerator: float, denominator: float) -> float | None:
    if denominator == 0:
        return None
    return round(numerator / denominator, 4)


def _metric_summary(counts: _Counts) -> MetricSummaryRead:
    return MetricSummaryRead(
        count=counts.count,
        accuracy=_safe_divide(counts.tp + counts.tn, counts.tp + counts.fp + counts.tn + counts.fn),
        recall=_safe_divide(counts.tp, counts.tp + counts.fn),
        specificity=_safe_divide(counts.tn, counts.tn + counts.fp),
        precision=_safe_divide(counts.tp, counts.tp + counts.fp),
        npv=_safe_divide(counts.tn, counts.tn + counts.fn),
        fpr=_safe_divide(counts.fp, counts.fp + counts.tn),
        fnr=_safe_divide(counts.fn, counts.fn + counts.tp),
        average_partial_credit=_safe_divide(counts.partial_total, counts.partial_count),
    )


def _predicted_roles(output: dict[str, object]) -> set[str]:
    return {role for role in ROLE_NAMES if output.get(role) != "N/A" and output.get(role) is not None}


def _criterion_score(expected: str, actual: str) -> float:
    distance = abs(_RATING_ORDER.index(expected) - _RATING_ORDER.index(actual))
    return max(0.0, 1.0 - (0.25 * distance))


def evaluate_annotation_examples(
    examples: list[AnnotationExample],
) -> tuple[MetricSummaryRead, dict[str, MetricSummaryRead], list[CriterionMetricRead], list[SandboxExampleResultRead]]:
    overall = _Counts()
    by_role: dict[str, _Counts] = defaultdict(_Counts)
    by_criterion: dict[tuple[str, str], _Counts] = defaultdict(_Counts)
    results: list[SandboxExampleResultRead] = []

    for example in examples:
        expected_roles = {item.role for item in example.label.roles}
        predicted_roles = _predicted_roles(example.output)
        role_states: dict[str, str] = {}

        for role in ROLE_NAMES:
            expected = role in expected_roles
            predicted = role in predicted_roles
            overall.count += 1
            by_role[role].count += 1
            if expected and predicted:
                overall.tp += 1
                by_role[role].tp += 1
                role_states[role] = "matched"
            elif expected:
                overall.fn += 1
                by_role[role].fn += 1
                role_states[role] = "missing"
            elif predicted:
                overall.fp += 1
                by_role[role].fp += 1
                role_states[role] = "extra"
            else:
                overall.tn += 1
                by_role[role].tn += 1

        partial_scores: list[float] = []
        labeled_roles = {item.role: item for item in example.label.roles}
        for role, role_label in labeled_roles.items():
            predicted = example.output.get(role)
            if not isinstance(predicted, dict):
                continue
            predicted_answers = predicted.get("answers")
            if not isinstance(predicted_answers, dict):
                continue
            for criterion, criterion_label in role_label.criteria.items():
                actual = predicted_answers.get(criterion)
                if not isinstance(actual, str):
                    continue
                score = _criterion_score(criterion_label.expected_rating, actual)
                counts = by_criterion[(role, criterion)]
                counts.count += 1
                counts.partial_total += score
                counts.partial_count += 1
                if score >= _CRITERION_MATCH_THRESHOLD:
                    counts.tp += 1.0
                else:
                    counts.fn += 1.0
                partial_scores.append(score)

        results.append(
            SandboxExampleResultRead(
                capture_id=example.capture_id,
                oracle_id=example.oracle_id,
                predicted_roles=sorted(predicted_roles),
                expected_roles=sorted(expected_roles),
                role_metrics=role_states,
                criterion_partial_credit=(
                    round(sum(partial_scores) / len(partial_scores), 4) if partial_scores else None
                ),
            )
        )

    criterion_metrics = [
        CriterionMetricRead(role=role, criterion=criterion, metrics=_metric_summary(counts))
        for (role, criterion), counts in sorted(by_criterion.items())
    ]
    role_metrics = {role: _metric_summary(counts) for role, counts in sorted(by_role.items())}
    return _metric_summary(overall), role_metrics, criterion_metrics, results
