import hashlib
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from survail.core.models import CardRoleAnnotationCapture, CardRoleEvaluation, CardRoleSandboxRun, Deck, User
from survail.core.types import json_object
from survail.modules.decks.evaluations.api.annotations_schemas import (
    RoleAnnotationCaptureRead,
    RoleAnnotationLabelRead,
    RoleAnnotationLabelUpsert,
    RoleAnnotationQueueRead,
    SandboxRunCreate,
    SandboxRunRead,
)
from survail.modules.decks.evaluations.service.annotations_labels import (
    label_from_json,
    label_to_json,
    validate_annotation_label,
)
from survail.modules.decks.evaluations.service.annotations_metrics import (
    AnnotationExample,
    evaluate_annotation_examples,
)
from survail.modules.decks.repository.decks import DeckRepository

if TYPE_CHECKING:
    from survail.modules.decks.evaluations.service.evaluator import OpenAIRoleEvaluator

MAX_UNLABELED_CAPTURES = 100


def capture_role_annotation(
    db: Session,
    deck: Deck,
    evaluation: CardRoleEvaluation,
    *,
    model: str,
    system_prompt: str,
    input_text: str,
    prompt_hash: str,
    output: dict[str, object],
) -> None:
    existing = db.scalar(
        select(CardRoleAnnotationCapture).where(
            CardRoleAnnotationCapture.deck_id == deck.id,
            CardRoleAnnotationCapture.context_key == evaluation.context_key,
            CardRoleAnnotationCapture.evaluator_version == evaluation.evaluator_version,
            CardRoleAnnotationCapture.prompt_hash == prompt_hash,
        )
    )
    if existing is None:
        db.add(
            CardRoleAnnotationCapture(
                owner_id=deck.owner_id,
                deck_id=deck.id,
                evaluation_id=evaluation.id,
                deck_revision=evaluation.deck_revision,
                context_key=evaluation.context_key,
                evaluator_version=evaluation.evaluator_version,
                oracle_id=evaluation.oracle_id,
                model=model,
                prompt_hash=prompt_hash,
                system_prompt=system_prompt,
                input_text=input_text,
                output=json_object(output),
            )
        )
    _prune_unlabeled_captures(db)


def prompt_hash(system_prompt: str, input_text: str, model: str) -> str:
    return hashlib.sha256(f"{model}\0{system_prompt}\0{input_text}".encode()).hexdigest()


def _prune_unlabeled_captures(db: Session) -> None:
    unlabeled_ids = list(
        db.scalars(
            select(CardRoleAnnotationCapture.id)
            .where(CardRoleAnnotationCapture.labeled_at.is_(None))
            .order_by(CardRoleAnnotationCapture.created_at.asc())
        )
    )
    overflow = len(unlabeled_ids) - MAX_UNLABELED_CAPTURES
    if overflow <= 0:
        return
    db.execute(
        delete(CardRoleAnnotationCapture).where(
            CardRoleAnnotationCapture.id.in_(unlabeled_ids[:overflow])
        )
    )


def _capture_read(capture: CardRoleAnnotationCapture) -> RoleAnnotationCaptureRead:
    return RoleAnnotationCaptureRead(
        id=capture.id,
        deck_id=capture.deck_id,
        oracle_id=capture.oracle_id,
        deck_revision=capture.deck_revision,
        evaluator_version=capture.evaluator_version,
        model=capture.model,
        system_prompt=capture.system_prompt,
        input_text=capture.input_text,
        output=dict(capture.output),
        created_at=capture.created_at,
        labeled_at=capture.labeled_at,
        label=label_from_json(capture.label),
    )


