const { expect } = require('@playwright/test');
const { setTimeout: delay } = require('node:timers/promises');

async function get(request, url, options = {}) {
  // One worker, bounded inputs and a fixed delay keep this suite below the API quota.
  await delay(300);
  const response = await request.get(url, { timeout: 12000, maxRedirects: 0, ...options });
  expect(response.status(), 'Stop on rate limiting; do not retry or rotate identities').not.toBe(429);
  return response;
}
async function json(response, status = 200) {
  expect(response.status()).toBe(status);
  expect(response.headers()['content-type']).toContain('application/json');
  const body = await response.json();
  expect(body).toHaveProperty('source', 'GZW Data API');
  expect(Number.isFinite(Date.parse(body.timestamp))).toBe(true);
  return body;
}
function expectCsp(response) {
  const headers = response.headers();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  const csp = headers['content-security-policy'] || '';
  for (const part of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "frame-ancestors 'none'"]) expect(csp).toContain(part);
  expect(csp).not.toContain("'unsafe-inline'");
  expect(csp).not.toContain("'unsafe-eval'");
}
module.exports = { get, json, expectCsp };
