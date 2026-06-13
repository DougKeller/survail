from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECK_TARGETS = ("survail", "tests")


def _tool_args(module: str, *args: str) -> list[str]:
    return [sys.executable, "-m", module, *args]


def _run(*command: str) -> None:
    subprocess.run(command, check=True, cwd=ROOT)


def _run_if_available(module: str, *args: str) -> None:
    _run(*_tool_args(module, *args))


def lint() -> None:
    _run_if_available("ruff", "check", *CHECK_TARGETS)
    _run_if_available("ruff", "format", "--check", *CHECK_TARGETS)


def fix() -> None:
    _run_if_available("ruff", "check", "--fix", *CHECK_TARGETS)
    _run_if_available("ruff", "format", *CHECK_TARGETS)


def typecheck() -> None:
    _run_if_available("mypy", *CHECK_TARGETS)


def test() -> None:
    _run_if_available("pytest")


def deps() -> None:
    _run_if_available("deptry", ".")


def check() -> None:
    lint()
    typecheck()
    test()