class RoleAnnotationService:
    def __init__(self, db: Session) -> None:
        self._db = db
        self._decks = DeckRepository(db)

    def queue(self, user: User, deck_id: uuid.UUID) -> RoleAnnotationQueueRead:
        deck = self._owned_deck(user, deck_id)
        unlabeled = list(
            self._db.scalars(
                select(CardRoleAnnotationCapture)
                .where(
                    CardRoleAnnotationCapture.owner_id == user.id,
                    CardRoleAnnotationCapture.deck_id == deck.id,
                    CardRoleAnnotationCapture.labeled_at.is_(None),
                )
                .order_by(CardRoleAnnotationCapture.created_at.asc())
            )
        )
        labeled = list(
            self._db.scalars(
                select(CardRoleAnnotationCapture)
                .where(
                    CardRoleAnnotationCapture.owner_id == user.id,
                    CardRoleAnnotationCapture.deck_id == deck.id,
                    CardRoleAnnotationCapture.labeled_at.is_not(None),
                )
                .order_by(CardRoleAnnotationCapture.labeled_at.desc())
                .limit(100)
            )
        )
        return RoleAnnotationQueueRead(
            unlabeled=[_capture_read(item) for item in unlabeled],
            labeled=[_capture_read(item) for item in labeled],
        )

    def label(
        self, user: User, deck_id: uuid.UUID, capture_id: uuid.UUID, payload: RoleAnnotationLabelUpsert
    ) -> RoleAnnotationCaptureRead:
        deck = self._owned_deck(user, deck_id)
        capture = self._owned_capture(user, deck.id, capture_id)
        validated = validate_annotation_label(payload)
        capture.label = label_to_json(validated)
        capture.labeled_at = datetime.now(timezone.utc)
        self._db.add(capture)
        self._db.commit()
        self._db.refresh(capture)
        return _capture_read(capture)

    async def run_sandbox(
        self, user: User, deck_id: uuid.UUID, payload: SandboxRunCreate, evaluator: "OpenAIRoleEvaluator"
    ) -> SandboxRunRead:
        deck = self._owned_deck(user, deck_id)
        captures = list(
            self._db.scalars(
                select(CardRoleAnnotationCapture)
                .where(
                    CardRoleAnnotationCapture.owner_id == user.id,
                    CardRoleAnnotationCapture.deck_id == deck.id,
                    CardRoleAnnotationCapture.labeled_at.is_not(None),
                )
                .order_by(CardRoleAnnotationCapture.labeled_at.asc())
            )
        )
        examples: list[AnnotationExample] = []
        for capture in captures:
            label = label_from_json(capture.label)
            if label is None:
                continue
            request = evaluator.build_request(
                deck,
                capture.oracle_id,
                _card_context_from_input(capture.input_text),
                system_prompt=payload.system_prompt,
            )
            parsed = await evaluator.evaluate_request(request)
            examples.append(
                AnnotationExample(
                    capture_id=capture.id,
                    oracle_id=capture.oracle_id,
                    label=label,
                    output=parsed.model_dump(mode="json"),
                )
            )
        overall, role_metrics, criterion_metrics, results = evaluate_annotation_examples(examples)
        run = CardRoleSandboxRun(
            owner_id=user.id,
            deck_id=deck.id,
            model=payload.model,
            prompt_hash=prompt_hash(payload.system_prompt, deck.id.hex, payload.model),
            system_prompt=payload.system_prompt,
            example_count=len(examples),
            metrics=json_object(
                {
                    "overall_role_metrics": overall.model_dump(mode="json"),
                    "role_metrics": {
                        role: metrics.model_dump(mode="json") for role, metrics in role_metrics.items()
                    },
                    "criterion_metrics": [
                        item.model_dump(mode="json") for item in criterion_metrics
                    ],
                }
            ),
            results=[json_object(item.model_dump(mode="json")) for item in results],
        )
        self._db.add(run)
        self._db.commit()
        self._db.refresh(run)
        return SandboxRunRead(
            id=run.id,
            model=run.model,
            system_prompt=run.system_prompt,
            example_count=run.example_count,
            created_at=run.created_at,
            overall_role_metrics=overall,
            role_metrics=role_metrics,
            criterion_metrics=criterion_metrics,
            results=results,
        )

    def _owned_capture(
        self, user: User, deck_id: uuid.UUID, capture_id: uuid.UUID
    ) -> CardRoleAnnotationCapture:
        capture = self._db.scalar(
            select(CardRoleAnnotationCapture).where(
                CardRoleAnnotationCapture.id == capture_id,
                CardRoleAnnotationCapture.owner_id == user.id,
                CardRoleAnnotationCapture.deck_id == deck_id,
            )
        )
        if capture is None:
            raise LookupError("Annotation capture not found")
        return capture

    def _owned_deck(self, user: User, deck_id: uuid.UUID) -> Deck:
        deck = self._decks.owned(user.id, deck_id)
        if deck is None:
            raise LookupError("Deck not found")
        return deck


def _card_context_from_input(input_text: str) -> str:
    marker = "Card under evaluation:\n"
    _, _, card_context = input_text.partition(marker)
    if card_context == "":
        raise ValueError("Stored annotation capture is missing card context")
    before_rubrics = card_context.split("\n\nRole rubrics:\n", maxsplit=1)[0]
    return before_rubrics.strip()
