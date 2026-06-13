#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/api"
WEB_DIR="$ROOT_DIR/web"
VENV_DIR="$API_DIR/.venv"

run_parallel() {
  local pids=()
  local labels=()
  local index

  for ((index = 1; index <= $#; index += 2)); do
    local label="${!index}"
    local command_index=$((index + 1))
    local command="${!command_index}"
    (
      eval "$command"
    ) &
    pids+=("$!")
    labels+=("$label")
  done

  local failed=0
  for index in "${!pids[@]}"; do
    if ! wait "${pids[$index]}"; then
      printf 'check.sh: %s failed.\n' "${labels[$index]}" >&2
      failed=1
    fi
  done

  if [[ "$failed" -ne 0 ]]; then
    exit 1
  fi
}

delete_nearly_empty_dirs() {
  local search_root="$1"
  local removed=1

  while [[ "$removed" -eq 1 ]]; do
    removed=0
    while IFS= read -r -d '' dir; do
      local keep=0
      local child

      while IFS= read -r -d '' child; do
        case "$(basename "$child")" in
          __init__.py|__pycache__)
            ;;
          *)
            keep=1
            break
            ;;
        esac
      done < <(find "$dir" -mindepth 1 -maxdepth 1 -print0)

      if [[ "$keep" -eq 0 ]]; then
        rm -rf "$dir/__pycache__"
        rm -f "$dir/__init__.py"
        rmdir "$dir" 2>/dev/null || true
        removed=1
      fi
    done < <(find "$search_root" -depth -type d -print0)
  done
}

if [[ ! -x "$VENV_DIR/bin/ruff" || ! -x "$VENV_DIR/bin/mypy" ]]; then
  printf 'API development dependencies are missing. Run ./setup.sh first.\n' >&2
  exit 1
fi

delete_nearly_empty_dirs "$API_DIR/survail"

run_parallel \
  "api mutating tasks" "cd \"$API_DIR\" && \"$VENV_DIR/bin/python\" -m survail.devtools fix" \
  "web mutating tasks" "npm --prefix \"$WEB_DIR\" run format && npm --prefix \"$WEB_DIR\" run lint:fix"

run_parallel \
  "api lint" "cd \"$API_DIR\" && \"$VENV_DIR/bin/python\" -m survail.devtools lint" \
  "api typecheck" "cd \"$API_DIR\" && \"$VENV_DIR/bin/python\" -m survail.devtools typecheck" \
  "api dependency check" "cd \"$API_DIR\" && \"$VENV_DIR/bin/python\" -m survail.devtools deps" \
  "api tests" "cd \"$API_DIR\" && \"$VENV_DIR/bin/python\" -m survail.devtools test" \
  "api alembic sql" "cd \"$API_DIR\" && \"$VENV_DIR/bin/alembic\" upgrade head --sql >/dev/null" \
  "web format check" "npm --prefix \"$WEB_DIR\" run format:check" \
  "web lint" "npm --prefix \"$WEB_DIR\" run lint" \
  "web depcruise" "npm --prefix \"$WEB_DIR\" run depcruise" \
  "web knip" "npm --prefix \"$WEB_DIR\" run knip" \
  "web tests" "npm --prefix \"$WEB_DIR\" run test" \
  "web typecheck" "npm --prefix \"$WEB_DIR\" run typecheck" \
  "web build" "npm --prefix \"$WEB_DIR\" run build" \
  "web size" "npm --prefix \"$WEB_DIR\" run size" \
  "web e2e tests" "npm --prefix \"$WEB_DIR\" run test:e2e" \
  "shell script syntax" "bash -n \"$ROOT_DIR/setup.sh\" \"$ROOT_DIR/dev.sh\" \"$ROOT_DIR/check.sh\" \"$ROOT_DIR/embed.sh\"" \
  "docker compose config" "docker compose --project-directory \"$ROOT_DIR\" config --quiet"

if find "$API_DIR/survail" "$API_DIR/tests" "$WEB_DIR/src" \
  -type f \( -name '*.py' -o -name '*.ts' -o -name '*.tsx' \) -print0 |
  xargs -0 grep -En '\bAny\b|as[[:space:]]+unknown\b|<unknown>|type:[[:space:]]*ignore|eslint-disable' >/dev/null; then
  printf 'Prohibited loose types or lint suppressions found.\n' >&2
  exit 1
fi

git -C "$ROOT_DIR" diff --check
