"""GEPA optimization adapter for the unchanged judge golden JSON datasets."""

from __future__ import annotations

import json
import re
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path

import dspy
import gepa
from gepa.core.adapter import ProposalFn
from gepa.strategies.instruction_proposal import InstructionProposalSignature

from survail.modules.decks.evaluations.api.schemas import CardRoleScoreRead
from survail.modules.decks.evaluations.service.dspy_program import (
    RoleEvaluationProgram,
    configure_lm,
)
from survail.modules.decks.evaluations.service.evaluator import (
    ROLE_NAMES,
    StructuredLLMaaJ,
    _calculate_overall_score,
    _card_brief,
    _evaluation_input_with_rubrics,
    _evaluation_instructions,
    _is_land_card_context,
    _referenced_card_context,
    _role_json,
    _role_score_from_llmaaj,
    _validate_llmaaj,
)

PROGRAM_PATH = Path(__file__).resolve().parent / "judge_eval_program.json"
LEGACY_RUN_DIR = Path(__file__).resolve().parent / "judge_eval_gepa_run"
RUNS_DIR = Path(__file__).resolve().parent / "judge_eval_gepa_runs"
CHECKPOINT_NAME = "gepa_state.bin"
MAX_PROMPT_REPAIR_ATTEMPTS = 2


class InvalidInstructionProposalError(RuntimeError):
    """GEPA reflection could not produce an instruction that passes hard constraints."""


def _reflection_text(prompt: str) -> str:
    lm = dspy.settings.lm
    if lm is None:
        raise RuntimeError("A reflection LM must be active while proposing instructions")
    outputs = lm(prompt)
    if not outputs:
        raise RuntimeError("The reflection LM returned no instruction proposal")
    output = outputs[0]
    if isinstance(output, str):
        return output
    if isinstance(output, dict) and isinstance(output.get("text"), str):
        return output["text"]
    raise TypeError("The reflection LM returned an unsupported output type")


def _propose_instruction(current: str, examples: list[dict[str, object]]) -> str:
    return InstructionProposalSignature.run(
        lm=_reflection_text,
        input_dict={
            "current_instruction_doc": current,
            "dataset_with_feedback": examples,
            "prompt_template": None,
        },
    )["new_instruction"]


def _repair_instruction(proposal: str, leaks: list[str]) -> str:
    repair_prompt = f"""Rewrite the evaluator instructions below so they contain no labeled
card names.
The prohibited strings found by the validator are: {json.dumps(leaks)}.
Replace them with mechanics-based descriptions of what a card does. Do not add named examples,
proper-name shortcuts, or dataset-specific identifiers. Preserve the useful general decision rules.
Return only the complete revised instructions inside triple backticks.

```\n{proposal}\n```
"""
    return InstructionProposalSignature.output_extractor(_reflection_text(repair_prompt))[
        "new_instruction"
    ]


def validating_instruction_proposer(
    prohibited_names: set[str],
    *,
    max_repair_attempts: int = MAX_PROMPT_REPAIR_ATTEMPTS,
) -> ProposalFn:
    """Propose instructions, repairing or rejecting leaks before evaluator rollouts."""

    def propose(
        *,
        candidate: dict[str, str],
        reflective_dataset: dict[str, list[dict[str, object]]],
        components_to_update: list[str],
    ) -> dict[str, str]:
        proposals: dict[str, str] = {}
        for component in components_to_update:
            proposal = _propose_instruction(
                candidate[component],
                reflective_dataset[component],
            )
            for attempt in range(max_repair_attempts + 1):
                leaks = card_name_leaks(proposal, prohibited_names)
                if not leaks:
                    proposals[component] = proposal
                    break
                if attempt == max_repair_attempts:
                    raise InvalidInstructionProposalError(
                        "Instruction proposal still contains labeled card names after repair: "
                        + ", ".join(leaks)
                    )
                proposal = _repair_instruction(proposal, leaks)
        return proposals

    return propose


def _result_payload(raw: object, card_context: str) -> dict[str, object]:
    evaluation = StructuredLLMaaJ.model_validate(raw)
    _validate_llmaaj(evaluation)
    is_land = _is_land_card_context(card_context)
    raw_scores = [
        score
        for role in ROLE_NAMES
        if (score := _role_score_from_llmaaj(role, evaluation, is_land=is_land)) is not None
    ]
    roles = [
        CardRoleScoreRead.model_validate(_role_json(score), strict=False) for score in raw_scores
    ]
    return {
        "roles": [role.model_dump(mode="json") for role in roles],
        "overall_score": _calculate_overall_score(roles),
    }


def golden_metric(
    gold: dspy.Example,
    pred: dspy.Prediction,
    trace: object | None = None,
    pred_name: str | None = None,
    pred_trace: object | None = None,
) -> dspy.Prediction:
    """Return a score plus behavior-based feedback suitable for GEPA reflection."""

    del trace, pred_name, pred_trace
    from scripts.judge_eval import card_failures

    try:
        result = _result_payload(pred.evaluation, gold.card_context)
        failures = card_failures(gold.expectation, result)
    except (TypeError, ValueError, AttributeError) as error:
        return dspy.Prediction(
            score=0.0,
            feedback=(
                f"The structured evaluation was invalid: {error}. Correct the output schema. "
                "Keep all guidelines behavior-based and never encode individual card names."
            ),
        )
    if not failures:
        return dspy.Prediction(
            score=1.0,
            feedback=(
                "All labeled behavioral constraints passed. Preserve the mechanics-based "
                "reasoning and never encode individual card names in the instructions."
            ),
        )
    return dspy.Prediction(
        score=1.0 / (1.0 + len(failures)),
        feedback=(
            "Behavioral constraint failures: "
            + "; ".join(failures)
            + ". Fix the general decision rule without naming or memorizing any card."
        ),
    )


