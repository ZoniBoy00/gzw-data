const { CACHE_TTL_SEC } = require("../lib/config");
const { datasets, loadDatasets, asArray, getLastScrapedAt, buildDatasetRegistry } = require("../lib/datasets");
const { checkRate } = require("../lib/rate-limit");
const { setHeaders, json, errorResponse, setDataVersion } = require("../lib/response");
const { paginate, applyFilters, parsePagination, matchesSearch } = require("../lib/query");
const { parseRoute, decodeRoutePart } = require("../lib/routing");
const { SMART_ROUTES, getSmartData } = require("../lib/smart-routes");
const { buildBasicMetadata, buildRegistryMetadata, getMetadata, getSingleDatasetMetadata, buildOpenApiSchemas } = require("../lib/metadata");
const { buildSnapshot, getSnapshotHistory, buildChanges } = require("../lib/snapshots");
const { API_VERSION, IMPLEMENTATION_VERSION } = require("../lib/version");

loadDatasets();
setDataVersion(getLastScrapedAt());

// ─── Related data helpers ───

function findRecord(datasetName, recordId) {
  return asArray(datasetName).find(item => String(item.id) === recordId) || null;
}

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function recordReferences(record, targetValues) {
  return Object.values(record).some(value => {
    if (typeof value !== 'string') return false;
    const candidate = normalized(value);
    return targetValues.some(target => candidate === target || candidate.includes(target));
  });
}

function buildItemContext(recordId) {
  const item = findRecord('items', recordId);
  if (!item) return null;

  const targetValues = [normalized(item.id), normalized(item.name)].filter(Boolean);
  const references = [];
  for (const [datasetName, raw] of Object.entries(datasets)) {
    if (datasetName.startsWith('_') || datasetName === 'items' || !Array.isArray(raw)) continue;
    for (const record of asArray(datasetName)) {
      if (recordReferences(record, targetValues)) {
        references.push({ dataset: datasetName, record });
      }
    }
  }

  const vendorNames = new Set();
  if (typeof item.sold_by === 'string') {
    for (const part of item.sold_by.split(/[,/]/)) {
      const vendorName = part.trim().replace(/\s+R\.\d+$/i, '');
      if (vendorName && vendorName !== '???') vendorNames.add(normalized(vendorName));
    }
  }
  const vendors = asArray('vendors').filter(vendor => vendorNames.has(normalized(vendor.name)));

  return {
    item,
    vendors,
    references,
    referenceCount: references.length,
    note: 'References are exact or textual matches found in the current datasets; they are not guaranteed gameplay relationships.',
  };
}

// ─── Routes ───

