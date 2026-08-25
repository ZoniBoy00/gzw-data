# GZW Data

**Gray Zone Warfare** — Comprehensive fan-made game data repository & API.

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Donate](https://img.shields.io/badge/donate-Buy%20me%20a%20coffee-f0b429?logo=buymeacoffee)](https://buymeacoffee.com/zoniboy00)

Automatically scraped from the [GZW Fandom Wiki](https://gray-zone-warfare.fandom.com/wiki/Gray_Zone_Warfare_Wiki) — covers **85+ game datasets** with automatic discovery of new ones.

> **Free Gray Zone Warfare API for weapons, missions, loot, armor and game data.** No API key required.

- **Live API:** https://gzw-data.vercel.app/api
- **API Reference:** https://gzw-data.vercel.app/docs/
- **OpenAPI spec:** https://gzw-data.vercel.app/api/spec
- **JavaScript / TypeScript client:** [@zoniboy/gzw-data-client](https://www.npmjs.com/package/@zoniboy/gzw-data-client)
- **Discord bot example:** [`examples/discord-bot`](./examples/discord-bot)

The API is intended for community tools, Discord bots, dashboards and other Gray Zone Warfare projects. Data is refreshed by the public scraper workflow and exposes both collection and single-record routes.
## Quick Start

```bash
# Raw data (no API needed)
curl https://raw.githubusercontent.com/ZoniBoy00/gzw-data/main/data/weapons.json

# Or via the API (auto-deployed)
curl https://gzw-data.vercel.app/api/weapons
curl https://gzw-data.vercel.app/api/weapons/ak-12
curl https://gzw-data.vercel.app/api/keys?type=Keycard
curl https://gzw-data.vercel.app/api/medical
```

## Web Console & Documentation

The API includes a dark, responsive developer console for exploring live datasets and copying request examples:

- **Console:** https://gzw-data.vercel.app/
- **Quick start & API reference:** https://gzw-data.vercel.app/docs/#quickstart
- **OpenAPI spec:** https://gzw-data.vercel.app/api/spec
- **API root:** https://gzw-data.vercel.app/api
- **JavaScript / TypeScript client:** https://www.npmjs.com/package/@zoniboy/gzw-data-client

The console includes a live dataset explorer, search, pagination, dataset counts, endpoint catalog, query examples and responsive mobile navigation. No API key is required. The official zero-dependency client supports Node.js 18+, modern browsers, JavaScript and TypeScript.

Unknown routes use a matching custom 404 page with direct links back to the console, Quick start and API root.


## API v4

Base URL: `https://gzw-data.vercel.app`

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api` | API root — lists all endpoints |
| `/api/<dataset>` | Any dataset by name (auto-discovered) |
| `/api/<dataset>/<id>` | One dataset record by exact ID |
| `/api/stats` | Item counts for all datasets plus the latest scrape timestamp |
| `/api/search?q=` | Cross-dataset search |
| `/api/spec` | OpenAPI 3.0 spec |
| `/api/images` | All item images (400+) |
| `/api/armor` | Smart route: vests + helmets + glasses |
| `/api/weapon_parts` | Smart route: all weapon parts combined |
| `/api/helmet_mods` | Smart route: night vision + mounts |

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

- **100 requests/minute/IP**
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Returns `429` with `Retry-After` header when exceeded

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
  "timestamp": "2026-07-28T12:00:00.000Z"
}
```

Unpaginated responses omit `page`, `perPage`, `total`, `totalPages`.

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
  "timestamp": "2026-07-28T12:00:00.000Z"
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
  "timestamp": "2026-07-28T12:00:00.000Z"
}
```
