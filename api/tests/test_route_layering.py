import ast
from pathlib import Path

ROUTES = ("agent.py", "auth.py", "decks.py", "imports.py", "evaluations.py")
DIRECT_DB_METHODS = {"add", "delete", "commit", "flush", "rollback"}
DB_RECEIVER_NAMES = {"db", "session"}


def test_layered_routes_do_not_perform_direct_database_io() -> None:
    routes_directory = Path(__file__).parents[1] / "survail" / "routes"
    for filename in ROUTES:
        tree = ast.parse((routes_directory / filename).read_text())
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
        assert not sqlalchemy_imports, f"{filename} imports SQLAlchemy directly"
        assert not direct_calls, f"{filename} performs direct database I/O"
