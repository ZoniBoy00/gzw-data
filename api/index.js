// GZW Data API v3 — Fully Dynamic & Auto-Discovering
// Every .json file in /data becomes an API endpoint automatically.
// No hardcoded exclude lists — everything is exposed.
const { createRequire } = require('node:module');
const require2 = createRequire(__filename);
const fs = require('fs');
const path = require('path');

// ─── Auto-load all data files ───
const DATA_DIR = path.join(__dirname, '..', 'data');
const datasets = {};
let dataFiles = [];
try {
  dataFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  for (const f of dataFiles) {
    const key = f.replace('.json', '');
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, f), 'utf-8');
      datasets[key] = JSON.parse(raw);
    } catch (e) {
      console.error(`Failed to load ${f}:`, e.message);
      datasets[key] = null;
    }
  }
} catch (e) {
  console.error('Failed to read data directory:', e.message);
}

// Helper: get dataset as array (handles both arrays and dicts)
function asArray(key) {
  const d = datasets[key];
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') return Object.values(d).filter(v => typeof v === 'object' && v !== null);
  return [];
}

// ─── Dynamic dataset registry ───
// Builds route info from whatever .json files exist — no hardcoded lists!
function buildDatasetRegistry() {
  const registry = {};
  const hiddenKeys = new Set([
    'item_images', 'armor_images', 'weapon_images', 'vendor_images',
    'map_pois', 'gzwtacmap_data', 'images',
    'apparel_items', 'loot_items',
  ]);

  for (const key of Object.keys(datasets)) {
    if (key.startsWith('_')) continue;
    const arr = asArray(key);
    if (arr.length === 0) continue;

    const sampleFields = arr.length > 0 ? Object.keys(arr[0]) : [];
    const filterFields = sampleFields.filter(f =>
      !['id', 'name', 'image', '_image', 'description'].includes(f) &&
      typeof arr[0][f] === 'string'
    );

    registry[key] = {
      visible: !hiddenKeys.has(key),
      count: arr.length,
      filters: filterFields,
      summary: `${key} (${arr.length} items)`,
    };
  }
  return registry;
}

// ─── Rate limiter (sliding window) ───
const RATE = { max: 100, ms: 60000 };
const hits = {};

function rate(ip) {
  const now = Date.now();
  const window = RATE.ms;

  let timestamps = hits[ip];
  if (!timestamps) {
    timestamps = [];
    hits[ip] = timestamps;
  }

  const cutoff = now - window;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= RATE.max) {
    const oldest = timestamps[0];
    return { rem: 0, reset: oldest + window };
  }

  timestamps.push(now);
  return { rem: RATE.max - timestamps.length, reset: now + window };
}

function json(res, data, status = 200) {
  res.status(status).json({
    data,
    count: Array.isArray(data) ? data.length : undefined,
    source: 'GZW Data API',
    timestamp: new Date().toISOString()
  });
}

function pathAndQuery(url) {
  const i = url.indexOf('?');
  const p = (i === -1 ? url : url.slice(0, i)).replace(/^\/api\/?/, '').replace(/\/$/, '') || 'root';
  return {
    path: p,
    params: new URLSearchParams(i === -1 ? '' : url.slice(i))
  };
}

function compare(v1, v2) {
  if (typeof v1 === 'string' && typeof v2 === 'string') return v1.toLowerCase() === v2.toLowerCase();
  return String(v1).toLowerCase() === String(v2).toLowerCase();
}

function filterData(arr, params) {
  let d = [...arr];
  for (const [key, val] of params.entries()) {
    if (!val) continue;
    const q = val.toLowerCase();
    if (key === 'search') {
      d = d.filter(x => JSON.stringify(Object.values(x)).toLowerCase().includes(q));
    } else if (key === 'sort') {
      const [field, dir] = val.split(':');
      if (dir === 'desc') d.sort((a, b) => (b[field] || '').toString().localeCompare((a[field] || '').toString()));
      else d.sort((a, b) => (a[field] || '').toString().localeCompare((b[field] || '').toString()));
    } else if (key === 'limit') {
      d = d.slice(0, parseInt(val) || d.length);
    } else {
      d = d.filter(x => x[key] && compare(x[key], val));
    }
  }
  return d;
}

