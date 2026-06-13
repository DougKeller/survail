import ast
from pathlib import Path

LAYER_PATHS = {
    "routes": Path(__file__).parents[1] / "survail" / "routes",
    "services": Path(__file__).parents[1] / "survail" / "services",
    "repositories": Path(__file__).parents[1] / "survail" / "repositories",
    "domain": Path(__file__).parents[1] / "survail" / "domain",
    "integrations": Path(__file__).parents[1] / "survail" / "integrations",
}

FORBIDDEN_IMPORT_PREFIXES = {
    "routes": ("survail.repositories",),
    "services": ("survail.routes",),
    "repositories": ("survail.routes", "survail.services", "survail.integrations"),
    "domain": ("survail.routes", "survail.services"),
    "integrations": ("survail.routes", "survail.services", "survail.repositories"),
}


def _module_imports(path: Path) -> list[str]:
    tree = ast.parse(path.read_text())
    imports: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module is not None:
            imports.append(node.module)
    return imports


def test_layered_modules_do_not_cross_forbidden_import_boundaries() -> None:
    for layer, directory in LAYER_PATHS.items():
        forbidden = FORBIDDEN_IMPORT_PREFIXES[layer]
        for path in sorted(directory.glob("*.py")):
            imports = _module_imports(path)
            disallowed = [
                imported
                for imported in imports
                if any(
                    imported == prefix or imported.startswith(f"{prefix}.")
                    for prefix in forbidden
                )
            ]
            assert not disallowed, f"{path.name} imports forbidden modules: {disallowed}"
