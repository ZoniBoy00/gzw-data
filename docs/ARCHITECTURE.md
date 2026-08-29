# GZW Data architecture

```mermaid
flowchart LR
  W[Gray Zone Warfare wiki] --> S[gzw-scraper]
  S -->|datasets + manifest + checksums| D[gzw-data repository]
  D --> A[Public Vercel API /api/v1]
  D --> C[Web console + OpenAPI]
  A --> J[@zoniboy/gzw-data-client]
  J --> T[gzw-tools]
  J --> B[Discord bots and integrations]
  A --> H[Snapshots, changes, health, readiness]
```

## Ownership

- `gzw-scraper` discovers and parses source wiki pages, validates output, and emits generated datasets plus `_manifest.json`.
- `gzw-data` publishes the generated datasets, API handler, metadata, OpenAPI document, snapshot history, and web console.
- `@zoniboy/gzw-data-client` provides the typed zero-dependency JavaScript/TypeScript API client.
- `gzw-tools`, Discord bots, and other consumers use the public API or SDK; they do not edit generated data.

## Data flow

1. The scheduled scraper discovers categories and writes sorted JSON datasets.
2. The scraper creates a manifest with per-dataset record counts and SHA-256 checksums.
3. The workflow copies datasets and the manifest to `gzw-data`.
4. CI validates JSON, metadata/data consistency, syntax, lint, tests, and whitespace.
5. Snapshot recording preserves a bounded history of immutable version identifiers.
6. Vercel serves the read-only API and web documentation.

## Contract boundary

New integrations use `/api/v1`. The unversioned `/api` prefix remains for compatibility. The SDK contract tests run against a local mock handler and a small read-only production smoke check. Public contract changes require API tests, OpenAPI updates, SDK checks, and documentation updates together.