// ─── Smart route definitions ───
// These combine multiple datasets into one endpoint.
// They're defined separately because they merge data — if a source dataset
// doesn't exist, it's silently skipped.
const SMART_ROUTES = {
  'armor': {
    sources: ['vests', 'helmets', 'glasses'],
    field_mutators: {
      'vests': x => ({ ...x, category: 'vest' }),
      'helmets': x => ({ ...x, category: 'helmet' }),
      'glasses': x => ({ ...x, category: 'glasses' }),
    },
    filters: ['type', 'material', 'nij', 'category'],
    label: 'Armor (vests + helmets + glasses)',
  },
  'weapon_parts': {
    sources: ['barrels', 'muzzle_devices', 'suppressors', 'stocks',
              'stock_adapters', 'pistol_grips', 'foregrips', 'magazines',
              'night_vision', 'helmet_mods', 'helmet_mounts'],
    field_mutators: {},
    default_mutator: (x, src) => ({ ...x, part_category: src }),
    filters: ['search', 'sort'],
    label: 'Weapon parts (combined)',
  },
  'helmet_mods': {
    sources: ['night_vision', 'helmet_mounts'],
    field_mutators: {
      'night_vision': x => ({ ...x, mod_type: 'night_vision' }),
      'helmet_mounts': x => ({ ...x, mod_type: 'mount' }),
    },
    filters: ['mod_type', 'search'],
    label: 'Helmet mods (night vision + mounts)',
  },
  'loot': {
    sources: ['loot_items'],
    filters: ['search'],
    label: 'Loot items',
  },
  'apparel': {
    sources: ['apparel_items'],
    filters: ['search', 'type'],
    label: 'Apparel items',
  },
};

