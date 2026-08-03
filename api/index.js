// GZW Data API v4 — Fully Dynamic, Auto-Discovering, Cached & Paginated
// Every .json file in /data becomes an API endpoint automatically.
const fs = require('fs');
const path = require('path');

// ─── Config ───
const DATA_DIR = path.join(__dirname, '..', 'data');
const RATE_LIMIT = { max: 100, ms: 60000 };
const CACHE_TTL_SEC = 300; // 5 minutes
const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 500;

// ─── Load all data files ───
const datasets = {};
let dataFiles = [];
try {
  dataFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  for (const f of dataFiles) {
    const key = f.replace('.json', '');
    try {
      datasets[key] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'));
    } catch (e) {
      console.error(`Failed to load ${f}:`, e.message);
      datasets[key] = null;
    }
  }
} catch (e) {
  console.error('Failed to read data directory:', e.message);
}

// ─── Helpers ───

/** Convert a dataset to an array, handling both arrays and dicts. */
function asArray(key) {
  const d = datasets[key];
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') return Object.values(d).filter(v => v && typeof v === 'object');
  return [];
}

/** Build a registry of all available datasets with metadata. */
function buildDatasetRegistry() {
  const registry = {};
  for (const key of Object.keys(datasets)) {
    if (key.startsWith('_')) continue;
    const arr = asArray(key);
    if (arr.length === 0) continue;

    const sample = arr[0] || {};
    const filterFields = Object.keys(sample).filter(f =>
      !['id', 'name', 'image', '_image', 'description'].includes(f) &&
      typeof sample[f] === 'string'
    );

    registry[key] = {
      count: arr.length,
      filters: filterFields,
      isObject: !Array.isArray(datasets[key]),
    };
  }
  return registry;
}

// ─── Rate limiter (sliding window) ───
const hits = {};

function checkRate(ip) {
  const now = Date.now();
  const window = RATE_LIMIT.ms;
  let timestamps = hits[ip];
  if (!timestamps) {
    timestamps = [];
    hits[ip] = timestamps;
  }

  const cutoff = now - window;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= RATE_LIMIT.max) {
    const oldest = timestamps[0];
    return { allowed: false, reset: oldest + window, remaining: 0 };
  }

  timestamps.push(now);
  return { allowed: true, reset: now + window, remaining: RATE_LIMIT.max - timestamps.length };
}

/** Set standard response headers. */
function setHeaders(res, rateInfo, cacheTTL) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT.max);
  res.setHeader('X-RateLimit-Remaining', rateInfo.remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateInfo.reset / 1000));
  if (cacheTTL > 0) {
    res.setHeader('Cache-Control', `public, max-age=${cacheTTL}, stale-while-revalidate=${cacheTTL * 2}`);
  }
}

/** Send a JSON response. */
function json(res, data, status = 200, extra = {}) {
  const body = { data, ...extra };
  if (Array.isArray(data)) {
    body.count = data.length;
  }
  body.source = 'GZW Data API';
  body.timestamp = new Date().toISOString();
  res.status(status).json(body);
}

/** Paginate an array. */
function paginate(arr, page, perPage) {
  const total = arr.length;
  const totalPages = Math.ceil(total / perPage) || 1;
  const start = (page - 1) * perPage;
  const items = arr.slice(start, start + perPage);
  return { items, page, perPage, total, totalPages };
}

/** Apply filters to an array of items. */
function applyFilters(arr, params) {
  let d = [...arr];

  for (const [key, val] of params.entries()) {
    if (!val) continue;
    const q = val.toLowerCase();

    if (key === 'search') {
      d = d.filter(x =>
        JSON.stringify(Object.values(x)).toLowerCase().includes(q) ||
        (x.name && x.name.toLowerCase().includes(q))
      );
    } else if (key === 'sort') {
      const [field, dir] = val.split(':');
      if (dir === 'desc') {
        d.sort((a, b) => String(b[field] || '').localeCompare(String(a[field] || '')));
      } else {
        d.sort((a, b) => String(a[field] || '').localeCompare(String(b[field] || '')));
      }
    } else if (key === 'limit') {
      const limit = Math.min(parseInt(val) || 50, MAX_PER_PAGE);
      d = d.slice(0, limit);
    } else {
      d = d.filter(x => x[key] && String(x[key]).toLowerCase() === q);
    }
  }

  return d;
}

