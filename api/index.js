// GZW Data API — Vercel serverless (Node.js runtime, req/res pattern)
// Dynamically loads all data files from ../data/ directory
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

// ─── Rate limiter ───
const RATE = { max: 100, ms: 60000 };
const hits = {};

function rate(ip) {
  const now = Date.now();
  const r = hits[ip];
  if (!r || now - r.t > RATE.ms) { hits[ip] = { t: now, c: 1 }; return { rem: RATE.max - 1, reset: now + RATE.ms }; }
  r.c++;
  if (r.c > RATE.max) return { rem: 0, reset: r.t + RATE.ms };
  return { rem: RATE.max - r.c, reset: r.t + RATE.ms };
}

function json(res, data, status = 200) {
  res.status(status).json({ data, count: Array.isArray(data) ? data.length : undefined, source: 'GZW Data API', timestamp: new Date().toISOString() });
}

function pathAndQuery(url) {
  const i = url.indexOf('?');
  return { path: (i === -1 ? url : url.slice(0, i)).replace(/^\/api\/?/, '').replace(/\/$/, '') || 'root', params: new URLSearchParams(i === -1 ? '' : url.slice(i)) };
}

function compare(v1, v2) {
  if (typeof v1 === 'string' && typeof v2 === 'string') return v1.toLowerCase() === v2.toLowerCase();
  return String(v1).toLowerCase() === String(v2).toLowerCase();
}

function filterData(arr, params, allowedKeys = []) {
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
    } else {
      d = d.filter(x => x[key] && compare(x[key], val));
    }
  }
  return d;
}

