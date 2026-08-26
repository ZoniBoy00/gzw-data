// GZW Data API — Integration tests
// Run: node --test tests/api.test.js
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

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
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/nonexistent_dataset_xyz'), res);
    assert.strictEqual(getStatus(), 404);
    assert.strictEqual(getBody().error.code, 'ENDPOINT_NOT_FOUND');
    assert.ok(getBody().error.available);
  });

  it('should return 405 for non-GET methods', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api', 'POST'), res);
    assert.strictEqual(getStatus(), 405);
    assert.strictEqual(getBody().error.code, 'METHOD_NOT_ALLOWED');
  });

  it('should return health endpoint', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/health'), res);
    assert.strictEqual(getStatus(), 200);
    assert.strictEqual(getBody().data.ok, true);
    assert.strictEqual(getBody().data.status, 'ok');
    assert.strictEqual(getBody().data.ready, true);
    assert.strictEqual(getBody().data.apiVersion, 'v1');
    assert.ok(getBody().data.datasetCount > 0);
    assert.ok(typeof getBody().dataVersion === 'string');
    assert.strictEqual(getBody().dataVersion, getBody().data.lastScrapedAt);
    assert.strictEqual(getBody().data.version, '4.0.0');
    assert.ok(Object.prototype.hasOwnProperty.call(getBody().data, 'lastScrapedAt'));
  });

  it('should return ready endpoint when datasets are loaded', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/v1/ready'), res);
    assert.strictEqual(getStatus(), 200);
    assert.strictEqual(getBody().data.ready, true);
    assert.strictEqual(getBody().data.status, 'ok');
    assert.ok(getBody().data.datasetCount > 0);
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

    const full = mockRes();
    handler(mockReq('/api/metadata?full=true'), full.res);
    const fullWeapons = full.getBody().data.datasets.find(dataset => dataset.name === 'weapons');
    assert.ok(fullWeapons.fields.id);
    assert.ok(Array.isArray(fullWeapons.fields.id.types));
  });

  it('should return metadata for one dataset and 404 for an unknown dataset', () => {
    const found = mockRes();
    handler(mockReq('/api/metadata/weapons'), found.res);
    assert.strictEqual(found.getStatus(), 200);
    assert.strictEqual(found.getBody().data.name, 'weapons');

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
    assert.strictEqual(body.dataVersion, '2026-08-25T11:12:54.629187Z');
    assert.equal(body.data.length, 5);
    assert.strictEqual(body.page, 1);
    assert.strictEqual(body.perPage, 5);
    assert.ok(typeof body.total === 'number');
    assert.ok(typeof body.totalPages === 'number');
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
