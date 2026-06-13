#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/api"
WEB_DIR="$ROOT_DIR/web"
VENV_DIR="$API_DIR/.venv"

if [[ ! -x "$VENV_DIR/bin/ruff" || ! -x "$VENV_DIR/bin/mypy" ]]; then
  printf 'API development dependencies are missing. Run ./setup.sh first.\n' >&2
  exit 1
fi

(
  cd "$API_DIR"
  "$VENV_DIR/bin/python" -m survail.devtools fix
  "$VENV_DIR/bin/python" -m survail.devtools lint
  "$VENV_DIR/bin/python" -m survail.devtools typecheck
  "$VENV_DIR/bin/python" -m survail.devtools deps
  "$VENV_DIR/bin/python" -m survail.devtools test
  "$VENV_DIR/bin/alembic" upgrade head --sql >/dev/null
)

npm --prefix "$WEB_DIR" run format
npm --prefix "$WEB_DIR" run format:check
npm --prefix "$WEB_DIR" run lint:fix
npm --prefix "$WEB_DIR" run lint
npm --prefix "$WEB_DIR" run depcruise
npm --prefix "$WEB_DIR" run knip
npm --prefix "$WEB_DIR" run test
npm --prefix "$WEB_DIR" run typecheck
npm --prefix "$WEB_DIR" run build
npm --prefix "$WEB_DIR" run size
npm --prefix "$WEB_DIR" run test:e2e

bash -n "$ROOT_DIR/setup.sh" "$ROOT_DIR/dev.sh" "$ROOT_DIR/check.sh" "$ROOT_DIR/embed.sh"
docker compose --project-directory "$ROOT_DIR" config --quiet

if find "$API_DIR/survail" "$API_DIR/tests" "$WEB_DIR/src" \
  -type f \( -name '*.py' -o -name '*.ts' -o -name '*.tsx' \) -print0 |
  xargs -0 grep -En '\bAny\b|:[[:space:]]*unknown\b|as[[:space:]]+unknown\b|<unknown>|type:[[:space:]]*ignore|noqa|eslint-disable' >/dev/null; then
  printf 'Prohibited loose types or lint suppressions found.\n' >&2
  exit 1
fi

git -C "$ROOT_DIR" diff --check
