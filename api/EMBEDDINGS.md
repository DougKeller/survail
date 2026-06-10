# Oracle Embedding Backfill

Apply migrations and ensure the Scryfall bulk catalog has been imported. Then run:

```bash
survail-backfill-embeddings --batch-size 64 --concurrency 4
```

The command requires `OPENAI_API_KEY`. It embeds one canonical, face-aware English payload per
unique `oracle_id` with `text-embedding-3-large` at 3072 dimensions. Rows are refreshed when they
are missing, use a different model, or have a source hash that differs from the current canonical
card payload. Upserts are conflict-safe, and rerunning the command resumes the backfill.

The command sends requests to OpenAI and incurs embedding usage charges.

Catalog refreshes also run this missing-embedding pass after installing a newer Scryfall
`default_cards` export. Existing vectors are retained and only newly discovered Oracle IDs are
sent to OpenAI.

Migration `20260609_0008` performs a one-time source-hash normalization for existing vectors using
their stored source text. It does not contact OpenAI or regenerate vectors.
