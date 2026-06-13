from pathlib import Path

ROOT = Path(__file__).parents[1] / "survail"
MAX_SOURCE_LINES = 300
TRANSITIONAL_EXCEPTIONS = {
    ROOT / "core" / "models.py",
    ROOT / "core" / "schemas.py",
    ROOT / "embedding_backfill.py",
    ROOT / "modules" / "agent" / "service" / "chat.py",
    ROOT / "modules" / "decks" / "api" / "router.py",
    ROOT / "modules" / "decks" / "evaluations" / "service" / "evaluator.py",
    ROOT / "modules" / "imports" / "service" / "preview.py",
}


def test_backend_source_files_stay_under_300_lines() -> None:
    violations: list[str] = []
    for path in ROOT.rglob("*.py"):
        if path.name == "__init__.py" or path in TRANSITIONAL_EXCEPTIONS:
            continue
        line_count = len(path.read_text().splitlines())
        if line_count > MAX_SOURCE_LINES:
            violations.append(f"{path.relative_to(ROOT)}: {line_count}")
    assert not violations, "backend source file budget exceeded:\n" + "\n".join(violations)
