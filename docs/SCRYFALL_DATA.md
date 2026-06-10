# Scryfall Data Strategy

Scryfall's `default_cards` bulk data export is the source for Survail's English card catalog,
search, exact-printing selection, and legality snapshots.

The live Scryfall HTTP API is used to discover current bulk export metadata and as a protected
fallback for advanced search syntax.

It must not be used for:

- Refreshing every card while validating a deck.
- Loading sample decks one card at a time in normal operation.
- Synchronizing the complete card catalog.

## Target Architecture

1. A catalog-import job requests `/bulk-data`, selects the `default_cards` object, and downloads
   its current `download_uri`.
2. The importer validates upstream records and upserts exact printings into PostgreSQL.
3. Supported filter search and printing lookup query the local catalog.
4. Advanced or unsupported syntax falls back to Scryfall search through the shared Redis limiter.
5. Redis caches advanced-search responses by normalized query and page.

`default_cards` includes English card objects and avoids importing every localized printing.

Bulk exports belong in PostgreSQL or temporary import storage, not in the no-eviction Redis cache.
Redis should remain bounded to hot responses and coordination state before production deployment.

## Local Search Syntax

Survail intentionally implements a useful subset of Scryfall syntax instead of claiming complete
compatibility with Scryfall's parser and ranking:

- Free text and `name:` / `n:` search card names.
- `oracle:` / `o:` searches oracle text.
- `type:` / `t:` searches type lines.
- `set:` / `s:`, `rarity:` / `r:`, and `lang:` match printing metadata.
- `format:` / `f:` / `legal:` filters legal or restricted cards.
- `color:` / `c:` and `identity:` / `id:` require the listed colors.
- `mv:` / `cmc:` support `=`, `<`, `<=`, `>`, and `>=`.
- Prefix a term with `-` to negate it. Quote values containing spaces.

Unsupported operators defer to Scryfall search. Their responses are cached for 24 hours by default.

Scryfall's bulk records contain enough data for these filters and many future operators. They do
not contain Scryfall's parser, aliases, fuzzy matching rules, ranking behavior, or every derived
property used by scryfall.com.

## Import

`setup.sh` runs migrations and then imports the catalog when Scryfall reports a newer
`default_cards` export. After a new export is installed, the importer fills missing Oracle
embeddings through the resumable embedding worker.
To refresh it manually:

```bash
cd api
.venv/bin/python -m survail.catalog_import
```

Refreshing with embeddings requires `OPENAI_API_KEY`. For catalog-only maintenance:

```bash
.venv/bin/python -m survail.catalog_import --skip-embeddings
```

## Current Safeguards

- All live requests go through one `ScryfallClient`.
- Redis atomically spaces requests across all API processes.
- The configured default is 5 requests per second, below Scryfall's 10 request-per-second limit.
- A `429` response creates a shared Redis cooldown honored by every process.
- A `429` response is never automatically retried.
- Validation, supported-filter search, exact-printing lookup, deck edits, and sample-deck creation
  use PostgreSQL and make no live Scryfall requests.
- Advanced searches use the protected Scryfall endpoint and a configurable Redis TTL cache.