// ─── Route definitions ───
function buildRoutes() {
  const routes = {};
  const exclude = new Set(['item_images', 'armor_images', 'weapon_images', 'map_pois', 'gzwtacmap_data',
    'apparel_items', 'loot_items']);

  for (const key of Object.keys(datasets)) {
    if (exclude.has(key) || key.startsWith('_')) continue;
    const arr = asArray(key);
    if (arr.length === 0) continue;

    // Collect filterable params from field names
    const sampleFields = arr.length > 0 ? Object.keys(arr[0]) : [];
    const filterFields = sampleFields.filter(f => !['id', 'name', 'image', '_image', 'description'].includes(f) && typeof arr[0][f] === 'string');

    routes[key] = {
      summary: `${key} (${arr.length})`,
      filters: filterFields,
    };
  }

  // Add smart routes
  routes.armor = { summary: 'Armor (combined vests + helmets + glasses)', filters: ['type', 'material', 'nij', 'category'] };
  routes.weapon_parts = { summary: 'Weapon parts (combined)', filters: ['search'] };
  routes.helmet_mods = { summary: 'Helmet mods (night vision + mounts)', filters: ['mod_type', 'search'] };

  return routes;
}

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

    // Forwarded URL handling
    const forwardedUrl = req.headers['x-vercel-forwarded-url'];
    const actualPath = forwardedUrl ? pathAndQuery(forwardedUrl).path : p;
    const route = actualPath;

    // ── Routes ──
    if (route === 'spec' || route === 'openapi.json') {
      const routes = buildRoutes();
      const paths = {};
      for (const [key, info] of Object.entries(routes)) {
        const p = {};
        for (const f of info.filters) p[f] = { name: f, in: 'query' };
        paths[`/api/${key}`] = { get: { summary: info.summary, parameters: Object.values(p) } };
      }
      paths['/api'] = { get: { summary: 'API root' } };
      paths['/api/stats'] = { get: { summary: 'Stats' } };
      paths['/api/search'] = { get: { summary: 'Search', parameters: [{ name: 'q', in: 'query', required: true }] } };
      paths['/api/images'] = { get: { summary: 'All item images' } };
      paths['/api/armor'] = { get: { summary: 'Armor (combined vests + helmets + glasses)', parameters: [{ name: 'type', in: 'query' }, { name: 'material', in: 'query' }, { name: 'nij', in: 'query' }, { name: 'category', in: 'query' }] } };
      paths['/api/weapon_parts'] = { get: { summary: 'Weapon parts (combined)', parameters: [{ name: 'search', in: 'query' }] } };
      paths['/api/helmet_mods'] = { get: { summary: 'Helmet mods (night vision + mounts)', parameters: [{ name: 'mod_type', in: 'query' }, { name: 'search', in: 'query' }] } };

      return res.json({
        openapi: '3.0.3',
        info: { title: 'GZW Data API', version: '2.0.0', description: 'Comprehensive Gray Zone Warfare game data API. All data scraped from the official wiki.' },
        servers: [{ url: 'https://gzw-data.vercel.app' }],
        paths,
      });
    }

    if (route === 'health' || route === 'debug') {
      const loaded = {};
      const exclude = new Set(['item_images', 'armor_images', 'weapon_images', 'map_pois', 'gzwtacmap_data']);
      for (const [key, val] of Object.entries(datasets)) {
        loaded[key] = Array.isArray(val) ? val.length : (val ? 'loaded' : 'empty');
      }
      return res.json({ ok: true, version: '2.0.0', dataLoaded: loaded });
    }

    if (route === 'root') {
      return res.json({
        name: 'GZW Data API',
        version: '2.0.0',
        endpoints: Object.keys(buildRoutes()),
        docs: 'https://gzw-data.vercel.app/api/spec',
      });
    }

    // Images endpoint
    if (route === 'images') {
      return json(res, datasets.item_images || datasets.armor_images || {});
    }

    // Stats
    if (route === 'stats') {
      const stats = {};
      const exclude = new Set(['item_images', 'armor_images', 'weapon_images', 'map_pois', 'gzwtacmap_data', 'apparel', 'loot', 'provisions']);
      for (const [key, val] of Object.entries(datasets)) {
        if (Array.isArray(val) && val.length > 0 && !exclude.has(key) && !['apparel_items', 'loot_items'].includes(key)) {
          stats[key] = { total: val.length };
        }
      }
      // Smart route stats
      stats.armor = { total: (asArray('vests').length || 0) + (asArray('helmets').length || 0) + (asArray('glasses').length || 0) };
      stats.weapon_parts = { total: (asArray('barrels').length || 0) + (asArray('stocks').length || 0) + (asArray('magazines').length || 0) + (asArray('muzzle_devices').length || 0) + (asArray('suppressors').length || 0) + (asArray('stock_adapters').length || 0) + (asArray('pistol_grips').length || 0) + (asArray('foregrips').length || 0) + (asArray('night_vision').length || 0) + (asArray('helmet_mods').length || 0) + (asArray('helmet_mounts').length || 0) };
      stats.helmet_mods = { total: (asArray('night_vision').length || 0) + (asArray('helmet_mounts').length || 0) };
      stats.loot = { total: asArray('loot_items').length || 0 };
      stats.apparel = { total: asArray('apparel_items').length || 0 };
      return json(res, stats);
    }

    // Search
    if (route === 'search') {
      const q = params.get('q');
      if (!q) return res.status(400).json({ error: 'Missing ?q' });
      const query = q.toLowerCase();
      const results = {};
      for (const [key, val] of Object.entries(datasets)) {
        if (!Array.isArray(val)) continue;
        const matches = val.filter(x => x.name && x.name.toLowerCase().includes(query));
        if (matches.length > 0) results[key] = matches.slice(0, 10);
      }
      return json(res, { query: q, results });
    }

    // ── Smart routes ──
    // /api/armor → merge vests + helmets + plate carriers
    if (route === 'armor') {
      let d = [
        ...asArray('vests').map(x => ({ ...x, category: 'vest' })),
        ...asArray('helmets').map(x => ({ ...x, category: 'helmet' })),
        ...asArray('glasses').map(x => ({ ...x, category: 'glasses' })),
      ];
      // Deduplicate by name
      const seen = new Set();
      d = d.filter(x => { const k = x.name?.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
      const t = params.get('type'), m = params.get('material'), n = params.get('nij'), cat = params.get('category');
      if (t) d = d.filter(x => (x.type || '').toLowerCase() === t.toLowerCase());
      if (m) d = d.filter(x => (x.material || '').toLowerCase() === m.toLowerCase());
      if (n) d = d.filter(x => (x.nij || '').toLowerCase() === n.toLowerCase());
      if (cat) d = d.filter(x => x.category === cat.toLowerCase());
      return json(res, d);
    }

    // /api/weapon_parts → merge all weapon part datasets
    if (route === 'weapon_parts') {
      const partKeys = ['barrels', 'muzzle_devices', 'suppressors', 'stocks', 'stock_adapters', 'pistol_grips', 'foregrips', 'magazines', 'night_vision', 'helmet_mods', 'helmet_mounts'];
      let d = [];
      for (const k of partKeys) {
        const items = asArray(k);
        d = d.concat(items.map(x => ({ ...x, part_category: k })));
      }
      const search = params.get('search');
      if (search) { const q = search.toLowerCase(); d = d.filter(x => (x.name || '').toLowerCase().includes(q)); }
      const sort = params.get('sort');
      if (sort) {
        const [field, dir] = sort.split(':');
        if (dir === 'desc') d.sort((a, b) => (b[field] || '').toString().localeCompare((a[field] || '').toString()));
        else d.sort((a, b) => (a[field] || '').toString().localeCompare((b[field] || '').toString()));
      }
      return json(res, d);
    }

    // /api/loot → redirect to loot_items
    if (route === 'loot' && datasets.loot_items) {
      let d = [...asArray('loot_items')];
      const search = params.get('search');
      if (search) { const q = search.toLowerCase(); d = d.filter(x => (x.name || '').toLowerCase().includes(q)); }
      return json(res, d);
    }

    // /api/apparel → redirect to apparel_items
    if (route === 'apparel' && datasets.apparel_items) {
      let d = [...asArray('apparel_items')];
      const search = params.get('search'), t = params.get('type');
      if (t) d = d.filter(x => (x.type || '').toLowerCase() === t.toLowerCase());
      if (search) { const q = search.toLowerCase(); d = d.filter(x => (x.name || '').toLowerCase().includes(q)); }
      return json(res, d);
    }

    // /api/helmet_mods → merge night_vision + helmet_mounts
    if (route === 'helmet_mods') {
      let d = [
        ...asArray('night_vision').map(x => ({ ...x, mod_type: 'night_vision' })),
        ...asArray('helmet_mounts').map(x => ({ ...x, mod_type: 'mount' })),
      ];
      const search = params.get('search'), t = params.get('mod_type');
      if (t) d = d.filter(x => x.mod_type === t.toLowerCase());
      if (search) { const q = search.toLowerCase(); d = d.filter(x => (x.name || '').toLowerCase().includes(q)); }
      return json(res, d);
    }

    // Generic: /api/<dataset>
    if (datasets[route]) {
      const arr = asArray(route);
      let d = [...arr];
      // Apply filters from query params
      for (const [key, val] of params.entries()) {
        if (key === 'search' || key === 'sort' || key === 'limit') continue;
        if (val) d = d.filter(x => x[key] && compare(x[key], val));
      }
      // Search within dataset
      const search = params.get('search');
      if (search) {
        const q = search.toLowerCase();
        d = d.filter(x => (x.name || '').toLowerCase().includes(q) || JSON.stringify(Object.values(x)).toLowerCase().includes(q));
      }
      // Limit
      const limit = params.get('limit');
      if (limit) d = d.slice(0, parseInt(limit));
      // Sort
      const sort = params.get('sort');
      if (sort) {
        const [field, dir] = sort.split(':');
        if (dir === 'desc') d.sort((a, b) => (b[field] || '').toString().localeCompare((a[field] || '').toString()));
        else d.sort((a, b) => (a[field] || '').toString().localeCompare((b[field] || '').toString()));
      }
      return json(res, d);
    }

    res.status(404).json({ error: `Not found: /api/${route}`, available: Object.keys(buildRoutes()) });

  } catch (err) {
    console.error('GZW API Error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
};
