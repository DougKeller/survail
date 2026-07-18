"""Standalone LLM-as-a-judge evaluation harness for the card role evaluator.

Runs the production evaluator (rubrics, prompt, structured output, gating)
against curated deck specs without the web app or a database, so rubric and
prompt changes can be judged on real model output and regression-checked
against a golden expectations file. Multiple spot-check decks are supported:
the spec file holds a list of decks, snapshots are one global name-keyed
file shared by all decks, and results/golden files are keyed by deck title.

Usage (from api/, with the project venv):
    .venv/bin/python scripts/judge_eval.py extract   # bulk data -> snapshots
    .venv/bin/python scripts/judge_eval.py run       # evaluate (needs API key)
    .venv/bin/python scripts/judge_eval.py check     # results vs golden file
    .venv/bin/python scripts/judge_eval.py run --only "Sol Ring" "Ponder"

The OpenAI key is read from OPENAI_API_KEY, falling back to the repo root
.env. Results land in scripts/judge_eval_results.json.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Iterable

SCRIPT_DIR = Path(__file__).resolve().parent
API_DIR = SCRIPT_DIR.parent
ROOT_DIR = API_DIR.parent
sys.path.insert(0, str(API_DIR))

from survail.core.models import CardSet, CardZone, Deck, DeckFormat  # noqa: E402
from survail.integrations.scryfall.client import UpstreamCard  # noqa: E402
from survail.modules.decks.evaluations.service.evaluator import (  # noqa: E402
    EvaluationProgress,
    OpenAIRoleEvaluator,
    evaluate_oracle_ids,
)

BULK_PATH = ROOT_DIR / "data" / "all-cards.json"
SPEC_PATH = SCRIPT_DIR / "judge_eval_deck.json"
SNAPSHOTS_PATH = SCRIPT_DIR / "judge_eval_snapshots.json"
RESULTS_PATH = SCRIPT_DIR / "judge_eval_results.json"
GOLDEN_PATH = SCRIPT_DIR / "judge_eval_golden.json"
SKIP_LAYOUTS = {"art_series", "token", "double_faced_token", "emblem", "scheme", "vanguard"}


class CatalogReadSession:
    """Real catalog reads, suppressed writes and evaluation cache.

    Referenced-card resolution must go through the full card database, so the
    harness reads the live catalog through a real Session. Writes are no-ops
    (harness runs never persist) and the evaluation-cache query is forced empty
    so every run re-evaluates from scratch.
    """

    def __init__(self, session: object) -> None:
        self._session = session

    def scalar(self, statement: object) -> object:
        return self._session.scalar(statement)  # type: ignore[attr-defined]

    def get(self, *args: object, **kwargs: object) -> object:
        return self._session.get(*args, **kwargs)  # type: ignore[attr-defined]

    def scalars(self, statement: object) -> list[object]:
        del statement
        return []

    def add(self, instance: object) -> None:
        del instance

    def flush(self) -> None:
        pass

    def commit(self) -> None:
        pass


def catalog_session() -> CatalogReadSession:
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session as OrmSession

    from survail.core.config import get_settings

    try:
        engine = create_engine(get_settings().database_url)
        session = OrmSession(engine)
        count = session.scalar(text("select count(*) from catalog_cards"))
    except Exception as error:  # noqa: BLE001 - surfaced as a clear harness failure
        raise SystemExit(
            f"Card catalog is unavailable; the harness needs the dev database to "
            f"resolve referenced cards ({error})."
        ) from error
    if not count:
        raise SystemExit(
            "Card catalog is empty; run `python -m survail.catalog_import` before evaluating."
        )
    return CatalogReadSession(session)


def load_specs() -> list[dict]:
    return json.loads(SPEC_PATH.read_text())["decks"]


def spec_names(specs: list[dict]) -> list[str]:
    names = []
    for spec in specs:
        names.extend(entry["name"] for entry in spec["commander"] + spec["mainboard"])
    return list(dict.fromkeys(names))


def extract_snapshots() -> None:
    wanted = spec_names(load_specs())
    existing: dict[str, dict] = {}
    if SNAPSHOTS_PATH.exists():
        existing = json.loads(SNAPSHOTS_PATH.read_text())
    found = {name: existing[name] for name in wanted if name in existing}
    needles = {name: f'"name":"{name}","' for name in wanted if name not in found}
    scanned = 0
    if needles:
        with BULK_PATH.open(encoding="utf-8") as bulk:
            for line in bulk:
                scanned += 1
                if len(found) == len(wanted):
                    break
                for name, needle in needles.items():
                    if name in found or needle not in line:
                        continue
                    record = json.loads(line.rstrip().rstrip(","))
                    if record.get("lang") != "en" or record.get("digital"):
                        continue
                    if record.get("layout") in SKIP_LAYOUTS or record.get("oversized"):
                        continue
                    if record.get("name") != name or not record.get(
                        "oracle_text", record.get("card_faces")
                    ):
                        continue
                    snapshot = UpstreamCard.model_validate(record).snapshot()
                    found[name] = snapshot.model_dump(mode="json")
                    print(f"[{len(found)}/{len(wanted)}] {name} ({record['set']})", flush=True)
    missing = [name for name in wanted if name not in found]
    if missing:
        raise SystemExit(f"Missing cards after scanning {scanned} lines: {missing}")
    SNAPSHOTS_PATH.write_text(json.dumps(found, indent=2, sort_keys=True) + "\n")
    reused = len(wanted) - len(needles)
    print(f"Wrote {len(found)} snapshots to {SNAPSHOTS_PATH} ({reused} reused, {len(needles)} scanned)")


def build_deck(spec: dict, snapshots: dict[str, dict]) -> Deck:
    deck = Deck(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        title=spec["title"],
        format=DeckFormat(spec["format"]),
        description="",
        goal=spec["goal"],
        metadata_json={"kind": "commander"},
        revision=1,
    )
    cardsets = []
    for zone, entries in (
        (CardZone.COMMANDER, spec["commander"]),
        (CardZone.MAINBOARD, spec["mainboard"]),
    ):
        for entry in entries:
            snapshot = snapshots[entry["name"]]
            cardsets.append(
                CardSet(
                    id=uuid.uuid4(),
                    deck_id=deck.id,
                    zone=zone,
                    quantity=entry["quantity"],
                    printing_id=snapshot["id"],
                    oracle_id=snapshot["oracle_id"],
                    card_name=snapshot["name"],
                    core=False,
                    note=entry.get("note"),
                    scryfall=snapshot,
                )
            )
    deck.cardsets = cardsets
    return deck


def api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        for line in (ROOT_DIR / ".env").read_text().splitlines():
            if line.startswith("OPENAI_API_KEY="):
                key = line.partition("=")[2].strip()
    if not key:
        raise SystemExit("OPENAI_API_KEY not found in environment or root .env")
    return key


def evaluation_model() -> str:
    if value := os.environ.get("OPENAI_ROLE_EVALUATION_MODEL"):
        return value
    from survail.core.config import get_settings

    return get_settings().openai_role_evaluation_model


async def run_evaluations(only: list[str] | None) -> None:
    specs = load_specs()
    snapshots = json.loads(SNAPSHOTS_PATH.read_text())
    plan: list[tuple[dict, list[str]]] = []
    matched: set[str] = set()
    for spec in specs:
        names = [name for name in spec["evaluate"] if only is None or name in only]
        matched.update(names)
        if names:
            plan.append((spec, names))
    if only:
        unmatched = [name for name in only if name not in matched]
        if unmatched:
            raise SystemExit(f"Not in any deck's evaluate list: {unmatched}")
    unknown = sorted({name for _, names in plan for name in names if name not in snapshots})
    if unknown:
        raise SystemExit(f"Not in snapshots (run extract): {unknown}")

    model = evaluation_model()
    evaluator = OpenAIRoleEvaluator(api_key(), model)

    async def progress(update: EvaluationProgress) -> None:
        print(f"  progress {update.completed}/{update.total}", flush=True)

    db = catalog_session()
    merged: dict[str, dict[str, dict]] = {}
    if only and RESULTS_PATH.exists():
        merged = json.loads(RESULTS_PATH.read_text()).get("decks", {})
    written = 0
    for spec, names in plan:
        deck = build_deck(spec, snapshots)
        oracle_ids = [snapshots[name]["oracle_id"] for name in names]
        by_oracle = {snapshots[name]["oracle_id"]: name for name in names}
        print(f"Evaluating {len(oracle_ids)} cards from '{spec['title']}' with {model}...", flush=True)
        results = await evaluate_oracle_ids(db, deck, oracle_ids, evaluator, progress)
        deck_results = merged.setdefault(spec["title"], {})
        for result in results:
            payload = result.model_dump(mode="json")
            payload["card_name"] = by_oracle[result.oracle_id]
            deck_results[payload["card_name"]] = payload
        written += len(results)
        # Persist after each deck so a mid-run failure keeps completed decks.
        RESULTS_PATH.write_text(
            json.dumps({"model": model, "decks": merged}, indent=2, sort_keys=True) + "\n"
        )
        for result in results:
            name = by_oracle[result.oracle_id]
            roles = ", ".join(f"{r.role}={r.score}" for r in result.roles) or "(no roles)"
            print(f"  {name}: overall={result.overall_score} {roles}")
    output = {"model": model, "decks": merged}
    RESULTS_PATH.write_text(json.dumps(output, indent=2, sort_keys=True) + "\n")
    print(f"Wrote {written} evaluations to {RESULTS_PATH}")


def card_failures(expectation: dict, result: dict | None) -> list[str]:
    if result is None:
        return ["no result recorded"]
    failures: list[str] = []
    roles = {entry["role"]: entry["score"] for entry in result["roles"]}
    answers = {entry["role"]: entry.get("answers", {}) for entry in result["roles"]}
    for role in expectation.get("must_roles", []):
        if role not in roles:
            failures.append(f"expected role '{role}' missing (got {sorted(roles)})")
    for role in expectation.get("forbid_roles", []):
        if role in roles:
            failures.append(f"forbidden role '{role}' present (score {roles[role]})")
    for role, (low, high) in expectation.get("role_score_ranges", {}).items():
        if role in roles and not low <= roles[role] <= high:
            failures.append(f"{role} score {roles[role]} outside [{low}, {high}]")
    for role, criteria in expectation.get("role_criteria", {}).items():
        if role not in roles:
            continue  # absence is must_roles' concern, not the criteria's
        for criterion, allowed in criteria.items():
            actual = answers[role].get(criterion)
            if actual is None:
                failures.append(f"{role} criterion '{criterion}' missing from answers")
            elif actual not in allowed:
                allowed_text = ", ".join(f"'{value}'" for value in allowed)
                failures.append(
                    f"{role} criterion '{criterion}' answered '{actual}' (allowed {allowed_text})"
                )
    overall = result["overall_score"]
    low, high = expectation.get("overall_range", [0, 100])
    if not low <= overall <= high:
        failures.append(f"overall {overall} outside [{low}, {high}]")
    return failures


def check_against_golden() -> int:
    golden = json.loads(GOLDEN_PATH.read_text())
    result_decks = json.loads(RESULTS_PATH.read_text()).get("decks", {})
    min_pass_rate = golden.get("min_pass_rate", 0.9)
    total = 0
    passed = 0
    for deck_title, deck_golden in golden["decks"].items():
        deck_results = result_decks.get(deck_title, {})
        for name, expectation in sorted(deck_golden["cards"].items()):
            total += 1
            failures = card_failures(expectation, deck_results.get(name))
            if not failures:
                passed += 1
                continue
            for failure in failures:
                print(f"  ✗ [{deck_title}] {name}: {failure}")
    rate = passed / total if total else 0.0
    print(
        f"Golden check: {passed}/{total} cards passed "
        f"({rate:.0%}, minimum {min_pass_rate:.0%})."
    )
    if rate < min_pass_rate:
        print("GOLDEN CHECK FAILED")
        return 1
    return 0


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["extract", "run", "check"])
    parser.add_argument("--only", nargs="*", help="card names to (re)evaluate")
    args = parser.parse_args(list(argv) if argv is not None else None)
    if args.command == "extract":
        extract_snapshots()
        return 0
    if args.command == "run":
        asyncio.run(run_evaluations(args.only))
        return 0
    return check_against_golden()


if __name__ == "__main__":
    raise SystemExit(main())
