# GZW Data

**Gray Zone Warfare** — Comprehensive fan-made game data repository & API.

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Automatically scraped from the [GZW Fandom Wiki](https://gray-zone-warfare.fandom.com/wiki/Gray_Zone_Warfare_Wiki) — covers **120+ game categories** with automatic discovery of new ones.

## Quick Start

```bash
# Raw data (no API needed)
curl https://raw.githubusercontent.com/ZoniBoy00/gzw-data/main/data/weapons.json

# Or via the API (auto-deployed)
curl https://gzw-data.vercel.app/api/weapons
curl https://gzw-data.vercel.app/api/keys?location=Ban%20Pa
curl https://gzw-data.vercel.app/api/medical
```

## API

Base URL: `https://gzw-data.vercel.app`

| Endpoint | Description |
|----------|-------------|
| `/api` | API root — lists all endpoints |
| `/api/<dataset>` | Any dataset by name (auto-discovered) |
| `/api/stats` | Item counts for all datasets |
| `/api/search?q=` | Cross-dataset search |
| `/api/spec` | OpenAPI 3.0 spec |
| `/api/images` | All item images (400+) |
| `/api/armor` | Smart route: vests + helmets + glasses |
| `/api/weapon_parts` | Smart route: all weapon parts combined |
| `/api/helmet_mods` | Smart route: night vision + mounts |

**Filters:** `?field=value` on any string field, `?search=` for free text, `?sort=field:asc|desc`, `?limit=N`

**Rate limit:** 100 req/min/IP. Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Returns `429` when exceeded.

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

All endpoints return:

```json
{
  "data": [ ... ],
  "count": 44,
  "source": "GZW Data API",
  "timestamp": "2026-07-20T12:00:00.000Z"
}
```
