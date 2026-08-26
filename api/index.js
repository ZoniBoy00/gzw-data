const { CACHE_TTL_SEC } = require("./config");
const { datasets, loadDatasets, asArray, getLastScrapedAt, buildDatasetRegistry } = require("./datasets");
const { checkRate } = require("./rate-limit");
const { setHeaders, json } = require("./response");
const { paginate, applyFilters, parsePagination } = require("./query");
const { parseRoute, decodeRoutePart } = require("./routing");
const { SMART_ROUTES, getSmartData } = require("./smart-routes");
const { buildMetadata, getMetadata, getSummaryMetadata, getSingleDatasetMetadata } = require("./metadata");

loadDatasets();

// ─── Routes ───

function handleRoute(route, params, res, rateInfo) {
  const registry = buildDatasetRegistry();
  const { page, perPage } = parsePagination(params);
  const wantAll = params.get('all') === 'true';

  // ── Generated dataset metadata ──
  if (route === 'metadata' || route.startsWith('metadata/')) {
    const metadataName = route.slice('metadata/'.length);
    if (route.startsWith('metadata/') && metadataName) {
      const dataset = getSingleDatasetMetadata(datasets, asArray, getLastScrapedAt(), decodeRoutePart(metadataName));
      if (!dataset) {
        return res.status(404).json({
          error: `Metadata not found: /api/metadata/${metadataName}`,
          dataset: metadataName,
          docs: '/api/spec',
        });
      }
      setHeaders(res, rateInfo, CACHE_TTL_SEC);
      return json(res, dataset);
    }
    const metadata = params.get('full') === 'true'
      ? getMetadata(datasets, asArray, getLastScrapedAt())
      : getSummaryMetadata(datasets, asArray, getLastScrapedAt());
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    return json(res, metadata);
  }

  // ── Single-record dataset route ──
  // Dataset records are addressed as /api/{dataset}/{id}. Keep the existing
  // collection routes unchanged and match IDs exactly.
  const routeParts = route.split('/').filter(Boolean);
  if (routeParts.length > 1) {
    const datasetName = decodeRoutePart(routeParts.shift());
    const recordId = routeParts.map(decodeRoutePart).join('/');
    if (datasets[datasetName] && !SMART_ROUTES[datasetName]) {
      const record = asArray(datasetName).find(item => String(item.id) === recordId);
      setHeaders(res, rateInfo, CACHE_TTL_SEC);
      if (!record) {
        return res.status(404).json({
          error: `Record not found: /api/${datasetName}/${recordId}`,
          dataset: datasetName,
          id: recordId,
          docs: '/api/spec',
        });
      }
      return json(res, record);
    }
  }

  // ── API root (deduplicated) ──
  if (route === 'root') {
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    const allKeys = new Set(Object.keys(registry).concat(Object.keys(SMART_ROUTES)));
    const endpoints = [...allKeys, 'metadata'].sort();
    return json(res, {
      name: 'GZW Data API',
      version: '4.0.0',
      endpoints,
      docs: '/api/spec',
      lastScrapedAt: getLastScrapedAt(),
    });
  }

  // ── OpenAPI spec (deduplicated) ──
  if (route === 'spec' || route === 'openapi.json') {
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    const allKeys = new Set(Object.keys(registry).concat(Object.keys(SMART_ROUTES)));
    const paths = {
      '/api': { get: { summary: 'API root' } },
      '/api/metadata': { get: { summary: 'Dataset schema metadata' } },
      '/api/metadata/{dataset}': {
        get: {
          summary: 'Get schema metadata for one dataset',
          parameters: [{ name: 'dataset', in: 'path', required: true, schema: { type: 'string' } }],
        },
      },
    };
    for (const key of allKeys) {
      const isSmart = SMART_ROUTES[key];
      paths[`/api/${key}`] = {
        get: { summary: isSmart ? isSmart.label : `${key} (${registry[key]?.count || 0} items)` }
      };
      if (!isSmart) {
        paths[`/api/${key}/{id}`] = {
          get: {
            summary: `Get one ${key} record by id`,
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          },
        };
      }
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
      lastScrapedAt: getLastScrapedAt(),
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
      const items = getSmartData(name, asArray);
      if (items) stats[name] = { total: items.length, sources: def.sources };
    }
    return json(res, stats, 200, { lastScrapedAt: getLastScrapedAt() });
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
    let items = getSmartData(route, asArray);
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
