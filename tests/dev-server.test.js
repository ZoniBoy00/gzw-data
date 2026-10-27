const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createServer } = require('../scripts/dev-server');

function get(server, requestPath) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: server.address().port, path: requestPath }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    }).on('error', reject);
  });
}

test('local server survives malformed static URLs and applies production security headers', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const value of ['/%', '/%E0%A4%A']) {
      const bad = await get(server, value);
      assert.equal(bad.status, 400);
    }
    const ok = await get(server, '/playground/');
    assert.equal(ok.status, 200);
    assert.equal(ok.headers['x-content-type-options'], 'nosniff');
    assert.ok(ok.headers['content-security-policy'].includes("script-src 'self'"));
    const missing = await get(server, '/not-a-real-page');
    assert.equal(missing.status, 404);
    assert.equal(missing.headers['x-frame-options'], 'DENY');
    const redirect = await get(server, '/docs');
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.location, '/docs/');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
