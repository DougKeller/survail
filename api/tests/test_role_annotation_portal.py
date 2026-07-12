import uuid

import pytest

from survail.modules.decks.evaluations.api.annotations_schemas import (
    RoleAnnotationLabelUpsert,
    RoleLabel,
)
from survail.modules.decks.evaluations.service.annotations import _card_context_from_input
from survail.modules.decks.evaluations.service.annotations_labels import (
    label_from_json,
    label_to_json,
    validate_annotation_label,
)
from survail.modules.decks.evaluations.service.annotations_metrics import (
    AnnotationExample,
    evaluate_annotation_examples,
)


def test_annotation_label_rejects_unknown_criterion() -> None:
    payload = RoleAnnotationLabelUpsert(
        roles=[
            RoleLabel(
                role="card_advantage",
                criteria={
                    "not_real": {
                        "expected_rating": "high",
                        "acceptable_min": "high",
                        "acceptable_max": "high",
                    }
                },
            )
        ]
    )

    with pytest.raises(ValueError, match="Unknown criteria for card_advantage: not_real"):
        validate_annotation_label(payload)


def test_annotation_label_round_trips_json() -> None:
    payload = RoleAnnotationLabelUpsert(
        roles=[
            RoleLabel(
                role="interaction",
                notes="Instant-speed removal.",
                criteria={
                    "efficiency": {
                        "expected_rating": "high",
                        "acceptable_min": "neutral",
                        "acceptable_max": "very_high",
                    }
                },
            )
        ]
    )

    encoded = label_to_json(payload)
    decoded = label_from_json(encoded)

    assert decoded is not None
    assert decoded.roles[0].role == "interaction"
    assert decoded.roles[0].criteria["efficiency"].acceptable_max == "very_high"


def test_annotation_metrics_compute_role_and_partial_credit() -> None:
    label = RoleAnnotationLabelUpsert(
        roles=[
            RoleLabel(
                role="card_advantage",
                criteria={
                    "efficiency": {
                        "expected_rating": "high",
                        "acceptable_min": "high",
                        "acceptable_max": "high",
                    }
                },
            )
        ]
    )
    overall, by_role, criterion_metrics, results = evaluate_annotation_examples(
        [
            AnnotationExample(
                capture_id=uuid.uuid4(),
                oracle_id="oracle-1",
                label=label_from_json(label_to_json(label)),
                output={
                    "land": "N/A",
                    "mana_ramp": "N/A",
                    "card_advantage": {
                        "description": "Draws cards.",
                        "answers": {
                            "efficiency": "very_high",
                            "reliability": "high",
                            "card_quality": "high",
                            "repeatability": "high",
                            "floor": "high",
                        },
                    },
                    "selection_tutor": "N/A",
                    "interaction": {
                        "description": "Incidental removal.",
                        "answers": {
                            "efficiency": "neutral",
                            "coverage": "neutral",
                            "permanence": "neutral",
                            "timing": "neutral",
                            "flexibility": "neutral",
                        },
                    },
                    "board_control": "N/A",
                    "protection": "N/A",
                    "engine_enabler": "N/A",
                    "engine_support": "N/A",
                    "payoff": "N/A",
                    "overall_summary": "Useful draw spell.",
                },
            )
        ]
    )

    assert overall.accuracy == 0.9
    assert by_role["card_advantage"].recall == 1.0
    assert by_role["interaction"].precision == 0.0
    assert criterion_metrics[0].metrics.average_partial_credit == 0.75
    assert criterion_metrics[0].metrics.precision == 1.0
    assert criterion_metrics[0].metrics.recall == 1.0
    assert results[0].criterion_partial_credit == 0.75
    assert results[0].role_metrics["card_advantage"] == "matched"
    assert results[0].role_metrics["interaction"] == "extra"


def test_annotation_criterion_threshold_requires_at_least_point_seventy_five() -> None:
    label = RoleAnnotationLabelUpsert(
        roles=[
            RoleLabel(
                role="card_advantage",
                criteria={
                    "efficiency": {
                        "expected_rating": "high",
                        "acceptable_min": "high",
                        "acceptable_max": "high",
                    }
                },
            )
        ]
    )
    _, _, criterion_metrics, results = evaluate_annotation_examples(
        [
            AnnotationExample(
                capture_id=uuid.uuid4(),
                oracle_id="oracle-1",
                label=label_from_json(label_to_json(label)),
                output={
                    "land": "N/A",
                    "mana_ramp": "N/A",
                    "card_advantage": {
                        "description": "Draws cards.",
                        "answers": {
                            "efficiency": "low",
                            "reliability": "high",
                            "card_quality": "high",
                            "repeatability": "high",
                            "floor": "high",
                        },
                    },
                    "selection_tutor": "N/A",
                    "interaction": "N/A",
                    "board_control": "N/A",
                    "protection": "N/A",
                    "engine_enabler": "N/A",
                    "engine_support": "N/A",
                    "payoff": "N/A",
                    "overall_summary": "Useful draw spell.",
                },
            )
        ]
    )

    assert criterion_metrics[0].metrics.average_partial_credit == 0.5
    assert criterion_metrics[0].metrics.precision is None
    assert criterion_metrics[0].metrics.recall == 0.0
    assert results[0].criterion_partial_credit == 0.5


def test_card_context_extraction_uses_stored_input_shape() -> None:
    card_context = _card_context_from_input(
        "North Star:\nGoal\n\nCard under evaluation:\nName: Sol Ring\nType: Artifact\n\nRole rubrics:\n{}"
    )

    assert card_context == "Name: Sol Ring\nType: Artifact"
