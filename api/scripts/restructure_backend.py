from __future__ import annotations

from pathlib import Path
import shutil


ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "survail"


MOVE_MAP = {
    "survail/settings.py": "survail/core/config.py",
    "survail/db.py": "survail/core/db.py",
    "survail/dependencies.py": "survail/core/dependencies.py",
    "survail/security.py": "survail/core/security.py",
    "survail/telemetry.py": "survail/core/telemetry.py",
    "survail/models.py": "survail/core/models.py",
    "survail/schemas.py": "survail/core/schemas.py",
    "survail/types.py": "survail/core/types.py",
    "survail/main.py": "survail/app.py",
    "survail/catalog.py": "survail/modules/cards/repository/cards.py",
    "survail/routes/auth.py": "survail/modules/auth/api/router.py",
    "survail/services/auth.py": "survail/modules/auth/service/login.py",
    "survail/repositories/auth.py": "survail/modules/auth/repository/users.py",
    "survail/routes/cards.py": "survail/modules/cards/api/router.py",
    "survail/domain/printing_preferences.py": "survail/modules/cards/service/printings.py",
    "survail/domain/semantic_search.py": "survail/modules/cards/service/semantic_search.py",
    "survail/routes/imports.py": "survail/modules/imports/api/router.py",
    "survail/services/imports.py": "survail/modules/imports/service/create.py",
    "survail/domain/moxfield_import.py": "survail/modules/imports/service/preview.py",
    "survail/routes/decks.py": "survail/modules/decks/api/router.py",
    "survail/services/decks.py": "survail/modules/decks/service/manage.py",
    "survail/services/sample_decks.py": "survail/modules/decks/service/samples.py",
    "survail/repositories/decks.py": "survail/modules/decks/repository/decks.py",
    "survail/domain/decks.py": "survail/modules/decks/service/validate.py",
    "survail/domain/format_strategies.py": "survail/modules/decks/service/formats.py",
    "survail/domain/validation_rules.py": "survail/modules/decks/service/rules.py",
    "survail/domain/deck_description.py": "survail/modules/decks/service/context.py",
    "survail/domain/deck_description_service.py": "survail/modules/decks/service/describe.py",
    "survail/domain/deck_operations.py": "survail/modules/decks/operations/service/apply.py",
    "survail/routes/evaluations.py": "survail/modules/decks/evaluations/api/router.py",
    "survail/services/evaluations.py": "survail/modules/decks/evaluations/service/run.py",
    "survail/domain/role_evaluation.py": "survail/modules/decks/evaluations/service/evaluator.py",
    "survail/routes/agent.py": "survail/modules/decks/agent/api/router.py",
    "survail/services/agent.py": "survail/modules/decks/agent/service/access.py",
    "survail/repositories/agent.py": "survail/modules/decks/agent/repository/conversations.py",
    "survail/deck_agent/service.py": "survail/modules/decks/agent/service/chat.py",
    "survail/deck_agent/events.py": "survail/modules/decks/agent/service/events.py",
    "survail/routes/formats.py": "survail/modules/formats/api/router.py",
    "survail/integrations/scryfall.py": "survail/integrations/scryfall/client.py",
    "survail/integrations/openai_descriptions.py": "survail/integrations/openai/descriptions.py",
    "survail/integrations/openai_imports.py": "survail/integrations/openai/imports.py",
}


IMPORT_REPLACEMENTS = [
    ("from survail.routes import agent as agent_routes", "from survail.modules.decks.agent.api import router as agent_routes"),
    ("from survail.routes import evaluations", "from survail.modules.decks.evaluations.api import router as evaluations"),
    ("from survail.services import evaluations as evaluation_service", "from survail.modules.decks.evaluations.service import run as evaluation_service"),
    ("from survail.routes import decks as deck_routes", "from survail.modules.decks.api import router as deck_routes"),
    ("from survail.domain import semantic_search as subject", "from survail.modules.cards.service import semantic_search as subject"),
    ("survail.main:app", "survail.app:app"),
    ("from survail.settings import", "from survail.core.config import"),
    ("from survail.db import", "from survail.core.db import"),
    ("from survail.dependencies import", "from survail.core.dependencies import"),
    ("from survail.security import", "from survail.core.security import"),
    ("from survail.telemetry import", "from survail.core.telemetry import"),
    ("from survail.models import", "from survail.core.models import"),
    ("from survail.schemas import", "from survail.core.schemas import"),
    ("from survail.types import", "from survail.core.types import"),
    ("from survail.catalog import", "from survail.modules.cards.repository.cards import"),
    ("from survail.routes.auth import", "from survail.modules.auth.api.router import"),
    ("from survail.services.auth import", "from survail.modules.auth.service.login import"),
    ("from survail.repositories.auth import", "from survail.modules.auth.repository.users import"),
    ("from survail.routes.cards import", "from survail.modules.cards.api.router import"),
    ("from survail.domain.printing_preferences import", "from survail.modules.cards.service.printings import"),
    ("from survail.domain.semantic_search import", "from survail.modules.cards.service.semantic_search import"),
    ("from survail.routes.imports import", "from survail.modules.imports.api.router import"),
    ("from survail.services.imports import", "from survail.modules.imports.service.create import"),
    ("from survail.domain.moxfield_import import", "from survail.modules.imports.service.preview import"),
    ("from survail.routes.decks import", "from survail.modules.decks.api.router import"),
    ("from survail.services.decks import", "from survail.modules.decks.service.manage import"),
    ("from survail.services.sample_decks import", "from survail.modules.decks.service.samples import"),
    ("from survail.repositories.decks import", "from survail.modules.decks.repository.decks import"),
    ("from survail.domain.decks import", "from survail.modules.decks.service.validate import"),
    ("from survail.domain.format_strategies import", "from survail.modules.decks.service.formats import"),
    ("from survail.domain.validation_rules import", "from survail.modules.decks.service.rules import"),
    ("from survail.domain.deck_description import", "from survail.modules.decks.service.context import"),
    ("from survail.domain.deck_description_service import", "from survail.modules.decks.service.describe import"),
    ("from survail.domain.deck_operations import", "from survail.modules.decks.operations.service.apply import"),
    ("from survail.routes.evaluations import", "from survail.modules.decks.evaluations.api.router import"),
    ("from survail.services.evaluations import", "from survail.modules.decks.evaluations.service.run import"),
    ("from survail.domain.role_evaluation import", "from survail.modules.decks.evaluations.service.evaluator import"),
    ("from survail.routes.agent import", "from survail.modules.decks.agent.api.router import"),
    ("from survail.services.agent import", "from survail.modules.decks.agent.service.access import"),
    ("from survail.repositories.agent import", "from survail.modules.decks.agent.repository.conversations import"),
    ("from survail.deck_agent.service import", "from survail.modules.decks.agent.service.chat import"),
    ("from survail.deck_agent.events import", "from survail.modules.decks.agent.service.events import"),
    ("from survail.routes.formats import", "from survail.modules.formats.api.router import"),
    ("from survail.integrations.scryfall import", "from survail.integrations.scryfall.client import"),
    ("from survail.integrations.openai_descriptions import", "from survail.integrations.openai.descriptions import"),
    ("from survail.integrations.openai_imports import", "from survail.integrations.openai.imports import"),
]


