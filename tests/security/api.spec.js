const { test, expect } = require('@playwright/test');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { get, json, expectCsp } = require('./helpers');

test('representative real responses satisfy their published OpenAPI contracts', async ({ request }) => {
  const specResponse = await get(request, '/api/v1/spec');
  expect(specResponse.status()).toBe(200);
  const spec = await specResponse.json();
  expect(spec.openapi).toBe('3.0.3');
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats(ajv);
  ajv.addSchema({ $id: 'gzw-contract', components: spec.components });
  for (const [url, template] of [
    ['/api/v1/health', '/api/v1/health'],
    ['/api/v1/weapons?per_page=2', '/api/v1/weapons'],
    ['/api/v1/weapons/ak-12', '/api/v1/weapons/{id}'],
    ['/api/v1/search?q=AK&dataset=weapons&limit=2', '/api/v1/search'],
    ['/api/v1/export/weapons?limit=1', '/api/v1/export/{dataset}'],
    ['/api/v1/metadata/weapons', '/api/v1/metadata/{dataset}'],
  ]) {
    const body = await json(await get(request, url));
    const schema = spec.paths[template].get.responses['200'].content['application/json'].schema;
    const validate = ajv.compile({ $ref: `gzw-contract${schema.$ref}` });
    expect(validate(body), `${url}: ${ajv.errorsText(validate.errors)}`).toBe(true);
  }
});

test('bounded malformed inputs return structured errors instead of server errors', async ({ request }) => {
  for (const [url, status] of [
    ['/api/v1/search', 400],
    ['/api/v1/search?q=a&dataset=__proto__', 400],
    ['/api/v1/search?q=a&fuzzy=true', 400],
    [`/api/v1/search?q=${'a'.repeat(201)}`, 400],
    ['/api/v1/constructor', 404],
    ['/api/v1/export/__proto__', 404],
    ['/api/v1/weapons/security-missing-record', 404],
  ]) {
    await test.step(url, async () => {
      const body = await json(await get(request, url), status);
      expect(body.error.code).toEqual(expect.any(String));
      expect(JSON.stringify(body)).not.toMatch(/node:internal|\\Users\\|\.js:\d+:\d+/);
    });
  }
});

test('null-byte paths are rejected by either the edge or application', async ({ request }) => {
  const response = await get(request, '/api/v1/weapons/%00');
  if (response.status() === 400) {
    // Vercel rejects this URL before the application; the edge does not use our JSON envelope.
    expect(response.headers()['content-type']).toContain('text/plain');
    const body = await response.text();
    expect(body.length).toBeLessThan(4096);
    expect(body).not.toMatch(/node:internal|\.js:\d+:\d+/);
  } else {
    const body = await json(response, 404);
    expect(body.error.code).toBe('RECORD_NOT_FOUND');
  }
});

test('pagination boundaries and query-order variants preserve the record limit', async ({ request }) => {
  for (const query of ['per_page=2&page=-1', 'page=-1&per_page=2', 'per_page=2&page=NaN', 'per_page=2&page=1&page=99999']) {
    const body = await json(await get(request, `/api/v1/weapons?${query}`));
    expect(body.page).toBe(1);
    expect(body.data.length).toBeLessThanOrEqual(2);
  }
});

test('read-only methods and public non-credentialed CORS remain enforced', async ({ request }) => {
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const response = await request.fetch('/api/v1/health', { method, maxRedirects: 0 });
    await json(response, 405);
  }
  const response = await get(request, '/api/v1/health', { headers: { Origin: 'https://example.invalid' } });
  await json(response);
  expect(response.headers()['access-control-allow-origin']).toBe('*');
  expect(response.headers()['access-control-allow-credentials']).toBeUndefined();
});

test('HTML and error pages retain CSP for normal and prefetch-shaped requests', async ({ request }) => {
  for (const [url, status] of [['/', 200], ['/playground/', 200], ['/security-missing-page', 404]]) {
    for (const headers of [{}, { 'next-router-prefetch': '1', purpose: 'prefetch' }]) {
      const response = await get(request, url, { headers });
      expect(response.status()).toBe(status);
      expectCsp(response);
    }
  }
});