function getSmartRoute(name) {
  const route = SMART_ROUTES[name];
  if (!route) return null;

  let items = [];
  for (const src of route.sources) {
    const data = asArray(src);
    const mutator = route.field_mutators?.[src] || route.default_mutator;
    if (mutator) {
      items = items.concat(data.map(x => mutator(x, src)));
    } else {
      items = items.concat(data);
    }
  }

  // Deduplicate
  const seen = new Set();
  items = items.filter(x => {
    const k = x.name?.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return items;
}

// ─── Request handler ───
module.exports = (req, res) => {
  try {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.status(204).end();

    // Rate limit
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'anon';
    const r = rate(ip);
    res.setHeader('X-RateLimit-Limit', RATE.max);
    res.setHeader('X-RateLimit-Remaining', r.rem);
    res.setHeader('X-RateLimit-Reset', Math.ceil(r.reset / 1000));
    if (r.rem === 0) return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });

    const { path: p, params } = pathAndQuery(req.url || '/');

    // Forwarded URL handling for Vercel
    const forwardedUrl = req.headers['x-vercel-forwarded-url'];
    const route = forwardedUrl ? pathAndQuery(forwardedUrl).path : p;

    const registry = buildDatasetRegistry();
    const visibleDatasets = Object.entries(registry)
      .filter(([_, info]) => info.visible)
      .map(([key, info]) => ({ key, ...info }));

    // ── API spec / OpenAPI ──
    if (route === 'spec' || route === 'openapi.json') {
      const paths = {};
      const makeParams = (filters) => filters.map(f => ({ name: f, in: 'query', schema: { type: 'string' } }));

      paths['/api'] = { get: { summary: 'API root' } };
      paths['/api/stats'] = { get: { summary: 'Stats' } };
      paths['/api/search'] = { get: { summary: 'Search', parameters: [{ name: 'q', in: 'query', required: true }] } };
      paths['/api/images'] = { get: { summary: 'All item images' } };

      for (const { key, summary, filters } of visibleDatasets) {
        paths[`/api/${key}`] = { get: { summary, parameters: makeParams(filters) } };
      }
      for (const [routeName, routeDef] of Object.entries(SMART_ROUTES)) {
        paths[`/api/${routeName}`] = { get: { summary: routeDef.label, parameters: makeParams(routeDef.filters) } };
      }

      return res.json({
        openapi: '3.0.3',
        info: {
          title: 'GZW Data API',
          version: '3.0.0',
          description: 'Comprehensive Gray Zone Warfare game data API. ' +
            'Automatically updated from the official wiki. ' +
            'New categories appear as endpoints automatically.',
        },
        servers: [{ url: 'https://gzw-data.vercel.app' }],
        paths,
      });
    }

    // ── Health ──
    if (route === 'health' || route === 'debug') {
      const loaded = {};
      for (const [key, val] of Object.entries(datasets)) {
        loaded[key] = Array.isArray(val) ? val.length : (val ? 'loaded' : 'empty');
      }
      return res.json({
        ok: true,
        version: '3.0.0',
        total_endpoints: visibleDatasets.length + Object.keys(SMART_ROUTES).length,
        dataLoaded: loaded,
        smartRoutes: Object.keys(SMART_ROUTES),
      });
    }

    // ── Root ──
    if (route === 'root') {
      const endpoints = visibleDatasets.map(d => d.key);
      endpoints.push(...Object.keys(SMART_ROUTES));
      return res.json({
        name: 'GZW Data API',
        version: '3.0.0',
        total_endpoints: endpoints.length,
        endpoints: endpoints.sort(),
        docs: 'https://gzw-data.vercel.app/api/spec',
      });
    }

    // ── Images ──
    if (route === 'images') {
      const imgSources = ['item_images', 'armor_images', 'weapon_images', 'vendor_images', 'images'];
      let merged = {};
      for (const src of imgSources) {
        const data = datasets[src];
        if (data && typeof data === 'object') {
          merged = { ...merged, ...data };
        }
      }
      return json(res, merged);
    }

    // ── Stats ──
    if (route === 'stats') {
      const stats = {};
      for (const { key, count } of visibleDatasets) {
        stats[key] = { total: count };
      }
      for (const [routeName, routeDef] of Object.entries(SMART_ROUTES)) {
        const items = getSmartRoute(routeName);
        if (items) {
          stats[routeName] = { total: items.length, combined_from: routeDef.sources };
        }
      }
      return json(res, stats);
    }

    // ── Search ──
    if (route === 'search') {
      const q = params.get('q');
      if (!q) return res.status(400).json({ error: 'Missing ?q parameter' });
      const query = q.toLowerCase();
      const results = {};
      for (const { key } of visibleDatasets) {
        const arr = asArray(key);
        const matches = arr.filter(x => x.name && x.name.toLowerCase().includes(query));
        if (matches.length > 0) results[key] = matches.slice(0, 10);
      }
      return json(res, { query: q, results });
    }

    // ── Smart routes ──
    const smartRouteDef = SMART_ROUTES[route];
    if (smartRouteDef) {
      let items = getSmartRoute(route);
      if (!items) return res.status(404).json({ error: `No data for ${route}` });

      // Apply filters
      for (const [key, val] of params.entries()) {
        if (!val || key === 'sort') continue;
        const q = val.toLowerCase();
        if (key === 'search') {
          items = items.filter(x => (x.name || '').toLowerCase().includes(q));
        } else {
          items = items.filter(x => x[key] && compare(x[key], val));
        }
      }
      return json(res, items);
    }

    // ── Generic: /api/<dataset> ──
    // Every .json file in data/ becomes /api/<filename> automatically!
    if (datasets[route]) {
      let d = filterData(asArray(route), params);
      return json(res, d);
    }

    // ── 404 ──
    const allRoutes = visibleDatasets.map(d => d.key).concat(Object.keys(SMART_ROUTES));
    res.status(404).json({
      error: `Not found: /api/${route}`,
      available: allRoutes.sort(),
      hint: 'New categories are added automatically when the scraper finds them.',
    });

  } catch (err) {
    console.error('GZW API Error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
};
