# Survail API

FastAPI backend for authenticated Magic: The Gathering deck building.

## Run

From the repository root:

```bash
docker compose up --build
```

The API is available at `http://localhost:8000`. OpenAPI documentation is at
`http://localhost:8000/docs`.

Discord OAuth requires:

- `DISCORD_OAUTH_CLIENT_ID`
- `DISCORD_OAUTH_CLIENT_SECRET`
- Redirect URI: `http://localhost:8000/auth/discord/callback`

## HTTP Surface

- `GET /auth/discord/login`
- `GET /auth/discord/callback`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /cards/search`
- `GET /cards/{printing_id}`
- `POST /imports/moxfield`
- `POST /imports/moxfield/decks`
- `GET /formats`
- `GET|POST /decks`
- `GET|PATCH|DELETE /decks/{deck_id}`
- `POST /decks/{deck_id}/operations`
- `GET /decks/{deck_id}/operations`
- `POST /decks/{deck_id}/operations/{operation_id}/revert`
- `GET /decks/{deck_id}/validation`
- `POST /decks/{deck_id}/generate-description`
- `POST /decks/sample/commander`
- `GET /health`

## Migrations

Run from `api/`:

```bash
alembic upgrade head
alembic revision --autogenerate -m "description"
```

The migrations enable pgvector and create users, revocable sessions, typed decks, exact-printing
cardsets, and immutable cardset operation history. Deck deletion permanently removes the deck,
its cards, and its operation history through foreign-key cascades. `setup.sh` also discovers and
imports Scryfall's current `default_cards` bulk export, then fills missing Oracle embeddings.
Refresh it manually with:

```bash
python -m survail.catalog_import
```

The refresh requires `OPENAI_API_KEY` when a new bulk export is available. Use
`python -m survail.catalog_import --skip-embeddings` only when intentionally performing a
catalog-only refresh.

## Deck Operations

Cardset changes are submitted atomically as positive or negative quantity deltas. Each operation:

- Locks the deck row for the duration of the transaction.
- Supports idempotent retries through `client_operation_id`.
- Supports optimistic concurrency through `expected_revision`.
- Rejects negative final quantities, unavailable print finishes, missing printings, and net-empty
  requests.
- Records immutable before/after quantities and the acting user.
- Returns the saved deck and its current validation result.
- Supports auditable inverse operations through the revert endpoint.

Construction validation does not block persistence. Incremental deck building necessarily passes
through incomplete or invalid states; the separate validation API reports those states. Copy-limit
validation aggregates quantities by Oracle card across printings. The `considering` zone is
intentionally excluded from construction validation.

## Domain Design

`FormatStrategy` owns format metadata, commander behavior, and format rule values. Reusable
validation functions compose those values into shared checks for size, sideboard size, copy
limits, legality, commander count, and color identity. New formats should normally register a
strategy and reuse the shared rules rather than branch throughout routes or services.

The backend follows an incremental feature/domain architecture:

- `routes/` owns HTTP translation only: dependencies, status codes, and response models.
- `services/` owns application workflows and transaction orchestration.
- `repositories/` owns SQLAlchemy queries and persistence access.
- `domain/` owns deterministic business rules that do not depend on FastAPI.
- `integrations/` owns external systems such as OpenAI, Redis, and Scryfall.

New features should keep database queries out of routes and expose business workflows through a
typed service. Existing route modules are being migrated to this structure incrementally to avoid
a risky all-at-once rewrite.

## Generated Deck Descriptions

`POST /decks/{deck_id}/generate-description` asks OpenAI for a concise explanation of the deck's
plan, synergies, interaction, and weaknesses. The model receives the format rules, commander,
quantities, zones, and each card's title, mana cost, type line, and Oracle text. Responses are
cached in Redis by deck ID and revision, so unchanged decks do not make another model request.

Configure the model with `OPENAI_DESCRIPTION_MODEL` and the cache lifetime with
`DECK_DESCRIPTION_CACHE_TTL_SECONDS`.

## Moxfield Imports

`POST /imports/moxfield` accepts Moxfield plain-text decklist content and returns a partial preview
plus structured per-line errors. Parsing and resolution are stateless outside local catalog
queries.

- `preserve_tags` retains Moxfield card tags.
- Printing preferences are opt-in and ranked: non-Universes-Beyond, frame style, foil/nonfoil,
  cheapest, and original printing.
- Preferences are soft. If no printing satisfies one, the importer falls back to another playable
  English printing instead of rejecting the card.
- Supported section headers assign commander, sideboard, companion, considering, and mainboard
  zones.

`POST /imports/moxfield/decks` requires a title, format, and format metadata, then creates the deck
and its initial card operation. It rejects unresolved lines rather than creating a partial deck.

## Oracle Embeddings

The embedding backfill stores one `text-embedding-3-large` vector per Oracle card in pgvector. It
refreshes rows that are missing, use a different model, or have stale canonical-source hashes;
batches inputs, runs batches concurrently, and retries transient OpenAI failures. A new bulk
catalog refresh invokes it automatically; it can also be run independently.

From the repository root:

```bash
./embed.sh
./embed.sh --batch-size 64 --concurrency 4
```

The command requires `OPENAI_API_KEY`. Re-running it safely resumes from the remaining Oracle
cards.

## Tests

```bash
python -m pytest
```

## Role evaluator optimization

Production card-role evaluation is a typed DSPy program. The offline harness adapts the existing
`judge_eval_deck.json`, `judge_eval_snapshots.json`, and `judge_eval_golden.json` files into DSPy
examples in memory; optimization never rewrites those labeled files.

Historical `overall_range` labels remain in `judge_eval_golden.json` for provenance but are ignored
by both the behavioral golden check and GEPA. Overall score is deterministically recalculated from
the labeled role scores and is covered by scorer tests; new evaluator labels should specify role
presence, role score ranges, and rubric criteria instead of an overall range.

From `api/`, run the existing evaluator and golden check with:

```bash
.venv/bin/python scripts/judge_eval.py run
.venv/bin/python scripts/judge_eval.py check
```

Compile its instructions with GEPA and a separate validation split with:

```bash
.venv/bin/python scripts/judge_eval.py optimize \
  --max-metric-calls 150
