# GZW Data

**Gray Zone Warfare** — Fan-made game data repository.

Structured JSON data scraped from the [GZW Fandom Wiki](https://gray-zone-warfare.fandom.com). Updated regularly via automated pipelines.

## Files

| File | Items | Description |
|------|-------|-------------|
| `armor.json` | 61 | Vests, plate carriers & helmets with NIJ class, material, weight, grid, source |
| `weapons.json` | 51 | Weapons with type, caliber, mag size, fire rate, source, image |
| `backpacks.json` | 16 | Backpacks with weight, grid size, image |
| `rigs.json` | 12 | Tactical rigs with weight, grid size, image |
| `keys.json` | 124 | Keys & keycards with location, wiki link, task flag |
| `tasks.json` | 278 | Mission database with vendor, area, objectives, rewards |
| `ammo.json` | see `images.json` | Ammunition data (embedded in `images.json` via key-value pairs) |
| `ammo/` | — | Ammo data in TS module format (caliber, speed, pen values) |
| `throwables.json` | 8 | Grenades: frag, smoke, stun |
| `vests.json` | 37 | Vest data (scraper source) |
| `images.json` | 199 | Item image URL lookup by name |
| `map_data.json` | — | Interactive map data (POIs, grid, COPs) |
| `vendor_images.json` | 7 | Vendor avatar/image URLs |

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
