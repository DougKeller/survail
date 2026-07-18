"""Standalone LLM-as-a-judge evaluation harness for the card role evaluator.

Runs the production evaluator (rubrics, prompt, structured output, gating)
against a curated deck spec without the web app or a database, so rubric and
prompt changes can be judged on real model output and regression-checked
against a golden expectations file.

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


class FakeDb:
    """Just enough Session surface for evaluate_oracle_ids without Postgres."""

    def scalars(self, statement: object) -> list[object]:
        del statement
        return []

    def add(self, instance: object) -> None:
        del instance

    def commit(self) -> None:
        pass


def load_spec() -> dict:
    return json.loads(SPEC_PATH.read_text())


def spec_names(spec: dict) -> list[str]:
    names = [entry["name"] for entry in spec["commander"] + spec["mainboard"]]
    return list(dict.fromkeys(names))


def extract_snapshots() -> None:
    wanted = spec_names(load_spec())
    needles = {name: f'"name":"{name}","' for name in wanted}
    found: dict[str, dict] = {}
    scanned = 0
    with BULK_PATH.open(encoding="utf-8") as bulk:
        for line in bulk:
            scanned += 1
            if len(found) == len(needles):
                break
            for name, needle in needles.items():
                if name in found or needle not in line:
                    continue
                record = json.loads(line.rstrip().rstrip(","))
                if record.get("lang") != "en" or record.get("digital"):
                    continue
                if record.get("layout") in SKIP_LAYOUTS or record.get("oversized"):
                    continue
                if record.get("name") != name or not record.get("oracle_text", record.get("card_faces")):
                    continue
                snapshot = UpstreamCard.model_validate(record).snapshot()
                found[name] = snapshot.model_dump(mode="json")
                print(f"[{len(found)}/{len(needles)}] {name} ({record['set']})", flush=True)
    missing = [name for name in wanted if name not in found]
    if missing:
        raise SystemExit(f"Missing cards after scanning {scanned} lines: {missing}")
    SNAPSHOTS_PATH.write_text(json.dumps(found, indent=2, sort_keys=True) + "\n")
    print(f"Wrote {len(found)} snapshots to {SNAPSHOTS_PATH}")


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
    spec = load_spec()
    snapshots = json.loads(SNAPSHOTS_PATH.read_text())
    deck = build_deck(spec, snapshots)
    names = only or spec["evaluate"]
    unknown = [name for name in names if name not in snapshots]
    if unknown:
        raise SystemExit(f"Not in snapshots (run extract): {unknown}")
    oracle_ids = [snapshots[name]["oracle_id"] for name in names]
    by_oracle = {snapshots[name]["oracle_id"]: name for name in names}
    model = evaluation_model()
    evaluator = OpenAIRoleEvaluator(api_key(), model)

    async def progress(update: EvaluationProgress) -> None:
        print(f"  progress {update.completed}/{update.total}", flush=True)

    print(f"Evaluating {len(oracle_ids)} cards with {model}...", flush=True)
    results = await evaluate_oracle_ids(FakeDb(), deck, oracle_ids, evaluator, progress)

    merged: dict[str, dict] = {}
    if only and RESULTS_PATH.exists():
        merged = json.loads(RESULTS_PATH.read_text()).get("results", {})
    for result in results:
        payload = result.model_dump(mode="json")
        payload["card_name"] = by_oracle[result.oracle_id]
        merged[payload["card_name"]] = payload
    output = {"model": model, "results": merged}
    RESULTS_PATH.write_text(json.dumps(output, indent=2, sort_keys=True) + "\n")
    print(f"Wrote {len(results)} evaluations to {RESULTS_PATH}")
    for result in results:
        name = by_oracle[result.oracle_id]
        roles = ", ".join(f"{r.role}={r.score}" for r in result.roles) or "(no roles)"
        print(f"  {name}: overall={result.overall_score} {roles}")


def check_against_golden() -> int:
    golden = json.loads(GOLDEN_PATH.read_text())
    results = json.loads(RESULTS_PATH.read_text())["results"]
    failures: list[str] = []
    for name, expectation in sorted(golden["cards"].items()):
        result = results.get(name)
        if result is None:
            failures.append(f"{name}: no result recorded")
            continue
        roles = {entry["role"]: entry["score"] for entry in result["roles"]}
        for role in expectation.get("must_roles", []):
            if role not in roles:
                failures.append(f"{name}: expected role '{role}' missing (got {sorted(roles)})")
        for role in expectation.get("forbid_roles", []):
            if role in roles:
                failures.append(f"{name}: forbidden role '{role}' present (score {roles[role]})")
        for role, (low, high) in expectation.get("role_score_ranges", {}).items():
            if role in roles and not low <= roles[role] <= high:
                failures.append(f"{name}: {role} score {roles[role]} outside [{low}, {high}]")
        overall = result["overall_score"]
        low, high = expectation.get("overall_range", [0, 100])
        if not low <= overall <= high:
            failures.append(f"{name}: overall {overall} outside [{low}, {high}]")
    if failures:
        print(f"GOLDEN CHECK FAILED ({len(failures)} failures):")
        for failure in failures:
            print(f"  ✗ {failure}")
        return 1
    print(f"Golden check passed for {len(golden['cards'])} cards.")
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