/** Parse pagination params from URLSearchParams. */
function parsePagination(params) {
  const page = Math.max(1, parseInt(params.get('page')) || 1);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(params.get('per_page')) || DEFAULT_PER_PAGE));
  return { page, perPage };
}

/** Parse the path and query params from a URL. */
function parseRoute(url) {
  const i = url.indexOf('?');
  const pathPart = (i === -1 ? url : url.slice(0, i)).replace(/^\/api\/?/, '').replace(/\/$/, '') || 'root';
  const params = new URLSearchParams(i === -1 ? '' : url.slice(i));
  return { path: pathPart, params };
}

// ─── Smart route definitions ───
const SMART_ROUTES = {
  armor: {
    sources: ['vests', 'helmets', 'glasses'],
    label: 'Armor (vests + helmets + glasses)',
    mutators: {
      vests: x => ({ ...x, category: 'vest' }),
      helmets: x => ({ ...x, category: 'helmet' }),
      glasses: x => ({ ...x, category: 'glasses' }),
    },
  },
  weapon_parts: {
    sources: [
      'barrels', 'muzzle_devices', 'suppressors', 'stocks',
      'stock_adapters', 'pistol_grips', 'foregrips', 'magazines',
      'night_vision', 'helmet_mods', 'helmet_mounts',
    ],
    label: 'Weapon parts (combined)',
    mutators: {},
    defaultMutator: (x, src) => ({ ...x, part_category: src }),
  },
  helmet_mods: {
    sources: ['night_vision', 'helmet_mounts'],
    label: 'Helmet mods (night vision + mounts)',
    mutators: {
      night_vision: x => ({ ...x, mod_type: 'night_vision' }),
      helmet_mounts: x => ({ ...x, mod_type: 'mount' }),
    },
  },
};