def load_examples() -> list[dspy.Example]:
    """Adapt the existing deck, snapshot, and golden files in memory only."""

    from scripts.judge_eval import (
        GOLDEN_PATH,
        SNAPSHOTS_PATH,
        build_deck,
        catalog_session,
        load_specs,
    )

    golden = json.loads(GOLDEN_PATH.read_text())
    snapshots = json.loads(SNAPSHOTS_PATH.read_text())
    specs = {spec["title"]: spec for spec in load_specs()}
    db = catalog_session()
    examples: list[dspy.Example] = []
    for deck_title, deck_labels in golden["decks"].items():
        deck = build_deck(specs[deck_title], snapshots)
        cardsets_by_name = {cardset.card_name: cardset for cardset in deck.cardsets}
        for card_name, expectation in deck_labels["cards"].items():
            cardset = cardsets_by_name[card_name]
            card_context = _card_brief([cardset])
            references = _referenced_card_context(db, deck, cardset.oracle_id)
            context = _evaluation_input_with_rubrics(
                deck, cardset.oracle_id, card_context, references
            )
            examples.append(
                dspy.Example(
                    evaluation_context=context,
                    card_context=card_context,
                    expectation=expectation,
                    deck_title=deck_title,
                    card_name=card_name,
                ).with_inputs("evaluation_context")
            )
    return examples


def split_examples(
    examples: Iterable[dspy.Example],
) -> tuple[list[dspy.Example], list[dspy.Example]]:
    """Make a deterministic 80/20 split within each deck without editing labels."""

    trainset: list[dspy.Example] = []
    valset: list[dspy.Example] = []
    positions: dict[str, int] = {}
    for example in examples:
        position = positions.get(example.deck_title, 0)
        positions[example.deck_title] = position + 1
        (valset if position % 5 == 0 else trainset).append(example)
    return trainset, valset


def _instructions(program: RoleEvaluationProgram) -> str:
    return str(program.evaluate.signature.instructions)


def card_name_leaks(instructions: str, names: Iterable[str]) -> list[str]:
    folded = instructions.casefold()
    return sorted(name for name in names if name.casefold() in folded)


def resolve_run_dir(
    *,
    resume: bool,
    runs_dir: Path = RUNS_DIR,
    legacy_run_dir: Path = LEGACY_RUN_DIR,
    now: datetime | None = None,
) -> Path:
    """Create a fresh managed run directory or select the latest checkpoint."""

    if resume:
        managed_runs = list(runs_dir.iterdir()) if runs_dir.exists() else []
        candidates = [
            path
            for path in [legacy_run_dir, *managed_runs]
            if path.is_dir() and (path / CHECKPOINT_NAME).is_file()
        ]
        if not candidates:
            raise RuntimeError(
                "--resume was requested, but no GEPA checkpoint was found under "
                f"{runs_dir} or {legacy_run_dir}"
            )
        return max(candidates, key=lambda path: (path / CHECKPOINT_NAME).stat().st_mtime_ns)

    runs_dir.mkdir(parents=True, exist_ok=True)
    timestamp = (now or datetime.now(UTC)).astimezone(UTC).strftime("%Y%m%dT%H%M%S.%fZ")
    run_dir = runs_dir / timestamp
    suffix = 2
    while run_dir.exists():
        run_dir = runs_dir / f"{timestamp}-{suffix}"
        suffix += 1
    run_dir.mkdir()
    return run_dir


def optimize_evaluator(
    *,
    api_key: str,
    task_model: str,
    reflection_model: str,
    max_metric_calls: int,
    output_path: Path = PROGRAM_PATH,
    resume: bool = False,
    run_dir: Path | None = None,
) -> Path:
    if not callable(gepa.optimize):
        raise RuntimeError("The installed GEPA package does not expose its optimizer")
    examples = load_examples()
    trainset, valset = split_examples(examples)
    task_lm = configure_lm(
        task_model,
        api_key,
        max_tokens=1000,
        num_retries=8,
    )
    reflection_lm = configure_lm(
        reflection_model,
        api_key,
        max_tokens=16000,
        num_retries=8,
        temperature=1.0,
    )
    program = RoleEvaluationProgram(StructuredLLMaaJ, _evaluation_instructions())
    names = {
        match.group(1).strip()
        for example in examples
        for match in re.finditer(r"^Name: (.+)$", example.evaluation_context, re.MULTILINE)
    }
    names.update(example.card_name for example in examples)
    seed_leaks = card_name_leaks(_instructions(program), names)
    if seed_leaks:
        raise RuntimeError("Seed instructions contain card names: " + ", ".join(seed_leaks))
    dspy.configure(lm=task_lm)
    if run_dir is None:
        run_dir = resolve_run_dir(resume=resume)
    else:
        run_dir.mkdir(parents=True, exist_ok=True)
    action = "Resuming" if resume else "Starting"
    print(f"{action} GEPA run in {run_dir}", flush=True)
    optimizer = dspy.GEPA(
        metric=golden_metric,
        max_metric_calls=max_metric_calls,
        reflection_lm=reflection_lm,
        instruction_proposer=validating_instruction_proposer(names),
        log_dir=str(run_dir),
        track_stats=True,
        num_threads=2,
    )
    optimized = optimizer.compile(program, trainset=trainset, valset=valset)
    leaks = card_name_leaks(_instructions(optimized), names)
    if leaks:
        raise RuntimeError(
            "GEPA produced card-name-specific instructions; artifact was not saved: "
            + ", ".join(leaks)
        )
    optimized.save(str(output_path))
    return output_path
