#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/api"
VENV_DIR="$API_DIR/.venv"

log() {
  printf '\n==> %s\n' "$1"
}

have() {
  command -v "$1" >/dev/null 2>&1
}

require_docker_access() {
  local docker_error
  if docker_error="$(docker info 2>&1)"; then
    return
  fi

  printf 'Docker is installed but unavailable to user %s:\n%s\n' "$(id -un)" "$docker_error" >&2
  if [[ -S /var/run/docker.sock ]]; then
    printf 'Docker socket: %s\n' "$(stat -c '%U:%G %a %n' /var/run/docker.sock)" >&2
  fi
  printf '\nRepair Docker outside this script, then start a new login session and rerun setup.sh.\n' >&2
  printf 'The project scripts intentionally do not use sudo or modify system permissions.\n' >&2
  exit 1
}

preflight() {
  if [[ "$(id -u)" -eq 0 ]]; then
    printf 'Do not run setup.sh as root. Run it as the repository owner.\n' >&2
    exit 1
  fi

  local missing=()
  have python3 || missing+=(python3)
  python3 -m venv --help >/dev/null 2>&1 || missing+=(python3-venv)
  python3 -m pip --version >/dev/null 2>&1 || missing+=(python3-pip)
  have docker || missing+=(docker)
  docker compose version >/dev/null 2>&1 || missing+=(docker-compose)
  have npm || missing+=(npm)

  if ((${#missing[@]} > 0)); then
    printf 'Missing required tools: %s\n' "${missing[*]}" >&2
    printf 'Install them with your operating system package manager, then rerun setup.sh.\n' >&2
    exit 1
  fi

  local unwritable
  unwritable="$(find "$API_DIR" -maxdepth 2 -mindepth 1 ! -writable -print -quit)"
  if [[ -n "$unwritable" ]]; then
    printf 'Project artifact is not writable by %s: %s\n' "$(id -un)" "$unwritable" >&2
    printf 'Remove it or restore repository ownership before rerunning setup.sh.\n' >&2
    exit 1
  fi

  require_docker_access
}

initialize_environment() {
  log "Initializing environment files"
  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    local secret
    secret="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
    sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$secret|" "$ROOT_DIR/.env"
    printf 'Created .env. Add Discord OAuth credentials before logging in.\n'
  fi

  if [[ ! -f "$API_DIR/.env" ]]; then
    cp "$API_DIR/.env.example" "$API_DIR/.env"
  fi

  ensure_openai_api_key
}

ensure_openai_api_key() {
  local configured_key
  configured_key="$(sed -n 's/^OPENAI_API_KEY=//p' "$ROOT_DIR/.env" | tail -n 1)"
  if [[ -n "$configured_key" ]]; then
    return
  fi

  if [[ ! -t 0 ]]; then
    printf 'OPENAI_API_KEY is missing from .env and setup.sh cannot prompt without a terminal.\n' >&2
    exit 1
  fi

  local api_key
  read -r -s -p 'Enter OPENAI_API_KEY: ' api_key
  printf '\n'
  if [[ -z "$api_key" ]]; then
    printf 'OPENAI_API_KEY must not be blank.\n' >&2
    exit 1
  fi
  if [[ "$api_key" == *$'\n'* || "$api_key" == *$'\r'* ]]; then
    printf 'OPENAI_API_KEY contains invalid newline characters.\n' >&2
    exit 1
  fi

  local temporary_env
  temporary_env="$(mktemp "$ROOT_DIR/.env.XXXXXX")"
  local replaced=false
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == OPENAI_API_KEY=* ]]; then
      if [[ "$replaced" == false ]]; then
        printf 'OPENAI_API_KEY=%s\n' "$api_key" >>"$temporary_env"
        replaced=true
      fi
    else
      printf '%s\n' "$line" >>"$temporary_env"
    fi
  done <"$ROOT_DIR/.env"
  if [[ "$replaced" == false ]]; then
    printf '\nOPENAI_API_KEY=%s\n' "$api_key" >>"$temporary_env"
  fi
  chmod --reference="$ROOT_DIR/.env" "$temporary_env"
  mv "$temporary_env" "$ROOT_DIR/.env"
  printf 'Stored OPENAI_API_KEY in .env.\n'
}

install_api() {
  log "Installing API dependencies"
  if [[ ! -d "$VENV_DIR" ]]; then
    python3 -m venv "$VENV_DIR"
  fi
  "$VENV_DIR/bin/python" -m pip install --upgrade pip
  "$VENV_DIR/bin/python" -m pip install -e "$API_DIR[dev]"
}

install_web() {
  if [[ ! -f "$ROOT_DIR/web/package.json" ]]; then
    return
  fi

  log "Installing web dependencies"
  if [[ -f "$ROOT_DIR/web/package-lock.json" ]]; then
    npm --prefix "$ROOT_DIR/web" ci
  else
    npm --prefix "$ROOT_DIR/web" install
  fi
  log "Installing Playwright Chromium"
  npm --prefix "$ROOT_DIR/web" exec playwright install chromium
}

initialize_database() {
  log "Starting pgvector and Redis"
  docker compose --project-directory "$ROOT_DIR" up -d db redis

  local attempts=30
  until docker compose --project-directory "$ROOT_DIR" exec -T db \
    pg_isready -U survail -d survail >/dev/null 2>&1; do
    attempts=$((attempts - 1))
    if ((attempts == 0)); then
      printf 'Database did not become ready in time.\n' >&2
      exit 1
    fi
    sleep 2
  done

  log "Running database migrations"
  set -a
  source "$ROOT_DIR/.env"
  set +a
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    printf 'OPENAI_API_KEY is required to import Default Cards and generate missing embeddings.\n' >&2
    exit 1
  fi
  (
    cd "$API_DIR"
    "$VENV_DIR/bin/alembic" upgrade head
    log "Importing Scryfall Default Cards and generating missing embeddings"
    "$VENV_DIR/bin/python" -m survail.catalog_import
  )
}

main() {
  preflight
  initialize_environment
  install_api
  install_web
  initialize_database

  log "Setup complete"
  printf 'Configure Discord OAuth in .env, then run ./dev.sh\n'
  printf 'Discord redirect URI: http://localhost:8000/auth/discord/callback\n'
}

main "$@"