function getSmartData(name) {
  const route = SMART_ROUTES[name];
  if (!route) return null;

  let items = [];
  for (const src of route.sources) {
    const data = asArray(src);
    const mutator = route.mutators?.[src] || route.defaultMutator;
    items = items.concat(data.map(x => mutator ? mutator(x, src) : x));
  }

  // Deduplicate by name
  const seen = new Set();
  return items.filter(x => {
    const k = x.name?.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ─── Routes ───

function handleRoute(route, params, res, rateInfo) {
  const registry = buildDatasetRegistry();
  const { page, perPage } = parsePagination(params);
  const wantAll = params.get('all') === 'true';

  // ── API root (deduplicated) ──
  if (route === 'root') {
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    const allKeys = new Set(Object.keys(registry).concat(Object.keys(SMART_ROUTES)));
    const endpoints = [...allKeys].sort();
    return json(res, {
      name: 'GZW Data API',
      version: '4.0.0',
      endpoints,
      docs: '/api/spec',
    });
  }

  // ── OpenAPI spec (deduplicated) ──
  if (route === 'spec' || route === 'openapi.json') {
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    const allKeys = new Set(Object.keys(registry).concat(Object.keys(SMART_ROUTES)));
    const paths = { '/api': { get: { summary: 'API root' } } };
    for (const key of allKeys) {
      const isSmart = SMART_ROUTES[key];
      paths[`/api/${key}`] = {
        get: { summary: isSmart ? isSmart.label : `${key} (${registry[key]?.count || 0} items)` }
      };
    }
    return res.json({
      openapi: '3.0.3',
      info: {
        title: 'GZW Data API',
        version: '4.0.0',
        description: 'Comprehensive Gray Zone Warfare game data API.',
      },
      servers: [{ url: 'https://gzw-data.vercel.app' }],
      paths,
    });
  }

  // ── Health / Debug ──
  if (route === 'health' || route === 'debug') {
    setHeaders(res, rateInfo, 0);
    const loaded = {};
    for (const [key, val] of Object.entries(datasets)) {
      loaded[key] = Array.isArray(val) ? val.length : (val ? 'object' : 'empty');
    }
    return json(res, {
      ok: true,
      version: '4.0.0',
      datasets: loaded,
      smartRoutes: Object.keys(SMART_ROUTES),
    });
  }

  // ── Stats ──
  if (route === 'stats') {
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    const stats = {};
    for (const [key, info] of Object.entries(registry)) {
      stats[key] = { total: info.count };
    }
    for (const [name, def] of Object.entries(SMART_ROUTES)) {
      const items = getSmartData(name);
      if (items) stats[name] = { total: items.length, sources: def.sources };
    }
    return json(res, stats);
  }

  // ── Search ──
  if (route === 'search') {
    const q = params.get('q');
    if (!q) return res.status(400).json({ error: 'Missing ?q parameter' });
    setHeaders(res, rateInfo, 0);
    const query = q.toLowerCase();
    const results = {};
    for (const key of Object.keys(registry)) {
      const arr = asArray(key);
      const matches = arr.filter(x => x.name && x.name.toLowerCase().includes(query));
      if (matches.length > 0) results[key] = matches.slice(0, 10);
    }
    return json(res, { query: q, results });
  }

  // ── Images ──
  // Build a name → image URL map. First merge any legacy image-map datasets
  // (item_images, weapon_images, armor_images), then collect every inline
  // `image` field from all item datasets so the map stays fresh without
  // dedicated image files.
  if (route === 'images') {
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    let merged = {};
    for (const src of ['item_images', 'armor_images', 'weapon_images', 'images']) {
      const data = datasets[src];
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        merged = { ...merged, ...data };
      }
    }
    for (const key of Object.keys(datasets)) {
      if (['item_images', 'armor_images', 'weapon_images', 'images'].includes(key)) continue;
      const d = datasets[key];
      if (!d) continue;
      const arr = Array.isArray(d) ? d : Object.values(d).filter(v => v && typeof v === 'object');
      for (const item of arr) {
        if (item && typeof item === 'object' && item.name && item.image && !merged[item.name]) {
          merged[item.name] = item.image;
        }
      }
    }
    return json(res, merged);
  }

  // ── Smart routes ──
  if (SMART_ROUTES[route]) {
    let items = getSmartData(route);
    if (!items) return res.status(404).json({ error: `No data for ${route}` });

    // Apply filters (exclude pagination meta-params)
    const filterParams = new URLSearchParams();
    for (const [k, v] of params.entries()) {
      if (!['page', 'per_page', 'all', 'limit'].includes(k)) filterParams.set(k, v);
    }
    items = applyFilters(items, filterParams);

    if (wantAll) {
      setHeaders(res, rateInfo, CACHE_TTL_SEC);
      return json(res, items);
    }

    const p = paginate(items, page, perPage);
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    return json(res, p.items, 200, {
      page: p.page,
      perPage: p.perPage,
      total: p.total,
      totalPages: p.totalPages,
    });
  }

  // ── Generic dataset route ──
  if (datasets[route]) {
    const raw = datasets[route];

    // If it's an object (not array), return as-is
    if (!Array.isArray(raw)) {
      setHeaders(res, rateInfo, CACHE_TTL_SEC);
      return json(res, raw);
    }

    // Strip pagination meta-params before filtering
    const filterParams = new URLSearchParams();
    for (const [k, v] of params.entries()) {
      if (!['page', 'per_page', 'all', 'limit'].includes(k)) filterParams.set(k, v);
    }
    let items = applyFilters(asArray(route), filterParams);

    if (wantAll) {
      setHeaders(res, rateInfo, CACHE_TTL_SEC);
      return json(res, items);
    }

    const p = paginate(items, page, perPage);
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    return json(res, p.items, 200, {
      page: p.page,
      perPage: p.perPage,
      total: p.total,
      totalPages: p.totalPages,
    });
  }

  // ── 404 ──
  const allRoutes = Object.keys(registry).concat(Object.keys(SMART_ROUTES));
  setHeaders(res, rateInfo, 0);
  res.status(404).json({
    error: `Not found: /api/${route}`,
    available: allRoutes.sort(),
    hint: 'All .json files in /data are automatically exposed as endpoints.',
    docs: '/api/spec',
    playground: '/',
  });
}

// ─── Request handler ───
module.exports = (req, res) => {
  try {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      return res.status(204).end();
    }

    // GET only
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limit
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'anon';
    const rateInfo = checkRate(ip);
    if (!rateInfo.allowed) {
      const retryAfter = Math.ceil((rateInfo.reset - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: 'Rate limit exceeded. Try again later.',
        retryAfter,
        limit: 100,
        window: '60 seconds',
        docs: '/docs',
      });
    }

    // Parse route
    const forwardedUrl = req.headers['x-vercel-forwarded-url'];
    const url = forwardedUrl || req.url;
    const { path: route, params } = parseRoute(url);

    handleRoute(route, params, res, rateInfo);
  } catch (err) {
    console.error('GZW API Error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
};
