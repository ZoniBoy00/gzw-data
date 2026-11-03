const { describe, it } = require('node:test');
const assert = require('node:assert');
const { endpointLabel, clientLabel, redisConfig, buildCommands, recordUsage } = require('../lib/usage');

describe('usage counters', () => {
  const known = new Set(['weapons', 'health']);

  it('keeps only the dataset name so record ids and junk paths do not create new keys', () => {
    assert.strictEqual(endpointLabel('weapons/abc123', known), 'weapons');
    assert.strictEqual(endpointLabel('health', known), 'health');
    assert.strictEqual(endpointLabel('wp-login.php', known), 'other');
  });

  it('separates our own website from outside clients', () => {
    assert.strictEqual(clientLabel({ origin: 'https://gzw-data.dev' }), 'own-site');
    assert.strictEqual(clientLabel({ referer: 'https://gzw-data.dev/playground/' }), 'own-site');
    assert.strictEqual(clientLabel({ origin: 'https://gzw-data.dev.evil.example' }), 'unknown');
  });

  it('uses X-Client before User-Agent and keeps only a short sanitized product name', () => {
    assert.strictEqual(clientLabel({ 'x-client': 'My-Bot/2.1', 'user-agent': 'curl/8.0' }), 'my-bot');
    assert.strictEqual(clientLabel({ 'user-agent': 'python-requests/2.31 (x86)' }), 'python-requests');
    assert.strictEqual(clientLabel({ 'x-client': '<script>alert(1)</script>'.repeat(5) }).length <= 40, true);
    assert.strictEqual(clientLabel({}), 'unknown');
  });

  it('builds counters that contain no IP address, URL or query string', () => {
    const commands = buildCommands({ day: '2026-11-03', endpoint: 'weapons', status: 200, client: 'own-site' });
    assert.deepStrictEqual(commands.map(c => c[2]), ['total', 'ep:weapons', 'st:200', 'cl:own-site']);
    assert.ok(commands.every(c => c[0] === 'HINCRBY' && c[1] === 'usage:2026-11-03'));
  });

  it('does nothing without Redis credentials', () => {
    assert.strictEqual(redisConfig({}), null);
    assert.deepStrictEqual(redisConfig({ KV_REST_API_URL: 'https://x.upstash.io/', KV_REST_API_TOKEN: 't' }), { url: 'https://x.upstash.io', token: 't' });
    const saved = { a: process.env.KV_REST_API_URL, b: process.env.UPSTASH_REDIS_REST_URL };
    delete process.env.KV_REST_API_URL; delete process.env.UPSTASH_REDIS_REST_URL;
    assert.doesNotThrow(() => recordUsage({ route: 'weapons', status: 200, headers: {}, known }));
    if (saved.a) process.env.KV_REST_API_URL = saved.a;
    if (saved.b) process.env.UPSTASH_REDIS_REST_URL = saved.b;
  });
});
