# GZW Data

**Gray Zone Warfare** — Comprehensive fan-made game data repository & API.

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Donate](https://img.shields.io/badge/donate-Buy%20me%20a%20coffee-f0b429?logo=buymeacoffee)](https://buymeacoffee.com/zoniboy00)

Automatically scraped from the [GZW Fandom Wiki](https://gray-zone-warfare.fandom.com/wiki/Gray_Zone_Warfare_Wiki) — covers **85+ game datasets** with automatic discovery of new ones.

> **Free Gray Zone Warfare API for weapons, missions, loot, armor and game data.** No API key required.

- **Live API:** https://gzw-data.dev/api/v1
- **API Reference:** https://gzw-data.dev/docs/
- **OpenAPI spec:** https://gzw-data.dev/api/v1/spec
- **JavaScript / TypeScript client:** [@zoniboy/gzw-data-client](https://www.npmjs.com/package/@zoniboy/gzw-data-client)
- **Discord bot example:** [`examples/discord-bot`](./examples/discord-bot)

The API is intended for community tools, Discord bots, dashboards and other Gray Zone Warfare projects. Data is refreshed by the public scraper workflow and exposes both collection and single-record routes.
## Quick Start

```bash
# Raw data (no API needed)
curl https://raw.githubusercontent.com/ZoniBoy00/gzw-data/main/data/weapons.json

# Or via the API (auto-deployed)
curl https://gzw-data.dev/api/v1/weapons
curl https://gzw-data.dev/api/v1/weapons/ak-12
curl https://gzw-data.dev/api/v1/keys?type=Keycard
curl https://gzw-data.dev/api/v1/medical
```

## Web Console & Documentation

The API includes a dark, responsive developer console for exploring live datasets and copying request examples:

- **Console:** https://gzw-data.dev/
- **Quick start & API reference:** https://gzw-data.dev/docs/#quickstart
- **OpenAPI spec:** https://gzw-data.dev/api/v1/spec
- **API root:** https://gzw-data.dev/api/v1
- **JavaScript / TypeScript client:** https://www.npmjs.com/package/@zoniboy/gzw-data-client

The console includes a live dataset explorer, search, pagination, dataset counts, endpoint catalog, query examples and responsive mobile navigation. No API key is required. The official zero-dependency client supports Node.js 18+, modern browsers, JavaScript and TypeScript.

Unknown routes use a matching custom 404 page with direct links back to the console, Quick start and API root.


## API v4

Base URLs:

- Legacy-compatible: `https://gzw-data.dev/api`
- Versioned: `https://gzw-data.dev/api/v1`

Both prefixes currently expose the same API contract. New integrations should prefer `/api/v1`.

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/v1` | API root — lists all endpoints |
| `/api/v1/<dataset>` | Any dataset by name (auto-discovered) |
| `/api/v1/<dataset>/<id>` | One dataset record by exact ID |
| `/api/v1/metadata` | Dataset schema registry (field names and counts) |
| `/api/v1/metadata/<dataset>` | Detailed schema metadata for one dataset |
| `/api/v1/schema/<dataset>` | Machine-readable schema for one dataset |
| `/api/v1/metadata?full=true` | Detailed schema metadata for all datasets |
| `/api/v1/health` | Lightweight API liveness check |
| `/api/v1/ready` | Lightweight readiness probe; returns 503 until datasets are loaded |
| `/api/v1/version` | API version, data version and available dataset names |
| `/api/v1/changes` | Dataset count changes since the latest stored snapshot |
| `/api/v1/stats` | Item counts for all datasets plus the latest scrape timestamp |
| `/api/v1/search?q=` | Cross-dataset search; supports `dataset`, `fields`, `fuzzy` and `limit` |
| `/api/v1/spec` | OpenAPI 3.0 spec |
| `/api/v1/images` | All item images (400+) |
| `/api/v1/items/<id>/context` | Item plus current vendor and dataset references |
| `/api/v1/armor` | Smart route: vests + helmets + glasses |
| `/api/v1/weapon_parts` | Smart route: all weapon parts combined |
| `/api/v1/helmet_mods` | Smart route: night vision + mounts |

### Project documentation

- [Security policy](SECURITY.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Contributing guide](CONTRIBUTING.md)

The scraper publishes a `_manifest.json` file with per-dataset record counts and SHA-256 checksums. CI validates dataset JSON and generated metadata before changes can be merged.

## API examples

### JavaScript

```js
const response = await fetch('https://gzw-data.dev/api/v1/weapons?per_page=5');
const payload = await response.json();
console.log(payload.data, payload.total);
```

### Python

```python
import requests

payload = requests.get(
    'https://gzw-data.dev/api/v1/search',
    params={'q': 'ak-12'},
    timeout=10,
).json()
print(payload['data'])
```

### Version and changes

```bash
curl https://gzw-data.dev/api/v1/version
curl https://gzw-data.dev/api/v1/changes
```

The version response identifies the current API and data snapshot. The changes response compares dataset record counts against the latest stored snapshot. It reports `hasHistory: false` until a second snapshot is available; it never invents changes without a previous snapshot.

After a scraper update, record a new snapshot with:

```bash
npm run snapshot:record
```

The repository retains the 30 most recent snapshots in `data/_history.json`.

### Query Parameters

| Param | Example | Description |
|-------|---------|-------------|
| `?field=value` | `?type=Keycard` | Filter by any string field |
| `?search=` | `?search=ak` | Free text search across all fields |
| `?sort=` | `?sort=name:asc` | Sort results by field |
| `?page=` | `?page=2` | Page number (default: 1) |
| `?per_page=` | `?per_page=10` | Items per page (default: 50, max: 500) |
| `?all=true` | `?all=true` | Disable pagination, return all results |
| `?limit=` | `?limit=5` | Cap results (applied after filters) |

### Rate Limiting

The API advertises a **best-effort limit of 100 requests/minute/IP**. The current sliding-window limiter keeps counters in the memory of each warm serverless function instance. Because Vercel can run multiple instances that do not share memory, this is not a strict global quota and should not be treated as an abuse-prevention guarantee.

- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Returns `429` with `Retry-After` header when the active instance limit is exceeded
- Clients should cache responses, respect `Retry-After`, and avoid unnecessary polling
- A shared datastore such as Upstash Redis or Vercel KV would be required for a strict global quota

### Caching

All data endpoints include `Cache-Control: public, max-age=300` headers. CDN and browser caching are encouraged.

### Paginated Response

```json
{
  "data": [ ... ],
  "count": 10,
  "page": 2,
  "perPage": 10,
  "total": 44,
  "totalPages": 5,
  "source": "GZW Data API",
  "timestamp": "2026-07-28T12:00:00.000Z",
  "dataVersion": "2026-08-25T11:12:54.629187Z"
}
```

Unpaginated responses omit `page`, `perPage`, `total`, `totalPages`.

### Error Response

All HTTP errors use the same response envelope and a stable `error.code`:

```json
{
  "error": {
    "code": "DATASET_NOT_FOUND",
    "message": "Dataset data not found",
    "dataset": "foo"
  },
  "source": "GZW Data API",
  "timestamp": "2026-08-26T12:00:00.000Z"
}
```

Common codes are `DATASET_NOT_FOUND`, `RECORD_NOT_FOUND`, `ENDPOINT_NOT_FOUND`, `INVALID_REQUEST`, `METHOD_NOT_ALLOWED`, `RATE_LIMITED` and `INTERNAL_ERROR`. Rate-limited responses also include `retryAfter` inside `error` and the `Retry-After` HTTP header.

### Single-record Response

```http
GET /api/weapons/ak-12
```

The response uses the same `data` envelope as collection routes, with one record instead of an array:

```json
{
  "data": {
    "id": "ak-12",
    "name": "AK-12"
  },
  "source": "GZW Data API",
  "timestamp": "2026-07-28T12:00:00.000Z",
  "dataVersion": "2026-08-25T11:12:54.629187Z"
}
```

Unknown IDs return `404` with the dataset and requested ID in the response.

## Data Files

Every `.json` file in `data/` is auto-discovered and becomes an API endpoint. **New categories appear automatically** — no code changes needed.

| Category | Files | Items |
|----------|-------|-------|
| Weapons | `weapons.json` | 44+ |
| Ammo | `ammo.json` | 67+ |
| Armor | `vests.json`, `helmets.json` | 60+ |
| Backpacks | `backpacks.json` | 17+ |
| Keys | `keys.json`, `keycards.json` | 124+ |
| Tasks | `tasks.json` | 130+ |
| Medical | `medical.json` | 34+ |
| Weapon parts | `barrels.json`, `stocks.json`, `magazines.json`, etc. | 200+ |
| Wearables | `glasses.json`, `face_cover.json`, `headsets.json`, etc. | 100+ |
| Loot | `loot_items.json` | 120+ |

## Automation

Scraper runs every Monday at 06:00 UTC via GitHub Actions. Data is validated before commit — corrupt or empty datasets are rejected.

## Response Format

All endpoints return consistent JSON:

```json
{
  "data": [ ... ],
  "count": 44,
  "source": "GZW Data API",
  "timestamp": "2026-07-28T12:00:00.000Z",
  "dataVersion": "2026-08-25T11:12:54.629187Z"
}
```
