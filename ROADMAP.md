# GZW Data API Roadmap

This roadmap covers the `gzw-data` repository: the public Gray Zone Warfare API, generated dataset metadata, OpenAPI document, web console, and snapshot/change endpoints.

## Current status

- **API version:** `v1`
- **Implementation version:** `4.6.0` (deployed and production-verified)
- **Production API:** https://gzw-data.dev/api/v1
- **Datasets:** use the live `/api/v1/stats` response; static dataset totals are intentionally not maintained
- **Verification:** use the current GitHub Actions run; static test counts are intentionally not maintained
- **License:** MIT
- **Authentication:** none required for the public read-only API

## Version targets

These are planning milestones, not promises to release without verified scope and tests.

### `4.0.x` — current API line

- [x] Versioned `/api/v1` API with legacy compatibility.
- [x] Stable response envelopes, errors, metadata, schema, health, readiness, search, snapshots, and changes.
- [x] Read-only public API with generated dataset discovery.

Current implementation: `4.6.0` (verified through the production `/api/v1/version` endpoint).

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

### `4.4.0` — documentation and consumer readiness

- [x] Document list, pagination, single-record, metadata, schema, and error envelopes.
- [x] Publish the response contract in the repository and web API reference.
- [x] Align the implementation version, package metadata, tests, README, and roadmap.

### `4.5.0` — dataset freshness and source provenance

- [x] Expose per-dataset `lastScrapedAt` and source-page revision IDs in metadata.
- [x] Distinguish the most recent full scrape with `lastFullScrapeAt`.
- [x] Preserve dataset freshness metadata in summary and single-dataset routes.
- [x] Retire the stale singular `plate_carrier` dataset; `plate_carriers` is canonical.

### `4.6.0` — normalized values, ID compatibility, and monitoring

- [x] Add optional unit-aware numeric projections while retaining source strings.
- [x] Support reviewed legacy record IDs through a validated alias registry.
- [x] Monitor full-scrape freshness and recover stale-data alerts.
- [x] Align CI and the runtime floor with Node.js 22+; verify Node 22 and 24.
- [x] Document code/data license scope and source attribution.

### `5.0.0` — breaking API line, only if required

- [ ] Publish only for an intentional breaking public API change.
- [ ] Provide migration notes and a compatibility window.
- [ ] Update OpenAPI, SDK contract tests, client documentation, and examples together.

## Completed

- [x] Redesign the web console homepage: quick start, filterable dataset catalog, clients section, consistent spacing, and a multi-column footer.
- [x] Improve SEO and performance: Open Graph/Twitter tags, JSON-LD, sitemap `lastmod`, `noindex` on 404, smaller favicons, and static-asset cache headers.
- [x] Count combined views (`armor`, `weapon_parts`, `helmet_mods`) only once in headline totals.
- [x] Publish an official Python client ([gzw-data on PyPI](https://pypi.org/project/gzw-data/), source in [gzw-data-py](https://github.com/ZoniBoy00/gzw-data-py)) alongside the JavaScript SDK, with a documentation page at `/docs/python/` and automatic PyPI releases on every version bump.

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

## Security regression coverage

- [x] Add browser, API contract and CDN/header regression tests with local/preview targets and CI report artifacts. See [security testing](docs/security-testing.md).
- [ ] Confirm a complete remote run for each protected-preview configuration and keep its automation bypass secret configured if needed.

## Next priorities

_Last reviewed: 2026-10-23 against implementation `4.6.0`. Every unchecked item below is deliberately conditional: none has a known consumer or measured need yet, so none is scheduled._

### 1. API and SDK contract tests

- [x] Add an explicit contract test for the 429/rate-limit response.
- [x] Verify list, single-record, pagination, search, stats, metadata, schema, and error envelopes against the SDK.
- [x] Keep live contract checks small, read-only, and rate-limit aware.

### 2. CI and release safety

- [x] Add push and pull-request CI for this repository.
- [x] Run syntax checks, API tests, diff checks, and relevant lint checks in CI.
- [x] Add a schema/data drift gate before deployment.
- [x] Add dependency update automation.

### 3. OpenAPI and versioning

- [x] Make every public operation codegen-ready with route-specific response schemas.
- [x] Document list, pagination, single-record, metadata, schema, and error envelopes. (Implemented in `docs/API_CONTRACT.md` and the web API reference.)
- [x] Separate `apiVersion: v1` from `implementationVersion` (currently `4.6.0`) in public documentation.
- [x] Define how breaking dataset field changes are versioned and deprecated.

### 4. Caching and performance

- [x] Verify CDN conditional requests and document the `dataVersion` validator context.
- [ ] Consider field selection, for example `?fields=id,name,image`, only for a real consumer. (Not started; no consumer request. Note `/search?fields=` already selects fields to *search*, not to return.)
- [ ] Consider multi-value filters only when a real consumer needs them.
- [ ] Build an inverse index for `/items/{id}/context` if dataset size or request volume makes the current scan expensive. (The published `data/` is about 2 MB, so the scan is cheap today.)
- [ ] Replace the warm-instance rate limiter with a shared store only if traffic requires a strict global quota. (Current limiter is best-effort per warm instance, as documented in the README.)

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
- [x] Fix local development scripts so a real local HTTP server is available without guessing.

## Definition of done for API changes

- The `/api/v1` behavior is documented.
- A regression or contract test exists.
- OpenAPI is updated when the public contract changes.
- Dataset changes include verifiable evidence.
- `node --check api/index.js` and `npm test` pass.
- Live verification is read-only and its actual result is recorded.
