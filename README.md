# Survail

Survail is a deck-building backend for Magic: The Gathering applications.

The repository currently contains:

- `api/`: FastAPI backend, domain logic, migrations, and tests.
- `web/`: React deck library and editor.
- `docker-compose.yml`: PostgreSQL with pgvector, Redis, API, and web services.

## Implemented Capabilities

- Discord OAuth login and revocable cookie sessions.
- Authenticated deck creation, editing, permanent deletion, and listing.
- Local Scryfall bulk catalog search, exact-printing additions, card metadata, and card images.
- Moxfield decklist preview and import with ranked printing preferences.
- Resumable Oracle-card embedding backfill using `text-embedding-3-large` and pgvector.
- Atomic deck card operations with immutable history and optimistic concurrency.
- Deterministic deck-size, singleton, and format-legality validation.
- PostgreSQL schema migrations with pgvector enabled.
- Redis-backed Scryfall response caching with no eviction.
- OpenTelemetry API and agent observability with OpenInference, Jaeger, and Prometheus.
- React deck library and editor.

## Core Model

- A `Deck` owns its title, discrete format, description, format-specific metadata, and cards.
- Internally, each stored card selection identifies one exact Scryfall printing, finish, quantity,
  and zone.
- `printing_id` preserves the selected artwork/set/collector number. `oracle_id` identifies the
  underlying card across printings and is used for copy-limit validation.
- Stored Scryfall snapshots are strictly typed. Unknown upstream fields are discarded at the
  integration boundary instead of leaking into the domain model.
- Supported interactive searches and deck operations query PostgreSQL. Advanced Scryfall syntax
  uses the throttled, Redis-cached live search fallback.
- Validators are deterministic, composable format rules that return errors. They never prevent
  persistence.
  Current checks cover deck size, copy limits, Scryfall format legality, commander count, and
  commander color identity.

The backend is separated into HTTP routes, strict schemas, persistence models, Scryfall/Redis
integrations, and deck validation domain logic. The web app consumes only the HTTP API.

Redis is configured with `noeviction` and cached responses have no TTL. This is persistent
cache-aside behavior, not an LRU eviction policy.

See [docs/SCRYFALL_DATA.md](docs/SCRYFALL_DATA.md) for the live API safeguards and bulk catalog
direction.

## Local Setup

1. Install system and project dependencies, start pgvector, and run migrations:

   ```bash
   ./setup.sh
   ```

   Run this as the repository owner, never as root. The script does not use `sudo`; it verifies
   Python, pip, Docker, Docker Compose, npm, repository ownership, and direct Docker access before
   installing project dependencies.

   Docker must already be running and accessible without `sudo`. On a standard Linux Docker Engine
   installation, `/var/run/docker.sock` is owned by `root:docker` and the development user belongs
   to the `docker` group. System-level Docker installation and permission changes are deliberately
   outside the project setup script.

   Setup also imports Scryfall's current Default Cards bulk export and generates missing Oracle
   embeddings. It reads `OPENAI_API_KEY` from `.env`; when missing during an interactive run, it
   securely prompts for the key and stores it in `.env`.

2. Add `DISCORD_OAUTH_CLIENT_ID` and `DISCORD_OAUTH_CLIENT_SECRET` to `.env`. Configure this
   redirect URI in Discord:

   ```text
   http://localhost:8000/auth/discord/callback
   ```

3. Run all development services:

   ```bash
   ./dev.sh
   ```

   The API and web projects are bind-mounted into development containers. FastAPI and Vite reload
   automatically when source files change. Rebuild only after changing Dockerfiles or project
   dependencies:

   ```bash
   docker compose build api web
   ```

For browser automation, set `AUTH_STRATEGY=mock` in `.env`. In development this automatically
authenticates requests as a stable local user, allowing Playwright to open the app without Discord.
Mock authentication is rejected when `ENVIRONMENT` is not `development`.

Playwright and axe browser tests run as part of `./check.sh`. They use deterministic mocked API
responses to verify keyboard interactions, dialog focus behavior, format-aware search, and
automatically detectable accessibility violations.

OpenAPI documentation is available at `http://localhost:8000/docs`.
Jaeger traces are available at `http://localhost:16686`, and Prometheus metrics are available at
`http://localhost:9090`. See [docs/TELEMETRY.md](docs/TELEMETRY.md) for instrumentation and privacy
configuration.

## Repository Layout

```text
.
├── api/
│   ├── alembic/          # Database migrations
│   ├── survail/          # Backend package
│   └── tests/            # Deterministic tests
├── docker-compose.yml
├── setup.sh               # Install and initialize all projects
├── dev.sh                 # Run the development stack
├── check.sh               # Lint, typecheck, test, build, and validate migrations
├── embed.sh               # One-off resumable Oracle-card embedding backfill
├── web/                    # React deck library and editor
└── README.md
```

See [api/README.md](api/README.md) for backend-specific commands and endpoint details.

Run the complete strict verification suite with:

```bash
./check.sh
```