function handleRoute(route, params, res, rateInfo) {
  if (route === 'metadata' && params.get('full') !== 'true') {
    const metadata = buildBasicMetadata(datasets, getLastScrapedAt());
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    return json(res, metadata);
  }

  const registry = buildDatasetRegistry();
  const { page, perPage } = parsePagination(params);
  const wantAll = params.get('all') === 'true';

  // ── Generated dataset metadata ──
  if (route === 'metadata' || route.startsWith('metadata/')) {
    const metadataName = route.slice('metadata/'.length);
    if (route.startsWith('metadata/') && metadataName) {
      const dataset = getSingleDatasetMetadata(datasets, asArray, getLastScrapedAt(), decodeRoutePart(metadataName));
      if (!dataset) {
        return errorResponse(res, 404, 'DATASET_NOT_FOUND', 'Dataset metadata not found', {
          dataset: metadataName,
          docs: '/api/v1/spec',
        });
      }
      setHeaders(res, rateInfo, CACHE_TTL_SEC);
      return json(res, dataset);
    }
    const metadata = params.get('full') === 'true'
      ? getMetadata(datasets, asArray, getLastScrapedAt())
      : buildRegistryMetadata(registry, getLastScrapedAt());
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    return json(res, metadata);
  }

  // ── Dataset schema route ──
  if (route.startsWith('schema/')) {
    const schemaName = decodeRoutePart(route.slice('schema/'.length));
    const schema = getSingleDatasetMetadata(datasets, asArray, getLastScrapedAt(), schemaName);
    if (!schema) {
      return errorResponse(res, 404, 'DATASET_NOT_FOUND', 'Dataset schema not found', {
        dataset: schemaName,
        docs: '/api/v1/spec',
      });
    }
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    return json(res, schema);
  }

  // ── Related data routes ──
  const relatedParts = route.split('/').filter(Boolean);
  if (relatedParts.length === 3 && relatedParts[1] && relatedParts[2]) {
    const datasetName = decodeRoutePart(relatedParts[0]);
    const recordId = decodeRoutePart(relatedParts[1]);
    const relation = relatedParts[2];

    if (datasetName === 'items' && relation === 'context') {
      const context = buildItemContext(recordId);
      setHeaders(res, rateInfo, CACHE_TTL_SEC);
      if (!context) {
        return errorResponse(res, 404, 'RECORD_NOT_FOUND', 'Item not found', {
          dataset: 'items', id: recordId, docs: '/api/v1/spec',
        });
      }
      return json(res, context);
    }
  }

  // ── Single-record dataset route ──
  // Dataset records are addressed as /api/{dataset}/{id}. Keep the existing
  // collection routes unchanged and match IDs exactly.
  const routeParts = route.split('/').filter(Boolean);
  if (routeParts.length === 2) {
    const datasetName = decodeRoutePart(routeParts.shift());
    const recordId = routeParts.map(decodeRoutePart).join('/');
    if (datasets[datasetName] && !SMART_ROUTES[datasetName]) {
      const record = asArray(datasetName).find(item => String(item.id) === recordId);
      setHeaders(res, rateInfo, CACHE_TTL_SEC);
      if (!record) {
        return errorResponse(res, 404, 'RECORD_NOT_FOUND', 'Record not found', {
          dataset: datasetName,
          id: recordId,
          docs: '/api/v1/spec',
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
      implementationVersion: IMPLEMENTATION_VERSION,
      endpoints,
      docs: '/api/spec',
      lastScrapedAt: getLastScrapedAt(),
    });
  }

  // ── OpenAPI spec (deduplicated) ──
  if (route === 'spec' || route === 'openapi.json') {
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    const allKeys = new Set(Object.keys(registry).concat(Object.keys(SMART_ROUTES)));
    const metadata = getMetadata(datasets, asArray, getLastScrapedAt());
    const schemas = buildOpenApiSchemas(metadata);
    const paths = {
      '/api': { get: { summary: 'API root' } },
      '/api/health': { get: { summary: 'Lightweight API liveness check' } },
      '/api/ready': { get: { summary: 'Lightweight readiness probe for loaded datasets' } },
      '/api/version': { get: { summary: 'API and dataset version information' } },
      '/api/changes': { get: { summary: 'Changes since the latest stored dataset snapshot' } },
      '/api/metadata': { get: { summary: 'Dataset schema metadata' } },
      '/api/metadata/{dataset}': {
        get: {
          summary: 'Get schema metadata for one dataset',
          parameters: [{ name: 'dataset', in: 'path', required: true, schema: { type: 'string' } }],
        },
      },
      '/api/schema/{dataset}': {
        get: {
          summary: 'Get a machine-readable schema for one dataset',
          parameters: [{ name: 'dataset', in: 'path', required: true, schema: { type: 'string' } }],
        },
      },
      '/api/search': {
        get: {
          summary: 'Search records across datasets',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'dataset', in: 'query', schema: { type: 'string' }, description: 'Comma-separated dataset names' },
            { name: 'fields', in: 'query', schema: { type: 'string' }, description: 'Comma-separated fields to search' },
            { name: 'fuzzy', in: 'query', schema: { type: 'boolean', default: false } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
          ],
        },
      },
      '/api/items/{id}/context': {
        get: {
          summary: 'Get an item with related vendor and dataset references',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
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
    for (const [apiPath, operation] of Object.entries(paths)) {
      if (apiPath.startsWith('/api')) {
        paths[`/api/v1${apiPath.slice('/api'.length)}`] = operation;
      }
    }
    const responseForPath = apiPath => {
      if (apiPath.includes('/{id}') && !apiPath.endsWith('/context')) return '#/components/schemas/RecordResponse';
      if (apiPath.endsWith('/health') || apiPath.endsWith('/ready') || apiPath.endsWith('/version')) return '#/components/schemas/ObjectResponse';
      if (apiPath.endsWith('/metadata') || apiPath.includes('/metadata/') || apiPath.includes('/schema/')) return '#/components/schemas/ObjectResponse';
      if (apiPath.endsWith('/search') || apiPath.endsWith('/changes') || apiPath.endsWith('/stats') || apiPath.endsWith('/images') || apiPath.endsWith('/context')) return '#/components/schemas/ObjectResponse';
      if (apiPath === '/api' || apiPath === '/api/v1') return '#/components/schemas/ObjectResponse';
      return '#/components/schemas/PaginatedResponse';
    };
    for (const [apiPath, operation] of Object.entries(paths)) {
      operation.get.responses = {
        200: { description: 'Successful response', content: { 'application/json': { schema: { $ref: responseForPath(apiPath) } } } },
        400: { description: 'Invalid request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } },
        404: { description: 'Resource not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } },
        429: { description: 'Rate limit exceeded', headers: { 'Retry-After': { schema: { type: 'integer' } } }, content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiErrorResponse' } } } },
      };
    }
    return res.json({
      openapi: '3.0.3',
      info: {
        title: 'GZW Data API',
        version: IMPLEMENTATION_VERSION,
        description: 'Comprehensive Gray Zone Warfare game data API.',
      },
      servers: [{ url: 'https://gzw-data.dev' }],
      components: {
        schemas: {
          ...schemas,
          ObjectResponse: {
            type: 'object',
            required: ['data', 'source', 'timestamp'],
            properties: {
              data: {},
              source: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              dataVersion: { type: 'string' },
              apiVersion: { type: 'string', example: 'v1' },
              implementationVersion: { type: 'string', example: '4.1.0' },
            },
            additionalProperties: true,
          },
          RecordResponse: {
            allOf: [
              { $ref: '#/components/schemas/ObjectResponse' },
              { type: 'object', properties: { data: { type: 'object' } } },
            ],
          },
          PaginatedResponse: {
            allOf: [
              { $ref: '#/components/schemas/ObjectResponse' },
              { type: 'object', properties: { data: { type: 'array', items: { type: 'object' } }, count: { type: 'integer' }, page: { type: 'integer' }, perPage: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } } },
            ],
          },
          ApiError: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'DATASET_NOT_FOUND' },
              message: { type: 'string', example: 'Dataset not found' },
              dataset: { type: 'string' },
              id: { type: 'string' },
            },
            additionalProperties: true,
          },
          ApiErrorResponse: {
            type: 'object',
            required: ['error', 'source', 'timestamp'],
            properties: {
              error: { $ref: '#/components/schemas/ApiError' },
              source: { type: 'string', example: 'GZW Data API' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      paths,
    });
  }

  // ── Version ──
  if (route === 'version') {
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    return json(res, {
      api: 'GZW Data API',
      apiVersion: API_VERSION,
      implementationVersion: IMPLEMENTATION_VERSION,
      baseUrl: 'https://gzw-data.dev/api/v1',
      openapi: 'https://gzw-data.dev/api/v1/spec',
      dataVersion: getLastScrapedAt(),
      snapshot: buildSnapshot(datasets, asArray, getLastScrapedAt()),
      historyCount: getSnapshotHistory(datasets, asArray, getLastScrapedAt()).length,
      datasetCount: Object.keys(registry).length,
      datasets: Object.keys(registry).sort(),
      source: 'https://github.com/ZoniBoy00/gzw-data',
    });
  }

  // ── Changes ──
  if (route === 'changes') {
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    return json(res, buildChanges(datasets, asArray, getLastScrapedAt()));
  }

  // ── Health / readiness / debug ──
  if (route === 'health' || route === 'ready' || route === 'debug') {
    let datasetCount = 0;
    for (const [key, val] of Object.entries(datasets)) {
      if (key.startsWith('_')) continue;
      if (val) datasetCount += 1;
    }
    const ready = datasetCount > 0;
    setHeaders(res, rateInfo, 0);
    if (route === 'ready' && !ready) {
      return errorResponse(res, 503, 'NOT_READY', 'API datasets are not ready', { datasetCount });
    }
    if (route === 'health') {
      return json(res, {
        ok: ready,
        status: ready ? 'ok' : 'degraded',
        apiVersion: API_VERSION,
        implementationVersion: IMPLEMENTATION_VERSION,
      });
    }
    if (route === 'ready') {
      return json(res, {
        ok: true,
        ready: true,
        status: 'ok',
        datasetCount,
      });
    }
    const loaded = {};
    for (const [key, val] of Object.entries(datasets)) {
      if (key.startsWith('_')) continue;
      loaded[key] = Array.isArray(val) ? val.length : (val ? 'object' : 'empty');
    }
    return json(res, {
      ok: ready,
      status: ready ? 'ok' : 'degraded',
      ready,
      apiVersion: API_VERSION,
      implementationVersion: IMPLEMENTATION_VERSION,
      datasetCount,
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
    if (!q) return errorResponse(res, 400, 'INVALID_REQUEST', 'Missing ?q parameter', { parameter: 'q' });

    const requestedDatasets = (params.get('dataset') || '').split(',').map(value => value.trim()).filter(Boolean);
    const searchDatasets = requestedDatasets.length > 0 ? requestedDatasets : Object.keys(registry);
    const unknownDataset = searchDatasets.find(name => !registry[name]);
    if (unknownDataset) {
      return errorResponse(res, 400, 'INVALID_REQUEST', 'Unknown search dataset', {
        parameter: 'dataset', dataset: unknownDataset,
      });
    }

    const fields = (params.get('fields') || '').split(',').map(value => value.trim()).filter(Boolean);
    const fuzzy = params.get('fuzzy') === 'true';
    const limit = Math.min(50, Math.max(1, parseInt(params.get('limit')) || 10));
    const results = {};
    for (const key of searchDatasets) {
      const matches = asArray(key).filter(item => matchesSearch(item, q, fields, fuzzy));
      if (matches.length > 0) results[key] = matches.slice(0, limit);
    }
    setHeaders(res, rateInfo, CACHE_TTL_SEC);
    return json(res, {
      query: q,
      results,
      datasets: searchDatasets,
      fields,
      fuzzy,
      limit,
    });
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
    if (!items) return errorResponse(res, 404, 'DATASET_NOT_FOUND', 'Dataset data not found', { dataset: route });

    // Apply filters (exclude pagination meta-params)
    const filterParams = new URLSearchParams();
    for (const [k, v] of params.entries()) {
      if (!['page', 'per_page', 'all'].includes(k)) filterParams.set(k, v);
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
      if (!['page', 'per_page', 'all'].includes(k)) filterParams.set(k, v);
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
  errorResponse(res, 404, 'ENDPOINT_NOT_FOUND', 'Endpoint not found', {
    endpoint: route,
    available: allRoutes.sort(),
    hint: 'All .json files in /data are automatically exposed as endpoints.',
    docs: '/api/v1/spec',
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

    // Request metadata and rate limit
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'anon';
    const rateInfo = checkRate(ip);
    setHeaders(res, rateInfo, 0);

    // GET only
    if (req.method !== 'GET') {
      return errorResponse(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed', { method: req.method });
    }

    if (!rateInfo.allowed) {
      const retryAfter = Math.ceil((rateInfo.reset - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return errorResponse(res, 429, 'RATE_LIMITED', 'Rate limit exceeded. Try again later.', {
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
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Internal error');
  }
};
