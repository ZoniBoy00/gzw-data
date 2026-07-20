# GZW Data

**Gray Zone Warfare** — Fan-made game data repository.

Structured JSON data in `data/` directory, scraped from the [GZW Fandom Wiki](https://gray-zone-warfare.fandom.com).

## Quick Start

```bash
# Raw data (no API needed)
curl https://raw.githubusercontent.com/ZoniBoy00/gzw-data/main/data/armor.json

# Or use the API (when deployed)
curl https://gzw-data.vercel.app/api/weapons
curl https://gzw-data.vercel.app/api/keys?location=Ban%20Pa
```

## Files

| File | Items | Description |
|------|-------|-------------|
| `armor.json` | 61 | Vests, plate carriers & helmets with NIJ class, material, weight, grid, source |
| `weapons.json` | 51 | Weapons with type, caliber, mag size, fire rate, source, image |
| `backpacks.json` | 16 | Backpacks with weight, grid size, image |
| `rigs.json` | 12 | Tactical rigs with weight, grid size, image |
| `keys.json` | 124 | Keys & keycards with location, wiki link, task flag |
| `tasks.json` | 278 | Mission database with vendor, area, objectives, rewards |
| `throwables.json` | 8 | Grenades: frag, smoke, stun |
| `images.json` | 199 | Item image URL lookup by name |
| `map_data.json` | — | Interactive map data (POIs, grid, COPs) |
| `vendor_images.json` | 7 | Vendor avatar/image URLs |

## API

The repo includes a Vercel serverless API at `/api/*`.

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api` | API root — endpoint list |
| `GET /api/armor` | All armor items (`?type=`, `?material=`, `?nij=`) |
| `GET /api/weapons` | Weapons database (`?type=`, `?caliber=`, `?search=`) |
| `GET /api/backpacks` | Backpacks & rigs (`?type=Backpack\|Tactical Rig`) |
| `GET /api/keys` | Keys & keycards (`?location=`) |
| `GET /api/tasks` | Mission database (`?vendor=`, `?area=`, `?search=`) |
| `GET /api/throwables` | Grenade data |
| `GET /api/images` | Image URL lookup (199 entries) |
| `GET /api/stats` | Aggregate statistics |
| `GET /api/search?q=` | Unified search |
| `GET /api/spec` | OpenAPI 3.0 spec (for Swagger UI) |

### Response format

All endpoints return:

```json
{
  "data": { ... },
  "count": 51,
  "source": "GZW Data API",
  "timestamp": "2026-07-20T12:00:00.000Z"
}
```

### Swagger UI

When deployed to Vercel, the root URL (`/`) serves an interactive Swagger UI documentation page where you can browse endpoints and try them live.

### Deploy your own

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ZoniBoy00/gzw-data)

## Schema

Every item follows this structure:

```json
{
  "name": "Item Name",
  "id": "item-name-slug",
  "type": "Category",
  ...type-specific-fields,
  "image": "https://static.wikia.nocookie.net/..."
}
```

## Data Sources

- [GZW Fandom Wiki](https://gray-zone-warfare.fandom.com) — primary source
- [GZW Tools](https://github.com/ZoniBoy00/gzw-tools) — scraper & tooling

## License

MIT — Game content belongs to M.A.G. Studios.