PACKAGE_DIRS = [
    "survail/core",
    "survail/integrations",
    "survail/integrations/openai",
    "survail/integrations/scryfall",
    "survail/integrations/discord",
    "survail/modules",
    "survail/modules/auth",
    "survail/modules/auth/api",
    "survail/modules/auth/service",
    "survail/modules/auth/repository",
    "survail/modules/cards",
    "survail/modules/cards/api",
    "survail/modules/cards/service",
    "survail/modules/cards/repository",
    "survail/modules/imports",
    "survail/modules/imports/api",
    "survail/modules/imports/service",
    "survail/modules/decks",
    "survail/modules/decks/api",
    "survail/modules/decks/service",
    "survail/modules/decks/repository",
    "survail/modules/decks/operations",
    "survail/modules/decks/operations/api",
    "survail/modules/decks/operations/service",
    "survail/modules/decks/operations/repository",
    "survail/modules/decks/evaluations",
    "survail/modules/decks/evaluations/api",
    "survail/modules/decks/evaluations/service",
    "survail/modules/decks/evaluations/repository",
    "survail/modules/decks/agent",
    "survail/modules/decks/agent/api",
    "survail/modules/decks/agent/service",
    "survail/modules/decks/agent/repository",
    "survail/modules/decks/guidance",
    "survail/modules/decks/guidance/api",
    "survail/modules/decks/guidance/service",
    "survail/modules/decks/guidance/repository",
    "survail/modules/formats",
    "survail/modules/formats/api",
]


def _mkdirs() -> None:
    for relative in PACKAGE_DIRS:
        path = ROOT / relative
        if path.exists() and path.is_file():
            continue
        path.mkdir(parents=True, exist_ok=True)
        init = path / "__init__.py"
        if not init.exists():
            init.write_text("")


def _move_files() -> None:
    for source_relative, target_relative in MOVE_MAP.items():
        source = ROOT / source_relative
        target = ROOT / target_relative
        if not source.exists():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), str(target))


def _rewrite_text(path: Path) -> None:
    text = path.read_text()
    updated = text
    for old, new in IMPORT_REPLACEMENTS:
        updated = updated.replace(old, new)
    if updated != text:
        path.write_text(updated)


def _rewrite_imports() -> None:
    rewrite_roots = [ROOT / "survail", ROOT / "tests", ROOT / "alembic"]
    for root in rewrite_roots:
        if not root.exists():
            continue
        for path in root.rglob("*.py"):
            _rewrite_text(path)
    for path in [ROOT / "Dockerfile", ROOT.parent / "docker-compose.yml"]:
        if path.exists():
            _rewrite_text(path)


def _write_support_files() -> None:
    errors = ROOT / "survail/core/errors.py"
    if not errors.exists():
        errors.write_text(
            "class SurvailError(Exception):\n"
            '    """Base exception for application-layer errors."""\n'
        )
    main = ROOT / "survail/main.py"
    main.write_text("from survail.app import app\n")


def _remove_empty_dirs() -> None:
    for relative in [
        "survail/routes",
        "survail/services",
        "survail/repositories",
        "survail/domain",
        "survail/deck_agent",
    ]:
        path = ROOT / relative
        if path.exists():
            for directory in sorted(path.rglob("*"), reverse=True):
                if directory.is_dir():
                    try:
                        directory.rmdir()
                    except OSError:
                        pass
            try:
                path.rmdir()
            except OSError:
                pass


def main() -> None:
    _mkdirs()
    _move_files()
    _rewrite_imports()
    _write_support_files()
    _remove_empty_dirs()


if __name__ == "__main__":
    main()
