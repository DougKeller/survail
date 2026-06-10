#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$ROOT_DIR/api/.venv"

if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  printf 'API environment is missing. Run ./setup.sh first.\n' >&2
  exit 1
fi

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  printf 'OPENAI_API_KEY is required.\n' >&2
  exit 1
fi

cd "$ROOT_DIR/api"
exec "$VENV_DIR/bin/python" -m survail.embedding_backfill "$@"