```

The evaluator defaults to `gpt-5.4-mini`; GEPA reflection defaults to `gpt-5.6-luna`.
Override either with `OPENAI_ROLE_EVALUATION_MODEL`,
`OPENAI_ROLE_EVALUATION_REFLECTION_MODEL`, or the optimizer's `--reflection-model` option.
The default budget is approximately 150 `gpt-5.4-mini` evaluator calls. Luna reflection calls are
adaptive—normally one per prompt proposal—and are additional to GEPA's metric-call budget.

The command saves `scripts/judge_eval_program.json`. Harness runs load it automatically. Local
Compose also loads that artifact by default from `/app/scripts/judge_eval_program.json`; other
deployments should set `DSPY_ROLE_EVALUATION_PROGRAM_PATH` explicitly. Both the seed and compiled
instructions are checked for labeled card names; a leaking GEPA candidate is rejected rather than
saved.

Production hashes the exact saved artifact into a `prompt_version`. That immutable version is
stored with every evaluation, returned by the API, and included in the cache identity alongside the
stable evaluator/scorer version. Promoting a different artifact therefore makes prior role scores
cache misses without deleting their historical rows.

Each optimization starts in a new timestamped directory under `scripts/judge_eval_gepa_runs/`, and
GEPA checkpoints it after each iteration. Pass `--resume` to continue the most recently updated
checkpoint; this also recognizes the legacy `scripts/judge_eval_gepa_run/` directory. Proposal-time
validation gives Luna two repair attempts to remove any labeled card names before a candidate can
consume evaluator rollouts; the final pre-save check remains as a defense-in-depth guard.

For a graceful stop, create `gepa.stop` inside the run directory printed when optimization starts;
GEPA notices it at an iteration boundary and saves state. Remove that stop file before running with
`--resume`.
