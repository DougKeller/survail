import ast
from pathlib import Path

ROOT = Path(__file__).parents[1] / "survail"
MODULES = ROOT / "modules"
CORE = ROOT / "core"
INTEGRATIONS = ROOT / "integrations"
FORBIDDEN_BASENAMES = {"service.py", "repository.py", "dao.py"}


def _module_imports(path: Path) -> list[str]:
    tree = ast.parse(path.read_text())
    imports: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module is not None:
            imports.append(node.module)
    return imports


def _is_docstring(statement: ast.stmt) -> bool:
    return (
        isinstance(statement, ast.Expr)
        and isinstance(statement.value, ast.Constant)
        and isinstance(statement.value.value, str)
    )


def _is_import(statement: ast.stmt) -> bool:
    return isinstance(statement, (ast.Import, ast.ImportFrom))


def _is_all_assignment(statement: ast.stmt) -> bool:
    if isinstance(statement, ast.Assign):
        return any(
            isinstance(target, ast.Name) and target.id == "__all__"
            for target in statement.targets
        )
    if isinstance(statement, ast.AnnAssign):
        return isinstance(statement.target, ast.Name) and statement.target.id == "__all__"
    return False


def _path_layer(path: Path) -> str | None:
    try:
        relative = path.relative_to(MODULES)
    except ValueError:
        if path.is_relative_to(CORE):
            return "core"
        if path.is_relative_to(INTEGRATIONS):
            return "integrations"
        return None
    for part in relative.parts:
        if part in {"api", "service", "repository"}:
            return part
    return None


def _module_package(path: Path) -> str | None:
    try:
        relative = path.relative_to(MODULES)
    except ValueError:
        return None
    parts: list[str] = []
    for part in relative.parts[:-1]:
        if part in {"api", "service", "repository"}:
            break
        parts.append(part)
    if not parts:
        return None
    return ".".join(("survail", "modules", *parts))


def test_modules_use_capability_names_not_generic_layer_filenames() -> None:
    for path in MODULES.rglob("*.py"):
        if path.name == "__init__.py":
            continue
        assert path.name not in FORBIDDEN_BASENAMES, f"{path} uses a generic filename"


def test_package_init_files_are_empty() -> None:
    for path in ROOT.rglob("__init__.py"):
        assert path.read_text() == "", f"{path} must be empty"


def test_contracts_modules_export_explicit_public_surfaces() -> None:
    for path in MODULES.rglob("contracts.py"):
        tree = ast.parse(path.read_text())
        body = [statement for statement in tree.body if not _is_docstring(statement)]
        assert any(
            _is_all_assignment(statement) for statement in body
        ), f"{path} must define __all__"
        invalid = [
            statement
            for statement in body
            if not _is_import(statement) and not _is_all_assignment(statement)
        ]
        assert not invalid, f"{path} may only contain imports and __all__"


def test_non_contract_modules_are_not_passthrough_reexport_files() -> None:
    for path in ROOT.rglob("*.py"):
        if path.name in {"__init__.py", "contracts.py"}:
            continue
        tree = ast.parse(path.read_text())
        body = [statement for statement in tree.body if not _is_docstring(statement)]
        imports_present = any(_is_import(statement) for statement in body)
        has_real_module_behavior = any(
            not _is_import(statement) and not _is_all_assignment(statement)
            for statement in body
        )
        assert (
            not imports_present or has_real_module_behavior
        ), f"{path} is a passthrough module; move the implementation here instead"


def test_core_does_not_depend_on_modules() -> None:
    for path in CORE.rglob("*.py"):
        imports = _module_imports(path)
        assert not [
            imported for imported in imports if imported.startswith("survail.modules.")
        ], f"{path} imports module-layer code"


def test_integrations_do_not_depend_on_modules() -> None:
    for path in INTEGRATIONS.rglob("*.py"):
        imports = _module_imports(path)
        assert not [
            imported for imported in imports if imported.startswith("survail.modules.")
        ], f"{path} imports module-layer code"


def test_layered_modules_respect_api_service_repository_boundaries() -> None:
    for path in MODULES.rglob("*.py"):
        if path.name == "__init__.py":
            continue
        layer = _path_layer(path)
        if layer is None:
            continue
        imports = _module_imports(path)
        if layer == "api":
            disallowed = [
                imported
                for imported in imports
                if imported.startswith("survail.modules.") and ".repository." in imported
            ]
            assert not disallowed, f"{path} imports repository-layer code: {disallowed}"
        elif layer == "service":
            disallowed = [
                imported
                for imported in imports
                if imported.startswith("survail.modules.") and ".api." in imported
                and not imported.endswith(".api.schemas")
            ]
            assert not disallowed, f"{path} imports api-layer code: {disallowed}"
        elif layer == "repository":
            disallowed = [
                imported
                for imported in imports
                if imported.startswith("survail.modules.")
                and (".api." in imported or ".service." in imported)
            ]
            assert not disallowed, f"{path} imports higher-layer code: {disallowed}"


def test_cross_module_schema_imports_use_contracts() -> None:
    for path in MODULES.rglob("*.py"):
        if path.name == "__init__.py":
            continue
        importer = _module_package(path)
        if importer is None:
            continue
        disallowed = [
            imported
            for imported in _module_imports(path)
            if imported.startswith("survail.modules.")
            and imported.endswith(".api.schemas")
            and imported.removesuffix(".api.schemas") != importer
        ]
        assert not disallowed, f"{path} imports another module's api schemas directly: {disallowed}"


def test_non_agent_modules_do_not_depend_on_agent() -> None:
    for path in MODULES.rglob("*.py"):
        if path.name == "__init__.py" or path.is_relative_to(MODULES / "agent"):
            continue
        disallowed = [
            imported
            for imported in _module_imports(path)
            if imported.startswith("survail.modules.agent.")
        ]
        assert not disallowed, f"{path} imports agent module code: {disallowed}"
