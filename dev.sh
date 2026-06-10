#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

require_docker_access() {
  local docker_error
  if docker_error="$(docker info 2>&1)"; then
    return
  fi

  printf 'Docker is installed but unavailable to user %s:\n%s\n' "$(id -un)" "$docker_error" >&2
  if [[ -S /var/run/docker.sock ]]; then
    printf 'Docker socket: %s\n' "$(stat -c '%U:%G %a %n' /var/run/docker.sock)" >&2
  fi
  printf 'Repair Docker outside this script, then start a new login session.\n' >&2
  exit 1
}

if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker is not installed. Run ./setup.sh first.\n' >&2
  exit 1
fi

if [[ "$(id -u)" -eq 0 ]]; then
  printf 'Do not run dev.sh as root.\n' >&2
  exit 1
fi

require_docker_access

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  printf '.env is missing. Run ./setup.sh first.\n' >&2
  exit 1
fi

printf 'Starting Survail development stack...\n'
printf 'API: http://localhost:8000\n'
printf 'API docs: http://localhost:8000/docs\n\n'
printf 'Web: http://localhost:3000\n\n'

docker compose --project-directory "$ROOT_DIR" up "$@"
