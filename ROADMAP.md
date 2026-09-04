# GZW Data API Roadmap

This roadmap covers the `gzw-data` repository: the public Gray Zone Warfare API, generated dataset metadata, OpenAPI document, web console, and snapshot/change endpoints.

## Current status

- **API version:** `v1`
- **Implementation version:** `4.3.0`
- **Production API:** https://gzw-data.dev/api/v1
- **Datasets:** 85+ auto-discovered JSON datasets
- **Tests:** 45 API tests passing on 2026-09-04
- **License:** MIT
- **Authentication:** none required for the public read-only API

## Version targets

These are planning milestones, not promises to release without verified scope and tests.

### `4.0.x` — current API line

- [x] Versioned `/api/v1` API with legacy compatibility.
- [x] Stable response envelopes, errors, metadata, schema, health, readiness, search, snapshots, and changes.
- [x] Read-only public API with generated dataset discovery.

Current implementation: `4.2.0`.

### `4.1.0` — contract and CI hardening

- [x] Add API–SDK contract coverage, including 429/rate-limit behavior.
- [x] Add push and pull-request CI for the repository.
- [x] Add route-specific OpenAPI response schemas.
- [x] Add schema/data drift validation before deployment.
- [x] Define API and implementation version semantics.

### `4.2.0` — data integrity and snapshot maturity

- [x] Add immutable snapshot identifiers and explicit `latest` semantics.
- [x] Add scraper-run manifest and dataset checksums when the upstream scraper provides them.
- [x] Add capabilities metadata for filters, sorting, counts, and supported operations.
- [x] Document dataset field deprecation and breaking-change handling.

### `4.3.0` — bounded export and HTTP efficiency

- [x] Verify conditional requests and document ETag/`If-None-Match` behavior.
- [x] Measure item context lookup and defer indexing while production measurements show no need.
- [x] Design and test bounded dataset-specific bulk export with a 500-record maximum.
- [ ] Add field selection only when a real consumer needs it.

### `5.0.0` — breaking API line, only if required

- [ ] Publish only for an intentional breaking public API change.
- [ ] Provide migration notes and a compatibility window.
- [ ] Update OpenAPI, SDK contract tests, client documentation, and examples together.

## Completed

- [x] Split the API handler into focused modules while keeping `api/index.js` maintainable.
- [x] Add versioned `/api/v1` routes with legacy `/api` compatibility.
- [x] Add stable error responses and CORS headers for error paths.
- [x] Add pagination, `?limit=`, filtering, sorting, scoped search, field search, fuzzy search, and `?all=true`.
- [x] Add `/health`, `/ready`, and `/debug` routes.
- [x] Keep `/health` and `/ready` lightweight; keep detailed diagnostics in `/debug`.
- [x] Add `/version`, `/stats`, `/metadata`, `/schema/{dataset}`, `/changes`, `/images`, and item context routes.
- [x] Generate dataset metadata from the published JSON data.
- [x] Generate OpenAPI dataset schemas from the same metadata source.
- [x] Add snapshot history and dataset-count change reporting.
- [x] Connect snapshot recording to the scraper workflow.
- [x] Add deterministic smart routes for armor, weapon parts, and helmet mods.
- [x] Keep unsupported weapon compatibility and task requirement relationships unavailable until verified source data exists.
- [x] Add GitHub Issue Forms for API bugs, data quality issues, and feature requests.

## Next priorities

### 1. API and SDK contract tests

- [x] Add an explicit contract test for the 429/rate-limit response.
- [x] Verify list, single-record, pagination, search, stats, metadata, schema, and error envelopes against the SDK.
- [x] Keep live contract checks small, read-only, and rate-limit aware.

### 2. CI and release safety

- [x] Add push and pull-request CI for this repository.
- [x] Run syntax checks, API tests, diff checks, and relevant lint checks in CI.
- [x] Add a schema/data drift gate before deployment.
- [ ] Add dependency update automation.

### 3. OpenAPI and versioning

- [x] Make every public operation codegen-ready with route-specific response schemas.
- [ ] Document list, pagination, single-record, metadata, schema, and error envelopes.
- [x] Separate `apiVersion: v1` from `implementationVersion: 4.3.0` in public documentation.
- [x] Define how breaking dataset field changes are versioned and deprecated.

### 4. Caching and performance

- [x] Verify CDN conditional requests and document the `dataVersion` validator context.
- [ ] Consider field selection, for example `?fields=id,name,image`, only for a real consumer.
- [ ] Consider multi-value filters only when a real consumer needs them.
- [ ] Build an inverse index for `/items/{id}/context` if dataset size or request volume makes the current scan expensive.
- [ ] Replace the warm-instance rate limiter with a shared store only if traffic requires a strict global quota.

### 5. Snapshot and data integrity

- [x] Document immutable snapshot identifiers and `latest` semantics.
- [x] Never overwrite a snapshot with the same version identifier.
- [x] Add dataset-level checksums when they provide a measurable benefit.
- [x] Add scraper-run manifest to the published data when the scraper supports it.

### 6. Export

- [x] Define payload size, cache behavior, and maximum scope for dataset exports.
- [x] Use `/export/{dataset}` instead of an unbounded export endpoint.
- [x] Add tests for maximum export size, filtering, OpenAPI, and response headers.

## Intentionally blocked until verified data exists

- [ ] Weapon-to-part compatibility endpoint.
- [ ] Task-to-item requirements endpoint.
- [ ] Map/location data.

Do not infer these relationships from matching names or descriptions.

## Documentation

- [x] Add `SECURITY.md` with private vulnerability reporting guidance.
- [x] Add a shared architecture diagram linking scraper, API, SDK, and consumers.
- [x] Add more examples for curl, JavaScript, TypeScript, Python, browser fetch, and bots.
- [ ] Fix local development scripts so a real local HTTP server is available without guessing.

## Definition of done for API changes

- The `/api/v1` behavior is documented.
- A regression or contract test exists.
- OpenAPI is updated when the public contract changes.
- Dataset changes include verifiable evidence.
- `node --check api/index.js` and `npm test` pass.
- Live verification is read-only and its actual result is recorded.
