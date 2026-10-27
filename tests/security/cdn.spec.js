const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const { get, json } = require('./helpers');

test('a forged forwarding header cannot change or poison a health response', async ({ request }) => {
  // Unique query keys isolate this test from normal consumers, even if the regression returns.
  const url = `/api/v1/health?security_probe=${randomUUID()}`;
  for (const headers of [{ 'x-vercel-forwarded-url': '/api/v1/weapons?limit=1' }, {}]) {
    const response = await get(request, url, { headers });
    const body = await json(response);
    expect(body.data.status).toBe('ok');
    expect(Array.isArray(body.data)).toBe(false);
    expect(response.headers()['cache-control'] || '').not.toMatch(/max-age=[1-9]/);
  }
});

test('cacheable dataset content follows its URL, not an unkeyed header', async ({ request }) => {
  // page is ignored by all=true but still isolates the CDN key; unknown query keys would filter records.
  const actualUrl = `/api/v1/weapons?limit=1&all=true&page=${randomUUID()}`;
  let first;
  for (const headers of [{ 'x-vercel-forwarded-url': '/api/v1/weapons?limit=2&all=true' }, {}]) {
    const response = await get(request, actualUrl, { headers });
    const body = await json(response);
    expect(body.data).toHaveLength(1);
    if (first) expect(body.data).toEqual(first);
    first = body.data;
  }
});

test('forwarded host and rewrite headers cannot redirect navigation away from the preview', async ({ request, baseURL }) => {
  const response = await get(request, '/docs', { headers: {
    'x-forwarded-host': 'example.invalid',
    'x-original-url': '/api/v1/weapons',
    'x-rewrite-url': '/api/v1/weapons',
  } });
  expect([307, 308]).toContain(response.status());
  const target = new URL(response.headers().location, baseURL);
  expect(target.origin).toBe(new URL(baseURL).origin);
  expect(target.pathname).toBe('/docs/');
});
