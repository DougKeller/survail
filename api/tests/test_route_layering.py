import ast
from pathlib import Path

API_ROOT = Path(__file__).parents[1] / "survail" / "modules"
DIRECT_DB_METHODS = {"add", "delete", "commit", "flush", "rollback"}
DB_RECEIVER_NAMES = {"db", "session"}


def test_api_layer_does_not_perform_direct_database_io() -> None:
    for path in API_ROOT.rglob("api/*.py"):
        if path.name == "__init__.py" or path.name == "schemas.py":
            continue
        tree = ast.parse(path.read_text())
        sqlalchemy_imports = [
            node
            for node in ast.walk(tree)
            if isinstance(node, (ast.Import, ast.ImportFrom))
            and (
                (
                    isinstance(node, ast.Import)
                    and any(alias.name.startswith("sqlalchemy") for alias in node.names)
                )
                or (
                    isinstance(node, ast.ImportFrom)
                    and (node.module or "").startswith("sqlalchemy")
                )
            )
        ]
        direct_calls = [
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in DIRECT_DB_METHODS
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id in DB_RECEIVER_NAMES
        ]
        assert not sqlalchemy_imports, f"{path} imports SQLAlchemy directly"
        assert not direct_calls, f"{path} performs direct database I/O"
