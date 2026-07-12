from survail.core.types import JsonObject, json_object
from survail.modules.decks.evaluations.api.annotations_schemas import (
    RoleAnnotationLabelRead,
    RoleAnnotationLabelUpsert,
)
from survail.modules.decks.evaluations.service.role_rubrics import ROLE_RUBRICS


def validate_annotation_label(payload: RoleAnnotationLabelUpsert) -> RoleAnnotationLabelUpsert:
    for role in payload.roles:
        if role.role not in ROLE_RUBRICS:
            raise ValueError(f"Unknown role: {role.role}")
        valid_criteria = set(ROLE_RUBRICS[role.role])
        invalid = sorted(set(role.criteria) - valid_criteria)
        if invalid:
            joined = ", ".join(invalid)
            raise ValueError(f"Unknown criteria for {role.role}: {joined}")
    return payload


def label_to_json(payload: RoleAnnotationLabelUpsert) -> JsonObject:
    return json_object(payload.model_dump(mode="json"))


def label_from_json(payload: JsonObject | None) -> RoleAnnotationLabelRead | None:
    if payload is None:
        return None
    return RoleAnnotationLabelRead.model_validate(payload, strict=False)
