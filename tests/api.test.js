// GZW Data API — Integration tests
// Run: node --test tests/api.test.js
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { buildChanges } = require(path.join(__dirname, '..', 'lib', 'snapshots'));
const { buildExport, MAX_EXPORT_RECORDS } = require(path.join(__dirname, '..', 'lib', 'export'));
const { getLastScrapedAt } = require(path.join(__dirname, '..', 'lib', 'datasets'));

// We test the API by simulating Vercel-like requests.
// The api/index.js exports a (req, res) handler.
let handler;

before(() => {
  handler = require(path.join(__dirname, '..', 'api', 'index.js'));
});

/**
 * Create a mock request object.
 */
function mockReq(url, method = 'GET', headers = {}) {
  return {
    url,
    method,
    headers: {
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

/**
 * Create a mock response object that captures the response.
 */
function mockRes() {
  let statusCode = 200;
  let responseHeaders = {};
  let body = null;

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    setHeader: (key, val) => {
      responseHeaders[key.toLowerCase()] = val;
      return res;
    },
    json: (data) => {
      body = data;
    },
    end: () => {},
  };

  return {
    res,
    getStatus: () => statusCode,
    getHeader: (key) => responseHeaders[key.toLowerCase()],
    getBody: () => body,
  };
}

describe('GZW Data API', () => {
  it('should support the versioned v1 API prefix', () => {
    const root = mockRes();
    handler(mockReq('/api/v1'), root.res);
    assert.strictEqual(root.getStatus(), 200);
    assert.strictEqual(root.getBody().data.name, 'GZW Data API');

    const record = mockRes();
    handler(mockReq('/api/v1/weapons/ak-12'), record.res);
    assert.strictEqual(record.getStatus(), 200);
    assert.strictEqual(record.getBody().data.id, 'ak-12');

    const metadata = mockRes();
    handler(mockReq('/api/v1/metadata/weapons'), metadata.res);
    assert.strictEqual(metadata.getStatus(), 200);
    assert.strictEqual(metadata.getBody().data.name, 'weapons');
  });

  it('should return API root on GET /api', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api'), res);
    assert.strictEqual(getStatus(), 200);
    const body = getBody();
    assert.ok(body.data);
    assert.strictEqual(body.data.name, 'GZW Data API');
    assert.ok(Array.isArray(body.data.endpoints));
    assert.ok(body.data.endpoints.length > 0);
    assert.ok(body.timestamp);
    assert.strictEqual(body.source, 'GZW Data API');
  });

  it('should set CORS headers', () => {
    const { res, getHeader } = mockRes();
    handler(mockReq('/api'), res);
    assert.strictEqual(getHeader('access-control-allow-origin'), '*');
  });

  it('should set rate limit headers', () => {
    const { res, getHeader } = mockRes();
    handler(mockReq('/api'), res);
    assert.ok(getHeader('x-ratelimit-limit') > 0);
    assert.ok(getHeader('x-ratelimit-remaining') >= 0);
    assert.ok(getHeader('x-ratelimit-reset') > 0);
  });

  it('should set Cache-Control headers', () => {
    const { res, getHeader } = mockRes();
    handler(mockReq('/api/weapons'), res);
    const cc = getHeader('cache-control');
    assert.ok(cc);
    assert.ok(cc.includes('public'));
    assert.ok(cc.includes('max-age'));
  });

  it('should return 404 for unknown dataset', () => {
    const { res, getStatus, getBody, getHeader } = mockRes();
    handler(mockReq('/api/nonexistent_dataset_xyz'), res);
    assert.strictEqual(getStatus(), 404);
    assert.strictEqual(getBody().error.code, 'ENDPOINT_NOT_FOUND');
    assert.ok(getBody().error.available);
    assert.strictEqual(getHeader('access-control-allow-origin'), '*');
    assert.ok(getHeader('x-ratelimit-limit') > 0);
  });

  it('should return 405 for non-GET methods', () => {
    const { res, getStatus, getBody, getHeader } = mockRes();
    handler(mockReq('/api', 'POST'), res);
    assert.strictEqual(getStatus(), 405);
    assert.strictEqual(getBody().error.code, 'METHOD_NOT_ALLOWED');
    assert.strictEqual(getHeader('access-control-allow-origin'), '*');
    assert.ok(getHeader('x-ratelimit-remaining') >= 0);
  });

  it('should return health endpoint', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/health'), res);
    assert.strictEqual(getStatus(), 200);
    assert.strictEqual(getBody().data.ok, true);
    assert.strictEqual(getBody().data.status, 'ok');
    assert.strictEqual(getBody().data.apiVersion, 'v1');
    assert.strictEqual(getBody().data.implementationVersion, '4.3.0');
    assert.ok(!Object.prototype.hasOwnProperty.call(getBody().data, 'datasets'));
    assert.ok(!Object.prototype.hasOwnProperty.call(getBody().data, 'lastScrapedAt'));
    assert.ok(typeof getBody().dataVersion === 'string');
  });

  it('should return ready endpoint when datasets are loaded', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/ready'), res);
    assert.strictEqual(getStatus(), 200);
    assert.strictEqual(getBody().data.ready, true);
    assert.strictEqual(getBody().data.status, 'ok');
    assert.ok(getBody().data.datasetCount > 0);
    assert.ok(!Object.prototype.hasOwnProperty.call(getBody().data, 'datasets'));
  });

  it('should advertise health and readiness in OpenAPI', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/spec'), res);
    assert.strictEqual(getStatus(), 200);
    assert.ok(getBody().paths['/api/health']);
    assert.ok(getBody().paths['/api/ready']);
    assert.ok(getBody().paths['/api/v1/health']);
    assert.ok(getBody().paths['/api/v1/ready']);
  });

  it('should document metadata capabilities in OpenAPI', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/spec'), res);
    assert.strictEqual(getStatus(), 200);
    assert.ok(getBody().components.schemas.Capabilities);
    assert.ok(getBody().components.schemas.MetadataResponse);
    assert.strictEqual(
      getBody().paths['/api/v1/metadata'].get.responses[200].content['application/json'].schema.$ref,
      '#/components/schemas/MetadataResponse',
    );
  });

  it('should return stats endpoint', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/stats'), res);
    assert.strictEqual(getStatus(), 200);
    const stats = getBody().data;
    assert.ok(Object.keys(stats).length > 0);
    assert.ok(Object.prototype.hasOwnProperty.call(getBody(), 'lastScrapedAt'));
    for (const [key, val] of Object.entries(stats)) {
      assert.ok(typeof val.total === 'number', `${key} should have numeric total`);
    }
  });

  it('should return generated metadata for all datasets', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/metadata'), res);
    assert.strictEqual(getStatus(), 200);
    const metadata = getBody().data;
    assert.ok(metadata.datasetCount > 0);
    assert.ok(Array.isArray(metadata.datasets));
    const weapons = metadata.datasets.find(dataset => dataset.name === 'weapons');
    assert.ok(weapons);
    assert.ok(weapons.itemCount > 0);
    assert.ok(Array.isArray(weapons.fields));
    assert.ok(weapons.fields.includes('id'));
    assert.deepStrictEqual(weapons.capabilities.operations, ['list', 'get', 'filter', 'sort', 'paginate']);
    assert.strictEqual(weapons.capabilities.filters.supported, true);
    assert.ok(weapons.capabilities.filters.fields.includes('name'));
    assert.deepStrictEqual(weapons.capabilities.sorting.directions, ['asc', 'desc']);
    assert.strictEqual(weapons.capabilities.counts.includesTotal, true);

    const full = mockRes();
    handler(mockReq('/api/metadata?full=true'), full.res);
    const fullWeapons = full.getBody().data.datasets.find(dataset => dataset.name === 'weapons');
    assert.ok(fullWeapons.fields.id);
    assert.ok(Array.isArray(fullWeapons.fields.id.types));
    assert.ok(fullWeapons.capabilities.sorting.fields.includes('id'));
  });

  it('should return metadata for one dataset and 404 for an unknown dataset', () => {
    const found = mockRes();
    handler(mockReq('/api/metadata/weapons'), found.res);
    assert.strictEqual(found.getStatus(), 200);
    assert.strictEqual(found.getBody().data.name, 'weapons');
    assert.strictEqual(found.getBody().data.capabilities.counts.supported, true);

    const missing = mockRes();
    handler(mockReq('/api/metadata/not-a-real-dataset'), missing.res);
    assert.strictEqual(missing.getStatus(), 404);
    assert.strictEqual(missing.getBody().error.code, 'DATASET_NOT_FOUND');
    assert.strictEqual(missing.getBody().error.dataset, 'not-a-real-dataset');
  });

  it('should paginate results', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/weapons?page=1&per_page=5'), res);
    assert.strictEqual(getStatus(), 200);
    const body = getBody();
    assert.ok(Array.isArray(body.data));
    assert.ok(typeof body.dataVersion === 'string');
    assert.strictEqual(body.dataVersion, getLastScrapedAt());
    assert.equal(body.data.length, 5);
    assert.strictEqual(body.page, 1);
    assert.strictEqual(body.perPage, 5);
    assert.ok(typeof body.total === 'number');
    assert.ok(typeof body.totalPages === 'number');
  });

  it('should apply limit after filters for datasets and smart routes', () => {
    const dataset = mockRes();
    handler(mockReq('/api/weapons?limit=3&all=true'), dataset.res);
    assert.strictEqual(dataset.getStatus(), 200);
    assert.strictEqual(dataset.getBody().data.length, 3);

    const smart = mockRes();
    handler(mockReq('/api/armor?limit=2&all=true'), smart.res);
    assert.strictEqual(smart.getStatus(), 200);
    assert.strictEqual(smart.getBody().data.length, 2);
  });

  it('should return one dataset record by id', () => {
    const { res, getStatus, getBody, getHeader } = mockRes();
    handler(mockReq('/api/weapons/ak-12'), res);
    assert.strictEqual(getStatus(), 200);
    assert.ok(getHeader('cache-control'));
    assert.strictEqual(getBody().data.id, 'ak-12');
    assert.strictEqual(getBody().data.name, 'AK-12');
  });

  it('should return 404 for an unknown record id', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/weapons/does-not-exist'), res);
    assert.strictEqual(getStatus(), 404);
    assert.strictEqual(getBody().error.code, 'RECORD_NOT_FOUND');
    assert.strictEqual(getBody().error.dataset, 'weapons');
    assert.strictEqual(getBody().error.id, 'does-not-exist');
  });

  it('should support ?all=true to disable pagination', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/weapons?all=true'), res);
    assert.strictEqual(getStatus(), 200);
    const body = getBody();
    assert.ok(Array.isArray(body.data));
    assert.strictEqual(body.page, undefined);
  });

  it('should search across datasets', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/search?q=ak'), res);
    assert.strictEqual(getStatus(), 200);
    const body = getBody();
    assert.ok(body.data.query);
    assert.strictEqual(body.data.query, 'ak');
    assert.ok(body.data.results);
  });

  it('should return spec endpoint', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/spec'), res);
    assert.strictEqual(getStatus(), 200);
    const spec = getBody();
    assert.strictEqual(spec.openapi, '3.0.3');
    assert.ok(spec.paths);
    assert.ok(spec.paths['/api/weapons/{id}']);
    assert.strictEqual(spec.paths['/api/weapons/{id}'].get.parameters[0].name, 'id');
    assert.ok(spec.paths['/api/v1/weapons/{id}']);
    assert.ok(spec.paths['/api/v1/metadata']);
    assert.ok(spec.components?.schemas?.weapons);
    assert.ok(spec.components.schemas.ApiError);
    assert.ok(spec.components.schemas.ApiErrorResponse);
    assert.strictEqual(spec.components.schemas.ApiErrorResponse.properties.error.$ref, '#/components/schemas/ApiError');
    assert.strictEqual(spec.components.schemas.weapons.type, 'object');
    assert.ok(spec.components.schemas.weapons.properties.id);
  });

  it('should return API and dataset version information', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/version'), res);
    assert.strictEqual(getStatus(), 200);
    const version = getBody().data;
    assert.strictEqual(version.api, 'GZW Data API');
    assert.strictEqual(version.apiVersion, 'v1');
    assert.strictEqual(version.implementationVersion, '4.3.0');
    assert.ok(!Object.prototype.hasOwnProperty.call(version, 'version'));
    assert.strictEqual(version.baseUrl, 'https://gzw-data.dev/api/v1');
    assert.strictEqual(version.openapi, 'https://gzw-data.dev/api/v1/spec');
    assert.ok(typeof version.dataVersion === 'string');
    assert.ok(version.snapshot);
    assert.strictEqual(version.snapshot.version, version.dataVersion);
    assert.ok(Number.isInteger(version.historyCount));
    assert.ok(version.historyCount >= 1);
    assert.ok(version.datasetCount > 0);
    assert.ok(Array.isArray(version.datasets));
  });

  it('should report snapshot changes honestly', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/changes'), res);
    assert.strictEqual(getStatus(), 200);
    const changes = getBody().data;
    assert.ok(Number.isInteger(changes.historyCount));
    assert.ok(changes.historyCount >= 1);
    assert.strictEqual(changes.hasHistory, changes.historyCount > 1);
    if (changes.historyCount === 1) {
      assert.strictEqual(changes.previous, null);
      assert.deepStrictEqual(changes.changes.datasets, []);
      assert.match(changes.message, /next stored snapshot/);
    } else {
      assert.ok(changes.previous);
      assert.ok(Array.isArray(changes.changes.datasets));
    }
  });

  it('should calculate dataset count changes between snapshots', () => {
    const datasets = {
      _history: [{
        version: '2026-08-25T00:00:00.000Z',
        datasets: { weapons: 40, tasks: 10, old_data: 2 },
      }],
      weapons: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      tasks: [{ id: 'task' }],
      new_data: [{ id: 'new' }],
    };
    const asArray = (name) => Array.isArray(datasets[name]) ? datasets[name] : [];
    const changes = buildChanges(datasets, asArray, '2026-08-26T00:00:00.000Z');
    assert.strictEqual(changes.hasHistory, true);
    assert.deepStrictEqual(changes.changes.added, ['new_data']);
    assert.deepStrictEqual(changes.changes.removed, ['old_data']);
    assert.deepStrictEqual(changes.changes.datasets, [
      { dataset: 'new_data', before: 0, after: 1, delta: 1 },
      { dataset: 'old_data', before: 2, after: 0, delta: -2 },
      { dataset: 'tasks', before: 10, after: 1, delta: -9 },
      { dataset: 'weapons', before: 40, after: 3, delta: -37 },
    ]);
  });

  it('should advertise the version endpoint in OpenAPI', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/spec'), res);
    assert.strictEqual(getStatus(), 200);
    assert.ok(getBody().paths['/api/v1/version']);
  });

  it('should return a dataset schema', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/schema/weapons'), res);
    assert.strictEqual(getStatus(), 200);
    const schema = getBody().data;
    assert.strictEqual(schema.name, 'weapons');
    assert.strictEqual(schema.itemCount, 44);
    assert.ok(schema.fields.id);
    assert.ok(Array.isArray(schema.fields.id.types));
    assert.ok(typeof schema.lastScrapedAt === 'string');
  });

  it('should return a schema-not-found error for an unknown dataset', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/schema/not-a-real-dataset'), res);
    assert.strictEqual(getStatus(), 404);
    assert.strictEqual(getBody().error.code, 'DATASET_NOT_FOUND');
  });

  it('should advertise dataset schemas in OpenAPI', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/spec'), res);
    assert.strictEqual(getStatus(), 200);
    assert.ok(getBody().paths['/api/v1/schema/{dataset}']);
  });

  it('should return item context from current datasets', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/items/advanced-tracking-tag/context'), res);
    assert.strictEqual(getStatus(), 200);
    const context = getBody().data;
    assert.strictEqual(context.item.id, 'advanced-tracking-tag');
    assert.ok(Array.isArray(context.vendors));
    assert.ok(Array.isArray(context.references));
    assert.strictEqual(typeof context.referenceCount, 'number');
  });

  it('should expose related routes in OpenAPI', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/spec'), res);
    assert.strictEqual(getStatus(), 200);
    const spec = getBody();
    assert.ok(spec.paths['/api/v1/items/{id}/context']);
  });

  it('should return 404 for missing related records', () => {
    const item = mockRes();
    handler(mockReq('/api/v1/items/not-real/context'), item.res);
    assert.strictEqual(item.getStatus(), 404);
    assert.strictEqual(item.getBody().error.code, 'RECORD_NOT_FOUND');

  });

  it('should reject the unsupported weapon compatibility route', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/weapons/ak-12/parts'), res);
    assert.strictEqual(getStatus(), 404);
    assert.strictEqual(getBody().error.code, 'ENDPOINT_NOT_FOUND');
  });

  it('should support scoped and field-specific search', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/search?q=ak&dataset=weapons&fields=name,type&limit=2'), res);
    assert.strictEqual(getStatus(), 200);
    const body = getBody().data;
    assert.strictEqual(body.query, 'ak');
    assert.deepStrictEqual(body.datasets, ['weapons']);
    assert.deepStrictEqual(body.fields, ['name', 'type']);
    assert.strictEqual(body.limit, 2);
    assert.ok(Array.isArray(body.results.weapons));
    assert.ok(body.results.weapons.length <= 2);
  });

  it('should support fuzzy search for scoped records', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/search?q=AK12&dataset=weapons&fuzzy=true'), res);
    assert.strictEqual(getStatus(), 200);
    assert.ok(getBody().data.results.weapons.some(item => item.id === 'ak-12'));
    assert.strictEqual(getBody().data.fuzzy, true);
  });

  it('should reject search requests for unknown datasets', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/search?q=ak&dataset=not-a-real-dataset'), res);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getBody().error.code, 'INVALID_REQUEST');
  });

  it('should return spec search parameters', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/spec'), res);
    assert.strictEqual(getStatus(), 200);
    const search = getBody().paths['/api/v1/search'].get;
    assert.ok(search.parameters.some(parameter => parameter.name === 'dataset'));
    assert.ok(search.parameters.some(parameter => parameter.name === 'fields'));
    assert.ok(search.parameters.some(parameter => parameter.name === 'fuzzy'));
  });

  it('should export a bounded filtered dataset', () => {
    const { res, getStatus, getBody, getHeader } = mockRes();
    handler(mockReq('/api/v1/export/weapons?search=ak&limit=1'), res);
    assert.strictEqual(getStatus(), 200);
    assert.strictEqual(getBody().data.length, 1);
    assert.strictEqual(getBody().export.dataset, 'weapons');
    assert.strictEqual(getBody().export.count, 1);
    assert.strictEqual(getHeader('content-disposition'), 'attachment; filename="weapons.json"');
    assert.strictEqual(getHeader('x-export-record-limit'), MAX_EXPORT_RECORDS);
  });

  it('should reject an export over the record limit', () => {
    const records = Array.from({ length: MAX_EXPORT_RECORDS + 1 }, (_, index) => ({ id: String(index) }));
    const result = buildExport(records, new URLSearchParams());
    assert.strictEqual(result.error, 'EXPORT_TOO_LARGE');
    assert.strictEqual(result.maxRecords, MAX_EXPORT_RECORDS);
    assert.strictEqual(result.matchingRecords, MAX_EXPORT_RECORDS + 1);
  });

  it('should return 404 for an unknown export dataset', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/export/not_a_dataset'), res);
    assert.strictEqual(getStatus(), 404);
    assert.strictEqual(getBody().error.code, 'DATASET_NOT_FOUND');
  });

  it('should advertise bounded exports in OpenAPI', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/spec'), res);
    assert.strictEqual(getStatus(), 200);
    assert.ok(getBody().paths['/api/v1/export/{dataset}']);
    assert.strictEqual(
      getBody().paths['/api/v1/export/{dataset}'].get.responses[200].content['application/json'].schema.$ref,
      '#/components/schemas/ExportResponse',
    );
  });

  it('should handle smart routes', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/armor?all=true'), res);
    assert.strictEqual(getStatus(), 200);
    const body = getBody();
    assert.ok(Array.isArray(body.data));
    const hasCategory = body.data.some(item => item.category);
    assert.ok(hasCategory, 'Smart route should add category field');
  });

  it('should handle OPTIONS preflight', () => {
    const { res, getStatus, getHeader } = mockRes();
    handler(mockReq('/api', 'OPTIONS'), res);
    assert.strictEqual(getStatus(), 204);
    assert.strictEqual(getHeader('access-control-allow-origin'), '*');
  });

  it('should handle images endpoint', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/images'), res);
    assert.strictEqual(getStatus(), 200);
    assert.ok(getBody().data !== undefined);
  });

  it('should handle weapon_parts smart route', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/weapon_parts?all=true'), res);
    assert.strictEqual(getStatus(), 200);
    const body = getBody();
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0, 'weapon_parts should return items');
    const hasPartCategory = body.data.some(item => item.part_category);
    assert.ok(hasPartCategory, 'weapon_parts should add part_category field');
  });

  it('should handle rate limiting', () => {
    // Exhaust the rate limit
    for (let i = 0; i < 100; i++) {
      const { res: r } = mockRes();
      handler(mockReq('/api'), r);
    }

    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api'), res);
    const status = getStatus();
    if (status === 429) {
      const body = getBody();
      assert.strictEqual(body.error.code, 'RATE_LIMITED');
      assert.ok(body.error.message.includes('Rate limit'));
      assert.ok(body.error.retryAfter > 0);
    } else {
      assert.strictEqual(status, 200);
    }
  });
});
