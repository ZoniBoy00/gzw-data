# GZW Data

**Gray Zone Warfare** — Comprehensive fan-made game data repository & API.

Automatically scraped from the [GZW Fandom Wiki](https://gray-zone-warfare.fandom.com/wiki/Gray_Zone_Warfare_Wiki) — covers **all 4 main wiki categories**: Basics, Systems, Gear & Items, Factions.

## Quick Start

```bash
# Raw data (no API needed)
curl https://raw.githubusercontent.com/ZoniBoy00/gzw-data/main/data/weapons.json

# Or via the API (auto-deployed)
curl https://gzw-data.vercel.app/api/weapons
curl https://gzw-data.vercel.app/api/keys?location=Ban%20Pa
curl https://gzw-data.vercel.app/api/medical
curl https://gzw-data.vercel.app/api/factions
```

## Data Files

All files live in `data/`. Every file is an array of `{ name, id, ...fields, image }` objects.

| File | Description |
|------|-------------|
| **Equipment** | |
| `weapons.json` | All weapons (type, caliber, mag size, fire rate) |
| `ammo.json` | Ammunition with penetration data by armor class |
| `vests.json` | Armor vests & plate carriers (NIJ rating, material, grid) |
| `helmets.json` | Helmets & head protection |
| `backpacks.json` | Backpacks (weight, grid) |
| `rigs.json` | Tactical rigs (weight, grid) |
| `throwables.json` | Grenades (frag, smoke, stun) |
| **Armor & Wearables** | |
| `glasses.json` | Eyewear / ballistic glasses |
| `face_cover.json` | Face covers & masks |
| `headsets.json` | Headset/earmuffs |
| `headwear_items.json` | Caps, headwear |
| `belts.json` | Belts & belt accessories |
| **Medical & Supplies** | |
| `medical.json` | Medical items (bandages, surgery kits, splints) |
| `provisions.json` | Food & drink provisions (37 items) |
| `food.json` | Food items |
| `drinks.json` | Drinks |
| **Containers & Loot** | |
| `containers.json` | Storage (ammo boxes, weapon cases) |
| `loot_containers.json` | World-spawn loot containers |
| `loot_items.json` | **120 loot items** (alcohol, jewelry, electronics, intel) |
| **Weapon Parts** | |
| `magazines.json` | Magazines |
| `barrels.json` | Barrels |
| `muzzle_devices.json` | Muzzle attachments |
| `suppressors.json` | Suppressors |
| `stocks.json` | Stocks |
| `stock_adapters.json` | Stock adapters |
| `pistol_grips.json` | Pistol grips |
| `foregrips.json` | Foregrips |
| `weapon_parts.json` | General weapon parts (Weapon Parts category) |
| **Helmet Mods & Electronics** | |
| `helmet_mods.json` | Helmet modifications |
| `helmet_mounts.json` | Helmet mounts |
| `night_vision.json` | Night vision devices |
| **Tools & Equipment** | |
| `repair_kits.json` | Weapon/gear repair kits |
| `tools.json` | Tools |
| `military_equipment.json` | Military equipment |
| `gear.json` | Miscellaneous gear |
| **Game Items** | |
| `keys.json` | Keys & keycards (location, use) |
| `keycards.json` | Keycards only |
| `task_items.json` | Task-specific items |
| `weapon_camos.json` | Weapon camouflage skins |
| **Reference** | |
| `factions.json` | Faction info (lore, logos) |
| `info_pages.json` | Reference pages (Health, Ballistics, Trading, etc.) |
| `item_images.json` | Item image URL lookup (400+ entries) |
| `tasks.json` | Mission database (vendor, area, objectives) |
| `apparel_items.json` | **63 apparel items** (clothing, gloves, boots, shirts) |

## API (Vercel Serverless)

The repo deploys to Vercel as a fully dynamic API at `/api/*`.

### Endpoints

All data files are available via `/api/<filename-without-json>`.

| Endpoint | Description |
|----------|-------------|
| `GET /api` | API root — endpoint list |
| `GET /api/weapons` | Weapons database | `?type=`, `?caliber=`, `?search=` |
| `GET /api/armor` | **Combined armor** (vests + helmets + glasses, 91+ items) | `?type=`, `?nij=`, `?material=`, `?category=` |
| `GET /api/weapon_parts` | **Combined parts** (barrels, stocks, grips, etc., 268+ items) | `?search=` |
| `GET /api/helmet_mods` | **Combined mods** (night vision + mounts, 8 items) | `?mod_type=`, `?search=` |
| `GET /api/loot` | **120 loot items** (alcohol, jewelry, electronics) | `?search=` |
| `GET /api/apparel` | **63 apparel items** (clothing, gloves, boots) | `?search=`, `?type=` |
| `GET /api/vests` | Armor vests & plate carriers | `?nij=`, `?material=`, `?type=` |
| `GET /api/ammo` | `?caliber=`, `?search=` |
| `GET /api/medical` | `?type=`, `?search=` |
| `GET /api/keys` | `?location=`, `?type=` |
| `GET /api/tasks` | `?vendor=`, `?area=`, `?search=` |
| `GET /api/factions` | All faction info |
| `GET /api/<dataset>` | Any dataset, with automatic filtering by any field |
| `GET /api/images` | Item image URL lookup (JSON object) |
| `GET /api/stats` | Aggregate statistics |
| `GET /api/search?q=` | Full unified search across all datasets |
| `GET /api/spec` | OpenAPI 3.0 spec (for Swagger UI) |

### Response format

```json
{
  "data": [ ... ],
  "count": 51,
  "source": "GZW Data API",
  "timestamp": "2026-07-20T12:00:00.000Z"
}
```

### Filters

Every endpoint supports query parameter filters on any string field:

```bash
# Filter by field value
curl "https://gzw-data.vercel.app/api/vests?nij=III&material=Ceramic"
curl "https://gzw-data.vercel.app/api/ammo?caliber=5.56x45mm%20NATO"
curl "https://gzw-data.vercel.app/api/keys?location=Ban%20Pa"

# Full-text search within a dataset
curl "https://gzw-data.vercel.app/api/weapons?search=AK"

# Sort by field
curl "https://gzw-data.vercel.app/api/weapons?sort=name:asc"

# Limit results
curl "https://gzw-data.vercel.app/api/tasks?limit=5"
```

### Rate Limiting

100 requests per minute per IP. Response headers include remaining count:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1721234567
```

### Interactive Test Page

The root URL (`/`) serves a live API browser — select any endpoint, fill in parameters, and execute from your browser.

## Schema

Every item follows this base structure, with type-specific fields added per dataset:

```json
{
  "name": "Item Name",
  "id": "item-name-slug",
  "type": "Category",
  "...type-specific-fields": "...",
  "image": "https://static.wikia.nocookie.net/..."
}
```

## Data Sources

- **[GZW Fandom Wiki](https://gray-zone-warfare.fandom.com)** — primary source, all 6,771+ pages
- **[GZW Scraper](https://github.com/ZoniBoy00/gzw-scraper)** — automated weekly scraper (Python)
- **[GZW Tools](https://github.com/ZoniBoy00/gzw-tools)** — frontend tools & interactive map

## Automation

Data is automatically scraped every Monday 06:00 UTC via GitHub Actions (`gzw-scraper` repo) and synced to this repo. The Vercel deployment auto-updates on push.

## License

MIT — Game content belongs to M.A.G. Studios.
