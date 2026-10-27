const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validateTarget } = require('./security/target');

function setupFixture({ firstStatus = 302, healthStatus = 200, secret = 'fixture-secret' } = {}) {
  const calls = [];
  let stored = false;
  let disposed = false;
  const context = {
    get: async (url, options) => {
      calls.push({ url, options });
      const status = url === '/' ? firstStatus : healthStatus;
      return { ok: () => status >= 200 && status < 300, status: () => status, headers: () => ({ 'content-type': 'application/json' }) };
    },
    storageState: async () => { stored = true; },
    dispose: async () => { disposed = true; },
  };
  const loaded = { exports: {} };
  const fakeRequire = name => {
    if (name === 'node:fs') return { mkdirSync() {}, writeFileSync() {} };
    if (name === './target') return { validateTarget };
    if (name === '@playwright/test') return { request: { newContext: async () => context } };
    throw new Error(`Unexpected fixture import: ${name}`);
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'security/setup.js'), 'utf8'), {
    module: loaded,
    require: fakeRequire,
    process: { env: { SECURITY_BASE_URL: 'https://gzw-data-fixture-zoniboy00s-projects.vercel.app', VERCEL_AUTOMATION_BYPASS_SECRET: secret } },
  });
  return { run: loaded.exports, calls, stored: () => stored, disposed: () => disposed };
}

test('preview setup accepts the cookie-setting redirect without forwarding its secret', async () => {
  const fixture = setupFixture();
  await fixture.run();
  assert.equal(fixture.calls.length, 2);
  assert.equal(fixture.calls[0].url, '/');
  assert.equal(fixture.calls[0].options.maxRedirects, 0);
  assert.equal(fixture.calls[0].options.headers['x-vercel-protection-bypass'], 'fixture-secret');
  assert.equal(fixture.calls[1].url, '/api/v1/health');
  assert.equal(fixture.calls[1].options.headers, undefined);
  assert.equal(fixture.stored(), true);
  assert.equal(fixture.disposed(), true);
});

test('a cookie redirect alone is not proof that preview access succeeded', async () => {
  const fixture = setupFixture({ healthStatus: 401 });
  await assert.rejects(fixture.run(), /health check failed/);
  assert.equal(fixture.stored(), false);
  assert.equal(fixture.disposed(), true);
});

test('preview setup refuses a failed bypass response', async () => {
  const fixture = setupFixture({ firstStatus: 403 });
  await assert.rejects(fixture.run(), /bypass failed/);
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.disposed(), true);
});

test('missing secret never sends a bypass header and a protected preview fails clearly', async () => {
  const fixture = setupFixture({ secret: '', healthStatus: 302 });
  await assert.rejects(fixture.run(), /VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].options.headers, undefined);
});
