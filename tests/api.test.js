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
    assert.ok(getBody().error);
    assert.ok(getBody().available);
  });

  it('should return 405 for non-GET methods', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api', 'POST'), res);
    assert.strictEqual(getStatus(), 405);
    assert.ok(getBody().error);
  });

  it('should return health endpoint', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/health'), res);
    assert.strictEqual(getStatus(), 200);
    assert.strictEqual(getBody().data.ok, true);
    assert.strictEqual(getBody().data.version, '4.0.0');
  });

  it('should return stats endpoint', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/stats'), res);
    assert.strictEqual(getStatus(), 200);
    const stats = getBody().data;
    assert.ok(Object.keys(stats).length > 0);
    for (const [key, val] of Object.entries(stats)) {
      assert.ok(typeof val.total === 'number', `${key} should have numeric total`);
    }
  });

  it('should paginate results', () => {
    const { res, getStatus, getBody } = mockRes();
    handler(mockReq('/api/weapons?page=1&per_page=5'), res);
    assert.strictEqual(getStatus(), 200);
    const body = getBody();
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length <= 5);
    assert.strictEqual(body.page, 1);
    assert.strictEqual(body.perPage, 5);
    assert.ok(typeof body.total === 'number');
    assert.ok(typeof body.totalPages === 'number');
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
      assert.ok(body.error.includes('Rate limit'));
      assert.ok(body.retryAfter > 0);
    } else {
      assert.strictEqual(status, 200);
    }
  });
});
